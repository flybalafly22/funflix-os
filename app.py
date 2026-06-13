import math
import os
import ssl
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
