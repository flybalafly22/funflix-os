import math
import os
import ssl
import threading
import time
from datetime import date
from queue import Empty, Queue
import urllib.request
import json as json_mod
import certifi
from google import genai
from google.genai import types
from flask import Flask, render_template, request, jsonify, Response, stream_with_context

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

app = Flask(__name__)

# Precomputed supplement analysis (built offline by analysis/build_analysis_json.py).
# Loaded once at startup so production needs no pandas/sklearn.
_ANALYSIS_PATH = os.path.join(os.path.dirname(__file__), "data", "analysis.json")
try:
    with open(_ANALYSIS_PATH) as _f:
        ANALYSIS = json_mod.load(_f)
except FileNotFoundError:
    ANALYSIS = None

SAFE_NAMES = {name: getattr(math, name) for name in dir(math) if not name.startswith("_")}
SAFE_NAMES.update({"abs": abs, "round": round, "pi": math.pi, "e": math.e})

@app.route("/")
def index():
    return render_template("funflix.html")

@app.route("/calculator")
def calculator():
    return render_template("index.html")

@app.route("/game")
def game():
    return render_template("game.html")

@app.route("/play/city-game")
def fly():
    return render_template("fly.html")

@app.route("/play/the-fly")
def the_fly():
    return render_template("town.html")

@app.route("/play/the-fly-classic")
def the_fly_classic():
    return render_template("the_fly.html")

@app.route("/play/town-slice")
def town_slice():
    return render_template("town_slice.html")

@app.route("/play/town")
def town():
    return render_template("town.html")

@app.route("/meme")
def meme():
    return render_template("meme.html")

SSL_CTX = ssl.create_default_context(cafile=certifi.where())

# Served if the memegen.link API is unreachable
FALLBACK_TEMPLATES = [
    {"id": i, "name": n, "blank": f"https://api.memegen.link/images/{i}.png"}
    for i, n in [
        ("drake", "Drake Hotline Bling"), ("db", "Distracted Boyfriend"),
        ("doge", "Doge"), ("fry", "Futurama Fry"), ("buzz", "Buzz Lightyear"),
        ("success", "Success Kid"), ("gru", "Gru's Plan"), ("stonks", "Stonks"),
        ("woman-cat", "Woman Yelling at Cat"), ("pigeon", "Is This a Pigeon"),
        ("spongebob", "Mocking Spongebob"), ("astronaut", "Always Has Been"),
    ]
]

@app.route("/api/meme-templates")
def meme_templates():
    try:
        req = urllib.request.Request(
            "https://api.memegen.link/templates/",
            headers={"User-Agent": "calculator-meme-app/1.0"},
        )
        with urllib.request.urlopen(req, timeout=6, context=SSL_CTX) as resp:
            data = json_mod.loads(resp.read())
        slim = [{"id": t["id"], "name": t["name"], "blank": t["blank"]} for t in data]
    except Exception:
        slim = FALLBACK_TEMPLATES
    return jsonify(slim)

@app.route("/journalist")
def journalist():
    return render_template("journalist.html")

@app.route("/api/journalist", methods=["POST"])
def journalist_api():
    topic = request.json.get("topic", "").strip()
    if not topic:
        return jsonify({"error": "Please enter a topic."}), 400

    api_key = GEMINI_API_KEY
    if not api_key:
        return jsonify({"error": "GEMINI_API_KEY environment variable is not set."}), 500

    def generate():
        try:
            client = genai.Client(api_key=api_key)
            prompt = (
                f"Search the internet for the latest news and information about: {topic}\n\n"
                f"Then write a compelling 4-paragraph news article about what you found. "
                f"Start with a punchy headline on its own line, then write the article. "
                f"Use clear, engaging journalistic language with key facts and context."
            )
            response = client.models.generate_content_stream(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    tools=[types.Tool(google_search=types.GoogleSearch())],
                ),
            )
            for chunk in response:
                if chunk.text:
                    yield chunk.text
        except Exception as exc:
            err = str(exc)
            if "API_KEY" in err or "api key" in err.lower() or "401" in err:
                yield "ERROR: Invalid GEMINI_API_KEY. Check your key and restart the server."
            else:
                yield f"ERROR: {err}"

    return Response(stream_with_context(generate()), mimetype="text/plain")

# ════════ The Study — supplement bio-analytics dashboard + AI analyst ════════
@app.route("/study")
def study():
    return render_template("lab.html")


@app.route("/api/analysis-data")
def analysis_data():
    if ANALYSIS is None:
        return jsonify({"error": "analysis.json not found — run analysis/build_analysis_json.py"}), 500
    # Everything the dashboard needs; the heavy 'digest' is server-side only.
    out = {k: v for k, v in ANALYSIS.items() if k != "digest"}
    out["analyst_ready"] = bool(GEMINI_API_KEY)
    return jsonify(out)


ANALYST_SYSTEM = """You are 'The Analyst', a precise, friendly data analyst embedded in the FUNFLIX \
Study dashboard. You help users understand a supplement-impact analysis through back-and-forth conversation.

Use ONLY the dataset facts and findings below. If a question cannot be answered from them, say so plainly \
and suggest what the data CAN tell them. Never invent numbers — quote the figures given. This is SYNTHETIC \
data for analysis practice, so frame insights as patterns in the dataset, not medical advice.

Be conversational and concise: 2-4 short paragraphs or a tight bulleted list. Explain what numbers MEAN \
(e.g. why a low coefficient of variation signals consistency, why a near-zero correlation means a factor \
does not matter), not just what they are. Plain text only — no markdown headers or tables.

==== ANALYSIS BRIEF ====
{digest}
==== END BRIEF ===="""


@app.route("/api/analyst", methods=["POST"])
def analyst_api():
    if ANALYSIS is None:
        return jsonify({"error": "Analysis data is unavailable on the server."}), 500

    payload = request.json or {}
    messages = payload.get("messages", [])
    if not isinstance(messages, list) or not messages:
        return jsonify({"error": "Please ask a question."}), 400
    if not any(m.get("role") == "user" for m in messages):
        return jsonify({"error": "Please ask a question."}), 400

    api_key = GEMINI_API_KEY
    if not api_key:
        return jsonify({"error": "GEMINI_API_KEY environment variable is not set."}), 500

    # Build Gemini conversation contents from the client-side history (cap to last 12 turns).
    contents = []
    for m in messages[-12:]:
        role = "model" if m.get("role") == "assistant" else "user"
        text = (m.get("content") or "").strip()
        if text:
            contents.append(types.Content(role=role, parts=[types.Part(text=text)]))
    if not contents:
        return jsonify({"error": "Please ask a question."}), 400

    system_instruction = ANALYST_SYSTEM.format(digest=ANALYSIS["digest"])

    def generate():
        try:
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content_stream(
                model="gemini-2.5-flash",
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.4,
                ),
            )
            for chunk in response:
                if chunk.text:
                    yield chunk.text
        except Exception as exc:
            err = str(exc)
            if "API_KEY" in err or "api key" in err.lower() or "401" in err:
                yield "ERROR: Invalid GEMINI_API_KEY. Check your key and restart the server."
            else:
                yield f"ERROR: {err}"

    return Response(stream_with_context(generate()), mimetype="text/plain")


# ════════ The Trainer — evidence-based training + nutrition plans ════════
_TRAINER_DEMO_PATH = os.path.join(os.path.dirname(__file__), "data", "trainer_demo.json")
try:
    with open(_TRAINER_DEMO_PATH) as _f:
        TRAINER_DEMO = json_mod.load(_f)
except FileNotFoundError:
    TRAINER_DEMO = None

TRAINER_SYSTEM = ""  # populated below (see data/trainer_system.txt)
_TRAINER_SYS_PATH = os.path.join(os.path.dirname(__file__), "data", "trainer_system.txt")
try:
    with open(_TRAINER_SYS_PATH) as _f:
        TRAINER_SYSTEM = _f.read()
except FileNotFoundError:
    TRAINER_SYSTEM = ""


# Per-IP sliding-window rate limit for real plan generations (demo is exempt).
# Protects the Gemini quota if the site gets real traffic. In-memory per worker
# (2 workers → effective ceiling up to 2x the number below; fine at this scale).
TRAINER_RL_MAX = int(os.environ.get("TRAINER_RL_MAX", "6"))
TRAINER_RL_WINDOW_S = 3600
_trainer_hits = {}
_trainer_rl_lock = threading.Lock()


def _client_ip():
    fwd = request.headers.get("X-Forwarded-For", "")
    return (fwd.split(",")[0].strip() if fwd else request.remote_addr) or ""


def _rate_limited(ip):
    # Localhost stays exempt: local dev and the test suite hit the API freely,
    # while real clients behind Render's proxy arrive via X-Forwarded-For.
    if ip in ("127.0.0.1", "::1", ""):
        return False
    now = time.time()
    with _trainer_rl_lock:
        hits = [t for t in _trainer_hits.get(ip, []) if now - t < TRAINER_RL_WINDOW_S]
        if len(hits) >= TRAINER_RL_MAX:
            _trainer_hits[ip] = hits
            return True
        hits.append(now)
        _trainer_hits[ip] = hits
        return False


@app.route("/api/version")
def version():
    # Render sets RENDER_GIT_COMMIT; lets us verify which commit is actually live.
    return jsonify({"commit": os.environ.get("RENDER_GIT_COMMIT", "dev")[:7]})


@app.route("/trainer")
def trainer():
    return render_template("trainer.html")


@app.route("/api/trainer", methods=["POST"])
def trainer_api():
    payload = request.json or {}

    # keyless demo: lets the document view + PDF be exercised without an API key.
    # demo=stream exercises the streamed text path the real API uses.
    if payload.get("demo"):
        if TRAINER_DEMO is None:
            return jsonify({"error": "Demo plan is unavailable on the server."}), 500
        if payload["demo"] == "stream":
            demo_text = json_mod.dumps(TRAINER_DEMO)

            def demo_gen():
                for i in range(0, len(demo_text), 2048):
                    yield demo_text[i:i + 2048]
            return Response(stream_with_context(demo_gen()), mimetype="text/plain")
        return jsonify(TRAINER_DEMO)

    intake = payload.get("intake") or {}
    if not str(intake.get("name", "")).strip() or not str(intake.get("goal", "")).strip():
        return jsonify({"error": "Please fill in at least your name and goal."}), 400

    if not GEMINI_API_KEY:
        return jsonify({"error": "GEMINI_API_KEY environment variable is not set."}), 500
    if not TRAINER_SYSTEM:
        return jsonify({"error": "Trainer knowledge base missing on server."}), 500

    if _rate_limited(_client_ip()):
        return jsonify({"error": "That's several programs within the hour — the studio needs a moment. "
                                 "Your limit resets within the hour, and your details stay in the form."}), 429

    if payload.get("mode") == "checkin":
        lines = ["MODE: WEEK-4 CHECK-IN", "",
                 "CHECK-IN DATA (the client has been running a plan; recalibrate from the measured results):"]
    else:
        lines = ["INTAKE FORM:"]
    for k, v in intake.items():
        v = str(v).strip()
        if v:
            lines.append(f"- {k}: {v}")
    lines.append(f"- current_date: {date.today().isoformat()}")
    followups = payload.get("followup_answers") or []
    if followups:
        lines.append("\nFOLLOW-UP ANSWERS (you asked, the client answered — do NOT ask again; produce the plan):")
        for qa in followups[:8]:
            lines.append(f"- Q: {str(qa.get('q','')).strip()}\n  A: {str(qa.get('a','')).strip()}")
    user_content = "\n".join(lines)

    # Stream the JSON out as it is generated. A full plan takes well over the
    # 30 s that proxies tolerate for a silent response; streaming keeps bytes
    # flowing (same pattern as the journalist/analyst endpoints). The client
    # accumulates the text and parses the JSON at the end.
    #
    # The plan is a large structured object, so give the model generous output
    # room AND enough thinking budget to run its arithmetic self-check — a tight
    # budget can leave it emitting an empty or truncated (unparseable) object.
    config_kwargs = dict(
        system_instruction=TRAINER_SYSTEM,
        temperature=0.5,
        response_mime_type="application/json",
        max_output_tokens=32768,
    )
    try:
        config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=8192)
    except AttributeError:
        pass

    # Gemini occasionally returns 503 UNAVAILABLE ("high demand") or a rate-limit
    # blip — these are transient and on Google's side. Retry with exponential
    # backoff, then FALL BACK to gemini-2.5-flash-lite (a separate, lighter
    # capacity pool on the same API key) before giving up.
    TRANSIENT = ("503", "unavailable", "high demand", "overloaded",
                 "429", "resource_exhausted", "rate limit", "500", "internal error")
    MODEL_CHAIN = ("gemini-2.5-flash", "gemini-2.5-flash",
                   "gemini-2.5-flash-lite", "gemini-2.5-flash-lite")
    MAX_ATTEMPTS = len(MODEL_CHAIN)

    def backoff(attempt):
        # switching to a different model pool: no point waiting long first
        if attempt + 1 < MAX_ATTEMPTS and MODEL_CHAIN[attempt + 1] != MODEL_CHAIN[attempt]:
            time.sleep(0.5)
        else:
            time.sleep(1.5 * (2 ** attempt))

    # Architecture: the model chain runs in a worker thread and the FULL output
    # is buffered and VALIDATED server-side before anything real is sent. The
    # response generator emits only whitespace keepalives (legal before JSON,
    # invisible after the client's trim) every 10 s until the worker delivers
    # one complete, parse-checked payload. Two consequences:
    #   - keepalives can never land inside the JSON (a mid-stream stall used to
    #     let a space split a number and corrupt the payload), and
    #   - a bad/truncated/unparseable attempt is retried server-side instead of
    #     asking the user to click again.
    def run_model_chain(q):
        for attempt in range(MAX_ATTEMPTS):
            finish = ""
            try:
                client = genai.Client(api_key=GEMINI_API_KEY)
                response = client.models.generate_content_stream(
                    model=MODEL_CHAIN[attempt],
                    contents=user_content,
                    config=types.GenerateContentConfig(**config_kwargs),
                )
                parts = []
                for chunk in response:
                    if chunk.text:
                        parts.append(chunk.text)
                    try:
                        fr = chunk.candidates[0].finish_reason
                        if fr:
                            finish = str(fr)
                    except (AttributeError, IndexError, TypeError):
                        pass

                text = "".join(parts).strip()
                if text.startswith("```"):  # JSON mode shouldn't fence, but be safe
                    text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
                try:
                    data = json_mod.loads(text)
                except ValueError:
                    data = None
                if isinstance(data, dict) and data.get("type") in ("questions", "plan"):
                    q.put(("end", text))  # complete, validated payload
                    return

                # Unusable output. A safety block will not improve on retry;
                # everything else (truncated, malformed, empty) gets retried.
                if "SAFETY" in finish or "RECITATION" in finish or "BLOCK" in finish:
                    q.put(("end", "\nERROR: A content filter blocked the plan. This usually comes from "
                                  "sensitive wording in the health or extra-info box — rephrase it plainly and try again."))
                    return
                print(f"[trainer] attempt {attempt + 1}/{MAX_ATTEMPTS} unusable output "
                      f"(model={MODEL_CHAIN[attempt]}, finish={finish or '?'}, chars={len(text)})", flush=True)
                if attempt < MAX_ATTEMPTS - 1:
                    backoff(attempt)
                    continue
                q.put(("end", "\nERROR: The model kept returning an incomplete plan — it is under heavy load "
                              "right now. Nothing is wrong with your details; please try again in a few minutes."))
                return
            except Exception as exc:
                err = str(exc)
                low = err.lower()
                if "api_key" in low or "api key" in low or "401" in low:
                    q.put(("end", "\nERROR: Invalid GEMINI_API_KEY on the server."))
                    return
                transient = any(m in low for m in TRANSIENT)
                if transient and attempt < MAX_ATTEMPTS - 1:
                    backoff(attempt)
                    continue
                if transient:
                    q.put(("end", "\nERROR: Gemini is temporarily overloaded (high demand on Google's side, "
                                  "not your account or key) — even the backup model. Please try again in a minute or two."))
                    return
                q.put(("end", f"\nERROR: {err}"))
                return
        q.put(("end", None))  # unreachable, but the reader must never block forever

    def generate():
        q = Queue()
        threading.Thread(target=run_model_chain, args=(q,), daemon=True).start()
        while True:
            try:
                _, val = q.get(timeout=10)
            except Empty:
                yield " "  # keepalive while the worker generates/validates/retries
                continue
            if val:
                yield val
            return

    return Response(stream_with_context(generate()), mimetype="text/plain")


@app.route("/calculate", methods=["POST"])
def calculate():
    expression = request.json.get("expression", "")
    try:
        result = eval(expression, {"__builtins__": {}}, SAFE_NAMES)
        return jsonify({"result": str(result)})
    except ZeroDivisionError:
        return jsonify({"error": "Division by zero"})
    except Exception as exc:
        return jsonify({"error": str(exc)})

if __name__ == "__main__":
    app.run(debug=True)
