import ast
import gzip as _gzip
import hashlib
import math
import os
import re
import secrets
import smtplib
import ssl
import threading
import time
from contextlib import contextmanager
from datetime import date, timedelta
from queue import Empty, Queue

from werkzeug.security import check_password_hash, generate_password_hash
import urllib.request
import urllib.error
from email.message import EmailMessage
import json as json_mod
import certifi
from google import genai
from google.genai import types
from flask import Flask, render_template, request, jsonify, Response, session, stream_with_context

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
# What people see when the AI can't run: plain words, no server internals (QA F9).
AI_OFF_MSG = "The AI coach is switched off on this server right now. Please try again later."
AI_BUSY_MSG = "The AI hit a problem on its side (not your answers). Please try again in a few minutes."
AI_LOAD_MSG = "The AI is busy right now. Please try again in a minute."
# Google retires model names over time (gemini-2.5-flash-lite stopped serving in 2026).
# The chain can be changed on Render without a deploy, e.g.
#   GEMINI_MODELS="gemini-2.5-flash,gemini-3.5-flash,gemini-3.5-flash-lite"
# A model that comes back "not found / no longer available" is skipped, not fatal.
GEMINI_MODELS = [m.strip() for m in (os.environ.get("GEMINI_MODELS") or
                 "gemini-2.5-flash,gemini-3.5-flash,gemini-3.5-flash-lite").split(",") if m.strip()]


def _model_gone(err):
    low = str(err).lower()
    return "404" in low or "not_found" in low or "not found" in low or "no longer available" in low


def _stream_with_fallback(make_stream, prefix="ERROR: "):
    """Stream text from the first configured model that exists. A retired model is
    skipped (only before anything was sent, so nothing repeats); every other failure
    ends in a plain sentence, never the provider's raw error text."""
    for i, model in enumerate(GEMINI_MODELS):
        sent = False
        try:
            for chunk in make_stream(model):
                if chunk.text:
                    sent = True
                    yield chunk.text
            return
        except Exception as exc:
            err = str(exc)
            low = err.lower()
            print(f"[ai] {model} failed: {err[:300]}", flush=True)
            if "api_key" in low or "api key" in low or "401" in low:
                yield prefix + AI_KEY_MSG
                return
            if not sent and _model_gone(err) and i < len(GEMINI_MODELS) - 1:
                continue
            if any(m in low for m in ("503", "unavailable", "high demand", "overloaded", "429", "resource_exhausted")):
                yield prefix + AI_LOAD_MSG
                return
            yield prefix + AI_BUSY_MSG
            return
AI_KEY_MSG = "The AI service turned this server away just now. Please try again later."
# Optional last-resort fallback for The Trainer when every Gemini attempt fails:
# an OpenAI-compatible call to Groq (independent infrastructure). Set on Render.
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = "llama-3.3-70b-versatile"

app = Flask(__name__)

# ════════ accounts & sync (optional, enabled when DATABASE_URL is set) ════════
DATABASE_URL = os.environ.get("DATABASE_URL", "")
if DATABASE_URL and "sslmode=" not in DATABASE_URL:
    DATABASE_URL += ("&" if "?" in DATABASE_URL else "?") + "sslmode=require"

# Stable across workers/restarts so sessions survive; set SECRET_KEY to rotate.
app.secret_key = os.environ.get("SECRET_KEY") or hashlib.sha256(
    ("funflix-trainer::" + (DATABASE_URL or "no-db")).encode()).hexdigest()
app.config.update(
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=bool(os.environ.get("RENDER")),
    PERMANENT_SESSION_LIFETIME=timedelta(days=90),
    # cap request bodies (largest legit payload is a ~1.3 MB combined sync) so a
    # multi-MB body can't be buffered as a memory-DoS lever (RED TEAM RT-3)
    MAX_CONTENT_LENGTH=3 * 1024 * 1024,
)


class PgStore:
    """Thin storage layer so tests can swap in a memory store."""

    def __init__(self, url):
        import psycopg2
        from psycopg2 import pool
        self._pg = psycopg2
        self.pool = pool.SimpleConnectionPool(1, 4, url)
        self._init()

    @contextmanager
    def _cur(self):
        conn = self.pool.getconn()
        try:
            cur = conn.cursor()
            try:
                yield conn, cur
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                cur.close()
        finally:
            self.pool.putconn(conn)

    def _init(self):
        with self._cur() as (conn, cur):
            cur.execute("""CREATE TABLE IF NOT EXISTS trainer_users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                pw_hash TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now())""")
            cur.execute("""CREATE TABLE IF NOT EXISTS trainer_blobs (
                user_id INTEGER REFERENCES trainer_users(id) ON DELETE CASCADE,
                kind TEXT NOT NULL,
                value JSONB NOT NULL,
                updated_at BIGINT NOT NULL,
                PRIMARY KEY (user_id, kind))""")
            cur.execute("""CREATE TABLE IF NOT EXISTS trainer_plan_history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES trainer_users(id) ON DELETE CASCADE,
                plan JSONB NOT NULL,
                saved_at BIGINT NOT NULL)""")

    def create_user(self, email, pw_hash):
        try:
            with self._cur() as (conn, cur):
                cur.execute("INSERT INTO trainer_users (email, pw_hash) VALUES (%s, %s) RETURNING id",
                            (email, pw_hash))
                return cur.fetchone()[0]
        except self._pg.IntegrityError:
            return None

    def get_user(self, email):
        with self._cur() as (conn, cur):
            cur.execute("SELECT id, pw_hash FROM trainer_users WHERE email = %s", (email,))
            return cur.fetchone()

    def get_email(self, uid):
        with self._cur() as (conn, cur):
            cur.execute("SELECT email FROM trainer_users WHERE id = %s", (uid,))
            row = cur.fetchone()
            return row[0] if row else None

    def set_password(self, uid, pw_hash):
        with self._cur() as (conn, cur):
            cur.execute("UPDATE trainer_users SET pw_hash = %s WHERE id = %s", (pw_hash, uid))
            return cur.rowcount > 0

    def put_blob(self, uid, kind, value, at):
        from psycopg2.extras import Json
        with self._cur() as (conn, cur):
            if kind == "plan":
                # a newer plan archives the one it replaces (per-user cap 10)
                cur.execute("SELECT value, updated_at FROM trainer_blobs WHERE user_id=%s AND kind='plan'", (uid,))
                row = cur.fetchone()
                if row and int(at) > row[1]:
                    cur.execute("INSERT INTO trainer_plan_history (user_id, plan, saved_at) VALUES (%s, %s, %s)",
                                (uid, Json(row[0]), row[1]))
                    cur.execute("""DELETE FROM trainer_plan_history WHERE user_id=%s AND id NOT IN (
                        SELECT id FROM trainer_plan_history WHERE user_id=%s
                        ORDER BY saved_at DESC LIMIT 10)""", (uid, uid))
            cur.execute("""INSERT INTO trainer_blobs (user_id, kind, value, updated_at)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (user_id, kind) DO UPDATE SET value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at
                WHERE trainer_blobs.updated_at <= EXCLUDED.updated_at""",
                        (uid, kind, Json(value), int(at)))

    def merge_blob(self, uid, kind, new_value, at, merge_fn):
        # read-merge-write under a row lock so two workers syncing the same user
        # concurrently serialize instead of losing one side's data.
        from psycopg2.extras import Json
        with self._cur() as (conn, cur):
            cur.execute("SELECT value, updated_at FROM trainer_blobs "
                        "WHERE user_id=%s AND kind=%s FOR UPDATE", (uid, kind))
            row = cur.fetchone()
            old_value, old_at = (row[0], row[1]) if row else (None, 0)
            merged = merge_fn(old_value, new_value)
            new_at = max(int(at), int(old_at or 0))
            cur.execute("""INSERT INTO trainer_blobs (user_id, kind, value, updated_at)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (user_id, kind) DO UPDATE SET value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at""",
                        (uid, kind, Json(merged), new_at))
            return merged

    def get_history(self, uid):
        with self._cur() as (conn, cur):
            cur.execute("""SELECT id, plan, saved_at FROM trainer_plan_history
                WHERE user_id=%s ORDER BY saved_at DESC""", (uid,))
            return [(i, p, at) for i, p, at in cur.fetchall()]

    def get_history_item(self, uid, hid):
        with self._cur() as (conn, cur):
            cur.execute("SELECT plan FROM trainer_plan_history WHERE user_id=%s AND id=%s", (uid, hid))
            row = cur.fetchone()
            return row[0] if row else None

    def get_blobs(self, uid):
        with self._cur() as (conn, cur):
            cur.execute("SELECT kind, value, updated_at FROM trainer_blobs WHERE user_id = %s", (uid,))
            return {k: {"value": v, "at": at} for k, v, at in cur.fetchall()}

    def get_account(self, uid):
        with self._cur() as (conn, cur):
            cur.execute("SELECT email, pw_hash, created_at FROM trainer_users WHERE id = %s", (uid,))
            row = cur.fetchone()
            if not row:
                return None
            return {"email": row[0], "pw_hash": row[1],
                    "since": row[2].isoformat() if row[2] else None}

    def delete_user(self, uid):
        # blobs + history rows go with the user via ON DELETE CASCADE
        with self._cur() as (conn, cur):
            cur.execute("DELETE FROM trainer_users WHERE id = %s", (uid,))
            return cur.rowcount > 0


STORE = None
if DATABASE_URL:
    try:
        STORE = PgStore(DATABASE_URL)
        print("[db] connected, accounts enabled", flush=True)
    except Exception as exc:
        print(f"[db] unavailable, accounts disabled: {exc}", flush=True)

# Precomputed supplement analysis (built offline by analysis/build_analysis_json.py).
# Loaded once at startup so production needs no pandas/sklearn.
_ANALYSIS_PATH = os.path.join(os.path.dirname(__file__), "data", "analysis.json")
try:
    with open(_ANALYSIS_PATH) as _f:
        ANALYSIS = json_mod.load(_f)
except FileNotFoundError:
    ANALYSIS = None

# ════════ Compute: a calculator that can only calculate ════════
# RED TEAM (2026-09-25): the old `eval(expr, {"__builtins__": {}}, ...)` was a sandbox
# in name only; attribute walks like ().__class__.__base__.__subclasses__() reached
# os.popen, i.e. remote code execution on a public route. Expressions are now parsed
# with `ast` and only numbers, arithmetic, brackets and a fixed list of math
# functions are allowed. Size guards stop 9**9**9-style denial of service.
_CALC_FUNCS = {
    "sin": math.sin, "cos": math.cos, "tan": math.tan, "asin": math.asin, "acos": math.acos,
    "atan": math.atan, "sinh": math.sinh, "cosh": math.cosh, "tanh": math.tanh,
    "log": math.log, "log2": math.log2, "log10": math.log10, "sqrt": math.sqrt, "exp": math.exp,
    "pow": math.pow, "factorial": math.factorial, "abs": abs, "fabs": math.fabs,
    "degrees": math.degrees, "radians": math.radians, "round": round,
    "floor": math.floor, "ceil": math.ceil, "hypot": math.hypot,
}
_CALC_CONSTS = {"pi": math.pi, "e": math.e, "tau": math.tau}
_CALC_BINOPS = {
    ast.Add: lambda a, b: a + b, ast.Sub: lambda a, b: a - b, ast.Mult: lambda a, b: a * b,
    ast.Div: lambda a, b: a / b, ast.FloorDiv: lambda a, b: a // b, ast.Mod: lambda a, b: a % b,
}
_CALC_MAX_LEN, _CALC_MAX_NODES, _CALC_MAX_ABS = 200, 120, 1e300


class CalcError(ValueError):
    """An expression the calculator refuses, with a message fit to show the user."""


def _calc_num(v):
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        raise CalcError("Only numbers, please")
    if isinstance(v, float) and (v != v):
        raise CalcError("Not a number")
    if abs(v) > _CALC_MAX_ABS:
        raise CalcError("Result too large")
    return v


def _calc_pow(a, b):
    # big integer powers are exact and slow; cap them, otherwise fall back to floats
    if abs(b) > 10000 or (isinstance(a, int) and isinstance(b, int) and b > 0 and abs(a) > 1
                          and b * math.log10(abs(a)) > 300):
        return _calc_num(math.pow(a, b))  # raises OverflowError past float range
    return _calc_num(a ** b)


def _calc_eval(node):
    if isinstance(node, ast.Expression):
        return _calc_eval(node.body)
    if isinstance(node, ast.Constant):
        return _calc_num(node.value)
    if isinstance(node, ast.Name):
        if node.id in _CALC_CONSTS:
            return _CALC_CONSTS[node.id]
        raise CalcError("Unknown name: " + node.id[:20])
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
        v = _calc_eval(node.operand)
        return v if isinstance(node.op, ast.UAdd) else -v
    if isinstance(node, ast.BinOp):
        a, b = _calc_eval(node.left), _calc_eval(node.right)
        if isinstance(node.op, ast.Pow):
            return _calc_pow(a, b)
        op = _CALC_BINOPS.get(type(node.op))
        if op is None:
            raise CalcError("That operator isn't supported")
        return _calc_num(op(a, b))
    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name) or node.func.id not in _CALC_FUNCS or node.keywords:
            raise CalcError("That function isn't supported")
        args = [_calc_eval(a) for a in node.args]
        name = node.func.id
        if name == "factorial":
            if len(args) != 1 or not float(args[0]).is_integer() or not 0 <= args[0] <= 170:
                raise CalcError("n! works for whole numbers from 0 to 170")
            return _calc_num(math.factorial(int(args[0])))
        if name == "pow":   # math.pow: float semantics, as the x^y key always had
            if len(args) != 2:
                raise CalcError("pow needs two numbers")
            return _calc_num(math.pow(args[0], args[1]))
        return _calc_num(_CALC_FUNCS[name](*args))
    raise CalcError("Only numbers, arithmetic and math functions are allowed")


def safe_calculate(expression):
    """Evaluate a calculator expression safely. Raises CalcError, ZeroDivisionError,
    OverflowError or ValueError (math domain) for anything it won't or can't compute."""
    expression = str(expression or "").strip()
    if not expression:
        raise CalcError("Enter an expression")
    if len(expression) > _CALC_MAX_LEN:
        raise CalcError("That expression is too long")
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError:
        raise CalcError("Check the expression")
    if sum(1 for _ in ast.walk(tree)) > _CALC_MAX_NODES:
        raise CalcError("That expression is too long")
    return _calc_eval(tree)

@app.route("/")
def index():
    # The Trainer is the front door (the Voice landing); the rest of the house
    # is one tap away from its nav, its Apps sheet and its footer.
    return render_template("home.html")

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
    topic = str(_req_json().get("topic", "") or "").strip()[:200]
    if not topic:
        return jsonify({"error": "Please enter a topic."}), 400

    api_key = GEMINI_API_KEY
    if not api_key:
        return jsonify({"error": AI_OFF_MSG}), 503

    prompt = (
        f"Search the internet for the latest news and information about: {topic}\n\n"
        f"Then write a compelling 4-paragraph news article about what you found. "
        f"Start with a punchy headline on its own line, then write the article. "
        f"Use clear, engaging journalistic language with key facts and context."
    )

    def generate():
        client = genai.Client(api_key=api_key)
        yield from _stream_with_fallback(lambda model: client.models.generate_content_stream(
            model=model, contents=prompt,
            config=types.GenerateContentConfig(tools=[types.Tool(google_search=types.GoogleSearch())])))

    return Response(stream_with_context(generate()), mimetype="text/plain")

# ════════ The Study, supplement bio-analytics dashboard + AI analyst ════════
@app.route("/study")
def study():
    return render_template("lab.html")


@app.route("/api/analysis-data")
def analysis_data():
    if ANALYSIS is None:
        return jsonify({"error": "analysis.json not found. Run analysis/build_analysis_json.py"}), 500
    # Everything the dashboard needs; the heavy 'digest' is server-side only.
    out = {k: v for k, v in ANALYSIS.items() if k != "digest"}
    out["analyst_ready"] = bool(GEMINI_API_KEY)
    return jsonify(out)


ANALYST_SYSTEM = """You are 'The Analyst', a precise, friendly data analyst embedded in the FUNFLIX \
Study dashboard. You help users understand a supplement-impact analysis through back-and-forth conversation.

Use ONLY the dataset facts and findings below. If a question cannot be answered from them, say so plainly \
and suggest what the data CAN tell them. Never invent numbers; quote the figures given. This is SYNTHETIC \
data for analysis practice, so frame insights as patterns in the dataset, not medical advice.

Be conversational and concise: 2-4 short paragraphs or a tight bulleted list. Explain what numbers MEAN \
(e.g. why a low coefficient of variation signals consistency, why a near-zero correlation means a factor \
does not matter), not just what they are. Plain text only: no markdown headers or tables, no em-dashes.

==== ANALYSIS BRIEF ====
{digest}
==== END BRIEF ===="""


@app.route("/api/analyst", methods=["POST"])
def analyst_api():
    if ANALYSIS is None:
        return jsonify({"error": "Analysis data is unavailable on the server."}), 500

    payload = _req_json()
    messages = payload.get("messages", [])
    if not isinstance(messages, list) or not messages:
        return jsonify({"error": "Please ask a question."}), 400
    if not any(isinstance(m, dict) and m.get("role") == "user" for m in messages):
        return jsonify({"error": "Please ask a question."}), 400

    api_key = GEMINI_API_KEY
    if not api_key:
        return jsonify({"error": AI_OFF_MSG}), 503

    # Build Gemini conversation contents from the client-side history (cap to last 12 turns).
    contents = []
    for m in messages[-12:]:
        if not isinstance(m, dict):
            continue
        role = "model" if m.get("role") == "assistant" else "user"
        text = (m.get("content") or "").strip()
        if text:
            contents.append(types.Content(role=role, parts=[types.Part(text=text)]))
    if not contents:
        return jsonify({"error": "Please ask a question."}), 400

    system_instruction = ANALYST_SYSTEM.format(digest=ANALYSIS["digest"])

    def generate():
        client = genai.Client(api_key=api_key)
        yield from _stream_with_fallback(lambda model: client.models.generate_content_stream(
            model=model, contents=contents,
            config=types.GenerateContentConfig(system_instruction=system_instruction, temperature=0.4)))

    return Response(stream_with_context(generate()), mimetype="text/plain")


# ════════ The Trainer, evidence-based training + nutrition plans ════════
_TRAINER_DEMO_PATH = os.path.join(os.path.dirname(__file__), "data", "trainer_demo.json")
try:
    with open(_TRAINER_DEMO_PATH) as _f:
        TRAINER_DEMO = json_mod.load(_f)
except FileNotFoundError:
    TRAINER_DEMO = None

# a second sample (?demo=cut): a female fat-loss program, so the "see a sample"
# door speaks to cutters too, and shows off concrete starting loads
_TRAINER_DEMO_CUT_PATH = os.path.join(os.path.dirname(__file__), "data", "trainer_demo_cut.json")
try:
    with open(_TRAINER_DEMO_CUT_PATH) as _f:
        TRAINER_DEMO_CUT = json_mod.load(_f)
except FileNotFoundError:
    TRAINER_DEMO_CUT = None

TRAINER_SYSTEM = ""  # populated below (see data/trainer_system.txt)
_TRAINER_SYS_PATH = os.path.join(os.path.dirname(__file__), "data", "trainer_system.txt")
try:
    with open(_TRAINER_SYS_PATH) as _f:
        TRAINER_SYSTEM = _f.read()
except FileNotFoundError:
    TRAINER_SYSTEM = ""

# Condensed prompt for the Groq fallback: its free tier caps prompt+completion
# around 12k tokens/min, which the full prompt alone nearly exhausts.
TRAINER_SYSTEM_COMPACT = ""
_TRAINER_SYS_COMPACT_PATH = os.path.join(os.path.dirname(__file__), "data", "trainer_system_compact.txt")
try:
    with open(_TRAINER_SYS_COMPACT_PATH) as _f:
        TRAINER_SYSTEM_COMPACT = _f.read()
except FileNotFoundError:
    TRAINER_SYSTEM_COMPACT = ""


# Per-IP sliding-window rate limit for real plan generations (demo is exempt).
# Protects the Gemini quota if the site gets real traffic. In-memory per worker
# (2 workers → effective ceiling up to 2x the number below; fine at this scale).
TRAINER_RL_MAX = int(os.environ.get("TRAINER_RL_MAX", "6"))
TRAINER_RL_WINDOW_S = 3600
# hard ceiling on distinct rate-limit keys, so an X-Forwarded-For IP-rotation
# flood can't grow the map without bound (memory-DoS, RED TEAM watch-list).
_RL_MAX_KEYS = 5000
_trainer_hits = {}
_trainer_rl_lock = threading.Lock()


def _client_ip():
    fwd = request.headers.get("X-Forwarded-For", "")
    return (fwd.split(",")[0].strip() if fwd else request.remote_addr) or ""


def _rate_limited(ip, bucket="plan", limit=None):
    # Exemption is gated on the REAL TCP peer (request.remote_addr, a client
    # cannot spoof it), NOT the X-Forwarded-For-derived `ip`. Otherwise sending
    # "X-Forwarded-For: 127.0.0.1" would hit the loopback exemption and disable
    # every limit (RED TEAM RT-1). Local dev + the test suite connect from
    # loopback and stay exempt; behind Render the peer is the proxy, never
    # loopback, so real traffic is always limited.
    if request.remote_addr in ("127.0.0.1", "::1", None, ""):
        return False
    if not ip:
        ip = request.remote_addr or "unknown"
    limit = limit or TRAINER_RL_MAX
    key = f"{bucket}|{ip}"
    now = time.time()
    with _trainer_rl_lock:
        # bound memory: once the map is large, sweep out keys whose hits are all
        # stale; if it's still at the ceiling and this key is new, don't grow it
        # (fail open for a brand-new IP, the per-account limit still guards the
        # actual brute-force target).
        if len(_trainer_hits) > _RL_MAX_KEYS:
            for k in list(_trainer_hits.keys()):
                fresh = [t for t in _trainer_hits[k] if now - t < TRAINER_RL_WINDOW_S]
                if fresh:
                    _trainer_hits[k] = fresh
                else:
                    del _trainer_hits[k]
            if len(_trainer_hits) >= _RL_MAX_KEYS and key not in _trainer_hits:
                return False
        hits = [t for t in _trainer_hits.get(key, []) if now - t < TRAINER_RL_WINDOW_S]
        if len(hits) >= limit:
            _trainer_hits[key] = hits
            return True
        hits.append(now)
        _trainer_hits[key] = hits
        return False


# per-account auth limit: an attacker rotating X-Forwarded-For gets a fresh
# per-IP bucket each request, so a per-IP cap alone can't stop a distributed
# password brute-force against ONE account. Keying on the email caps guesses per
# targeted account regardless of source IP. Kept generous (a real user's typos
# never reach it) so a malicious login flood can at worst lock one account for an
# hour, never the whole site, while still capping guesses far below what any
# 8+ char password needs.
AUTH_ACCT_LIMIT = 20


def _rate_limited_account(email, limit=AUTH_ACCT_LIMIT):
    return bool(email) and _rate_limited("acct:" + email, bucket="authacct", limit=limit)


def _req_json():
    # a JSON body that isn't an object (a list, string, number, or malformed) must
    # not reach `.get(...)` and 500 the endpoint, coerce it to an empty dict.
    j = request.get_json(silent=True)
    return j if isinstance(j, dict) else {}


_EMAIL_RE = re.compile(r"^[^@\s<>\"'`]+@[^@\s<>\"'`]+\.[^@\s<>\"'`]+$")


def _uid():
    return session.get("uid") if STORE else None


@app.route("/api/auth/me")
def auth_me():
    uid = _uid()
    return jsonify({"enabled": STORE is not None,
                    "user": STORE.get_email(uid) if uid else None})


# ── transactional email: account-creation OTP + password-reset codes ──
# Two $0 providers, no paid plan and no owned domain required:
#   1. Gmail SMTP (preferred), stdlib smtplib, sends to ANY recipient, ~500/day
#      free. Needs GMAIL_USER + GMAIL_APP_PASSWORD (a 16-char Google app password;
#      requires 2-Step Verification on the Google account). This is the path that
#      lets real strangers verify, no domain to buy.
#   2. Resend HTTP API (fallback), free tier, but its default onboarding@resend.dev
#      sender only reaches the Resend account owner until a domain is verified.
# Email is ENFORCED only when at least one provider is configured; with neither,
# signup falls back to direct (the product is never bricked). Gmail is tried
# first; Resend is a backstop if Gmail send fails and a key is present.
_RESEND_KEY = os.environ.get("RESEND_API_KEY", "")
_GMAIL_USER = os.environ.get("GMAIL_USER", "").strip()
# app passwords are displayed grouped as "abcd efgh ijkl mnop", tolerate spaces
_GMAIL_PW = os.environ.get("GMAIL_APP_PASSWORD", "").replace(" ", "")
_MAIL_FROM = os.environ.get("MAIL_FROM", "The Trainer <onboarding@resend.dev>")


def _gmail_configured():
    return bool(_GMAIL_USER and _GMAIL_PW)


def _mail_configured():
    return _gmail_configured() or bool(_RESEND_KEY)


def _smtp_from():
    # Gmail rewrites the From to the authenticated account, so keep the address
    # equal to GMAIL_USER; a display name is still honoured.
    return "The Trainer <%s>" % _GMAIL_USER


_last_mail_err = ""


def _send_via_gmail(to, subject, html):
    global _last_mail_err
    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = _smtp_from()
        msg["To"] = to
        msg.set_content("Your code is in this message. Open it in an "
                        "HTML-capable email client to view it.")
        msg.add_alternative(html, subtype="html")
        ctx = ssl.create_default_context(cafile=certifi.where())
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as s:
            s.ehlo()
            s.starttls(context=ctx)
            s.ehlo()
            s.login(_GMAIL_USER, _GMAIL_PW)
            s.send_message(msg)
        return True
    except Exception as e:
        _last_mail_err = ("smtp " + type(e).__name__ + ": " + str(e))[:300]
        return False


def _send_via_resend(to, subject, html):
    global _last_mail_err
    try:
        body = json_mod.dumps({"from": _MAIL_FROM, "to": [to], "subject": subject, "html": html}).encode()
        # Resend's API is behind Cloudflare, which blocks the default urllib
        # User-Agent with "error code: 1010". A normal UA (like curl/SDKs send)
        # clears it.
        req = urllib.request.Request("https://api.resend.com/emails", data=body, headers={
            "Authorization": "Bearer " + _RESEND_KEY, "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; TheTrainer/1.0; +https://funflix-os.onrender.com)"})
        ctx = ssl.create_default_context(cafile=certifi.where())
        with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
            return 200 <= r.status < 300
    except urllib.error.HTTPError as e:
        try:
            _last_mail_err = "HTTP %s: %s" % (e.code, (e.read() or b"").decode("utf-8", "replace")[:400])
        except Exception:
            _last_mail_err = "HTTP %s" % getattr(e, "code", "?")
        return False
    except Exception as e:
        _last_mail_err = (type(e).__name__ + ": " + str(e))[:300]
        return False


def _send_email(to, subject, html):
    global _last_mail_err
    _last_mail_err = ""
    # Gmail first, it reaches any recipient for free. Fall through to Resend
    # only if Gmail isn't configured or its send failed and a key exists.
    if _gmail_configured():
        if _send_via_gmail(to, subject, html):
            return True
    if _RESEND_KEY:
        return _send_via_resend(to, subject, html)
    if not _last_mail_err:
        _last_mail_err = "no mail provider configured"
    return False


def _otp_email_html(code):
    return ("<div style=\"font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:440px;"
            "margin:0 auto;padding:8px\"><p style=\"font-size:15px;color:#0B0F2E\">Welcome to <b>The Trainer</b>.</p>"
            "<p style=\"font-size:14px;color:#2D314B\">Your verification code is:</p>"
            "<p style=\"font-size:30px;letter-spacing:8px;font-weight:700;color:#2B3BFF;margin:12px 0\">" + code + "</p>"
            "<p style=\"font-size:12.5px;color:#5B5F7B\">It expires in 10 minutes. If you didn't request this, ignore this email: "
            "no account is created until the code is entered.</p></div>")


def _otp_reset_html(code):
    return ("<div style=\"font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:440px;"
            "margin:0 auto;padding:8px\"><p style=\"font-size:15px;color:#0B0F2E\">Reset your <b>The Trainer</b> password.</p>"
            "<p style=\"font-size:14px;color:#2D314B\">Enter this code to set a new password:</p>"
            "<p style=\"font-size:30px;letter-spacing:8px;font-weight:700;color:#2B3BFF;margin:12px 0\">" + code + "</p>"
            "<p style=\"font-size:12.5px;color:#5B5F7B\">It expires in 10 minutes. If you didn't request this, ignore this "
            "email: your password stays unchanged.</p></div>")


# Cap the password length we ever hash. Werkzeug's KDF processes the whole
# input, so an unbounded password is a CPU-DoS lever; 128 is far above any real
# password. Enforced wherever a password is SET (register, reset). At sign-in we
# guard at a higher ceiling so no conceivable existing password is locked out.
_PW_MAX = 128
_PW_LOGIN_CEILING = 1024


def _valid_reg(p):
    email = str(p.get("email", "")).strip().lower()
    pw = str(p.get("password", ""))
    if not _EMAIL_RE.match(email):
        return None, None, ("That doesn't look like an email address.", 400)
    if len(pw) < 8:
        return None, None, ("Password needs at least 8 characters.", 400)
    if len(pw) > _PW_MAX:
        return None, None, ("Password can be at most %d characters." % _PW_MAX, 400)
    return email, pw, None


@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    # direct signup, the no-mail fallback, and what the test suite exercises.
    # When email verification IS configured, this path is closed: clients must
    # use the start/verify OTP flow so every account maps to a verified inbox.
    if STORE is None:
        return jsonify({"error": "Accounts are not enabled on this server."}), 503
    if _mail_configured():
        return jsonify({"error": "Email verification is required. Request a code to create your account."}), 400
    if _rate_limited(_client_ip(), bucket="auth", limit=10):
        return jsonify({"error": "Too many attempts. Try again in a while."}), 429
    email, pw, err = _valid_reg(_req_json())
    if err:
        return jsonify({"error": err[0]}), err[1]
    uid = STORE.create_user(email, generate_password_hash(pw))
    if uid is None:
        return jsonify({"error": "That email already has an account. Sign in instead."}), 409
    session.permanent = True
    session["uid"] = uid
    return jsonify({"user": email})


@app.route("/api/auth/register/start", methods=["POST"])
def auth_register_start():
    if STORE is None:
        return jsonify({"error": "Accounts are not enabled on this server."}), 503
    if _rate_limited(_client_ip(), bucket="auth", limit=10):
        return jsonify({"error": "Too many attempts. Try again in a while."}), 429
    email, pw, err = _valid_reg(_req_json())
    if err:
        return jsonify({"error": err[0]}), err[1]
    if STORE.get_user(email):
        return jsonify({"error": "That email already has an account. Sign in instead."}), 409
    if not _mail_configured():
        # no mail provider → don't brick signup; create the account directly
        uid = STORE.create_user(email, generate_password_hash(pw))
        if uid is None:
            return jsonify({"error": "That email already has an account. Sign in instead."}), 409
        session.permanent = True
        session["uid"] = uid
        return jsonify({"user": email, "otp": False})
    code = "%06d" % secrets.randbelow(1_000_000)
    session.permanent = True
    session["preg"] = {"email": email, "pwh": generate_password_hash(pw),
                       "ch": generate_password_hash(code), "exp": int(time.time()) + 600, "n": 0}
    if not _send_email(email, "Your Trainer verification code", _otp_email_html(code)):
        session.pop("preg", None)
        # the reason is captured in _last_mail_err for server-side diagnosis; not
        # exposed to the caller (could reveal provider internals)
        return jsonify({"error": "Couldn't send the verification email just now. Please try again."}), 502
    return jsonify({"otp": True, "email": email})


@app.route("/api/auth/register/verify", methods=["POST"])
def auth_register_verify():
    if STORE is None:
        return jsonify({"error": "Accounts are not enabled on this server."}), 503
    if _rate_limited(_client_ip(), bucket="auth", limit=10):
        return jsonify({"error": "Too many attempts. Try again in a while."}), 429
    preg = session.get("preg")
    if not isinstance(preg, dict) or preg.get("exp", 0) < int(time.time()):
        session.pop("preg", None)
        return jsonify({"error": "That code expired. Start again to get a new one."}), 400
    if preg.get("n", 0) >= 6:
        session.pop("preg", None)
        return jsonify({"error": "Too many wrong codes. Start again."}), 429
    preg["n"] = preg.get("n", 0) + 1
    session["preg"] = preg
    code = str((_req_json()).get("code", "")).strip()
    if not code or not check_password_hash(preg["ch"], code):
        return jsonify({"error": "That code isn't right. Check the email and try again."}), 400
    uid = STORE.create_user(preg["email"], preg["pwh"])
    if uid is None:
        session.pop("preg", None)
        return jsonify({"error": "That email already has an account. Sign in instead."}), 409
    session.pop("preg", None)
    session.permanent = True
    session["uid"] = uid
    return jsonify({"user": preg["email"]})


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    if STORE is None:
        return jsonify({"error": "Accounts are not enabled on this server."}), 503
    if _rate_limited(_client_ip(), bucket="auth", limit=10):
        return jsonify({"error": "Too many attempts. Try again in a while."}), 429
    p = _req_json()
    email = str(p.get("email", "")).strip().lower()
    pw = str(p.get("password", ""))
    # per-account cap so an X-Forwarded-For IP-rotation flood can't brute-force
    # one account past the per-IP limit
    if _rate_limited_account(email):
        return jsonify({"error": "Too many sign-in attempts for this account. Try again in a while."}), 429
    row = STORE.get_user(email)
    # length guard before the (expensive) KDF: no real password is this long, so
    # reject rather than burn CPU hashing an attacker's megabyte string
    if len(pw) > _PW_LOGIN_CEILING or not row or not check_password_hash(row[1], pw):
        return jsonify({"error": "Email or password is wrong."}), 401
    session.permanent = True
    session["uid"] = row[0]
    return jsonify({"user": email})


@app.route("/api/auth/reset/start", methods=["POST"])
def auth_reset_start():
    # forgot-password: emails a one-time code to the account's inbox. Needs a
    # configured mail provider (Gmail SMTP or Resend, see EMAIL_SETUP.md).
    if STORE is None:
        return jsonify({"error": "Accounts are not enabled on this server."}), 503
    if _rate_limited(_client_ip(), bucket="auth", limit=10):
        return jsonify({"error": "Too many attempts. Try again in a while."}), 429
    if not _mail_configured():
        # a global capability fact, not a per-email answer → no enumeration leak
        return jsonify({"error": "Password reset by email isn't set up on this server yet."}), 503
    email = str((_req_json()).get("email", "")).strip().lower()
    if not _EMAIL_RE.match(email):
        return jsonify({"error": "That doesn't look like an email address."}), 400
    # per-account cap so IP rotation can't spam a victim's inbox with reset codes
    # (checked before the existence lookup so it doesn't leak whether they exist)
    if _rate_limited_account(email):
        return jsonify({"error": "Too many reset requests for this account. Try again in a while."}), 429
    row = STORE.get_user(email)
    # anti-enumeration: identical success response whether or not the account
    # exists; only arm the session + send when it actually does.
    if row:
        code = "%06d" % secrets.randbelow(1_000_000)
        session.permanent = True
        session["pwr"] = {"uid": row[0], "email": email,
                          "ch": generate_password_hash(code),
                          "exp": int(time.time()) + 600, "n": 0}
        if not _send_email(email, "Your Trainer password-reset code", _otp_reset_html(code)):
            session.pop("pwr", None)
            return jsonify({"error": "Couldn't send the reset email just now. Please try again."}), 502
    else:
        session.pop("pwr", None)
    return jsonify({"ok": True, "email": email})


@app.route("/api/auth/reset/verify", methods=["POST"])
def auth_reset_verify():
    if STORE is None:
        return jsonify({"error": "Accounts are not enabled on this server."}), 503
    if _rate_limited(_client_ip(), bucket="auth", limit=10):
        return jsonify({"error": "Too many attempts. Try again in a while."}), 429
    pwr = session.get("pwr")
    if not isinstance(pwr, dict) or pwr.get("exp", 0) < int(time.time()):
        session.pop("pwr", None)
        return jsonify({"error": "That code expired. Start again to get a new one."}), 400
    if pwr.get("n", 0) >= 6:
        session.pop("pwr", None)
        return jsonify({"error": "Too many wrong codes. Start again."}), 429
    pwr["n"] = pwr.get("n", 0) + 1
    session["pwr"] = pwr
    p = _req_json()
    code = str(p.get("code", "")).strip()
    pw = str(p.get("password", ""))
    if not code or not check_password_hash(pwr["ch"], code):
        return jsonify({"error": "That code isn't right. Check the email and try again."}), 400
    if len(pw) < 8:
        return jsonify({"error": "Password needs at least 8 characters."}), 400
    if len(pw) > _PW_MAX:
        return jsonify({"error": "Password can be at most %d characters." % _PW_MAX}), 400
    if not STORE.set_password(pwr["uid"], generate_password_hash(pw)):
        session.pop("pwr", None)
        return jsonify({"error": "That account no longer exists."}), 404
    session.pop("pwr", None)
    session.permanent = True
    session["uid"] = pwr["uid"]   # a successful reset signs them straight in
    return jsonify({"user": pwr["email"]})


@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    session.clear()
    return jsonify({"ok": True})


def _sig_session(s):
    # a session's identity for de-dupe/merge: its timestamp + day + a signature of
    # its sets. Using entries (not just `at`) means two DIFFERENT sessions backdated
    # to the same day, both get noon-of-day as `at`, stay distinct instead of one
    # clobbering the other (SIMULATION "same-day backdated collision"); an identical
    # session synced twice dedupes.
    try:
        return (int(s.get("at", 0)), str(s.get("day", "")),
                json_mod.dumps(s.get("entries", []), sort_keys=True))
    except Exception:
        return (0, "", "")


def _merge_logs(old, new):
    # union of two log lists so two devices that pull→append→push concurrently
    # don't overwrite each other (RED TEAM lost-update race). Newest first, capped.
    seen = {}
    for s in (old or []) + (new or []):
        if isinstance(s, dict):
            seen.setdefault(_sig_session(s), s)
    out = sorted(seen.values(), key=lambda s: s.get("at", 0) if isinstance(s, dict) else 0,
                 reverse=True)
    return out[:400]   # matches the client LOG_CAP


def _merge_weights(old, new):
    # one weigh-in per calendar day; union by date, incoming wins a same-day tie
    by_date = {}
    for w in (old or []):
        if isinstance(w, dict) and w.get("d"):
            by_date[w["d"]] = w
    for w in (new or []):
        if isinstance(w, dict) and w.get("d"):
            by_date[w["d"]] = w
    return sorted(by_date.values(), key=lambda w: w.get("d", ""))


_MERGE_FNS = {"logs": _merge_logs, "weights": _merge_weights}


@app.route("/api/sync", methods=["GET", "PUT"])
def sync():
    if STORE is None:
        return jsonify({"error": "Accounts are not enabled on this server."}), 503
    uid = _uid()
    if not uid:
        return jsonify({"error": "Sign in to sync."}), 401
    if request.method == "GET":
        blobs = STORE.get_blobs(uid)
        return jsonify({"plan": blobs.get("plan"), "logs": blobs.get("logs"),
                        "weights": blobs.get("weights")})
    p = request.json if isinstance(request.json, dict) else {}
    now_ms = int(time.time() * 1000)
    for kind, cap in (("plan", 300_000), ("logs", 800_000), ("weights", 200_000)):
        item = p.get(kind)
        if not isinstance(item, dict) or "value" not in item:
            continue
        if len(json_mod.dumps(item["value"])) > cap:
            return jsonify({"error": f"{kind} too large to sync."}), 413
        # coerce + clamp the client-supplied timestamp: a non-numeric value must
        # not 500 (RT-5) and a far-future value must not pin updated_at and
        # freeze all later syncs (RT-4); never trust it beyond ~1 day ahead
        try:
            at = int(item.get("at") or now_ms)
        except (ValueError, TypeError):
            at = now_ms
        at = max(0, min(at, now_ms + 86_400_000))
        # logs/weights union-merge server-side (concurrent devices don't clobber);
        # plan stays newer-wins (single object, drives history archiving)
        if kind in _MERGE_FNS:
            STORE.merge_blob(uid, kind, item["value"], at, _MERGE_FNS[kind])
        else:
            STORE.put_blob(uid, kind, item["value"], at)
    blobs = STORE.get_blobs(uid)
    return jsonify({"plan_at": (blobs.get("plan") or {}).get("at"),
                    "logs_at": (blobs.get("logs") or {}).get("at"),
                    "weights_at": (blobs.get("weights") or {}).get("at")})


@app.route("/api/history")
def history_list():
    if STORE is None:
        return jsonify({"error": "Accounts are not enabled on this server."}), 503
    uid = _uid()
    if not uid:
        return jsonify({"error": "Sign in to see your history."}), 401
    out = []
    for hid, plan, at in STORE.get_history(uid):
        ps = plan.get("profile_summary") or {}
        out.append({"id": hid, "at": at, "goal": ps.get("goal") or "Program",
                    "kcal": (plan.get("diet_plan") or {}).get("calorie_target_kcal"),
                    "days": len(plan.get("workout_days") or [])})
    return jsonify({"history": out})


@app.route("/api/history/<int:hid>")
def history_item(hid):
    if STORE is None:
        return jsonify({"error": "Accounts are not enabled on this server."}), 503
    uid = _uid()
    if not uid:
        return jsonify({"error": "Sign in to see your history."}), 401
    plan = STORE.get_history_item(uid, hid)
    if plan is None:
        return jsonify({"error": "Not found."}), 404
    return jsonify({"plan": plan})


@app.route("/api/profile")
def profile():
    if STORE is None:
        return jsonify({"error": "Accounts are not enabled on this server."}), 503
    uid = _uid()
    if not uid:
        return jsonify({"error": "Sign in to see your profile."}), 401
    acct = STORE.get_account(uid)
    if not acct:
        session.clear()
        return jsonify({"error": "Sign in to see your profile."}), 401
    blobs = STORE.get_blobs(uid)
    logs = (blobs.get("logs") or {}).get("value")
    return jsonify({"user": acct["email"], "since": acct["since"],
                    "plan_at": (blobs.get("plan") or {}).get("at"),
                    "logs_n": len(logs) if isinstance(logs, list) else 0,
                    "history_n": len(STORE.get_history(uid))})


@app.route("/api/export")
def export_data():
    if STORE is None:
        return jsonify({"error": "Accounts are not enabled on this server."}), 503
    uid = _uid()
    if not uid:
        return jsonify({"error": "Sign in to export your data."}), 401
    acct = STORE.get_account(uid)
    if not acct:
        session.clear()
        return jsonify({"error": "Sign in to export your data."}), 401
    blobs = STORE.get_blobs(uid)
    doc = {"format": "the-trainer/export-1",
           "exported_at": int(time.time() * 1000),
           "account": {"email": acct["email"], "since": acct["since"]},
           "plan": blobs.get("plan"),
           "logs": blobs.get("logs"),
           "weights": blobs.get("weights"),
           "history": [{"id": hid, "saved_at": at, "plan": plan}
                       for hid, plan, at in STORE.get_history(uid)]}
    resp = jsonify(doc)
    resp.headers["Content-Disposition"] = 'attachment; filename="the-trainer-export.json"'
    return resp


@app.route("/api/auth/delete", methods=["POST"])
def auth_delete():
    if STORE is None:
        return jsonify({"error": "Accounts are not enabled on this server."}), 503
    if _rate_limited(_client_ip(), bucket="auth", limit=10):
        return jsonify({"error": "Too many attempts. Try again in a while."}), 429
    uid = _uid()
    if not uid:
        return jsonify({"error": "Sign in first."}), 401
    acct = STORE.get_account(uid)
    pw = str((_req_json()).get("password", ""))
    if not acct or not check_password_hash(acct["pw_hash"], pw):
        return jsonify({"error": "Password is wrong, so the account was not deleted."}), 401
    STORE.delete_user(uid)
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/version")
def version():
    # Render sets RENDER_GIT_COMMIT; lets us verify which commit is actually live.
    return jsonify({"commit": os.environ.get("RENDER_GIT_COMMIT", "dev")[:7]})


@app.route("/trainer")
def trainer():
    # the privacy copy names every provider that can actually receive a plan request
    return render_template("trainer.html", backup_ai=bool(GROQ_API_KEY))


@app.route("/favicon.ico")
def favicon():
    return app.send_static_file("trainer/icon-192.png")


@app.route("/trainer-sw.js")
def trainer_sw():
    # The service worker must be served from a root-level path so its scope
    # can cover /trainer (a worker under /static/ could only control /static/).
    return app.send_static_file("trainer/sw.js")


_ALLERGEN_STOP = {"none", "nothing", "known", "food", "mild", "severe", "and", "the",
                  "any", "all", "nil", "free", "allergy", "allergies", "intolerance",
                  "excluded", "avoids", "avoid", "reported", "were", "been", "have",
                  "not", "has", "with", "this", "plan"}


# A category word must check every food in the category: "dairy" has to catch whey,
# yogurt and paneer, not just the literal word (content audit F-25, 2026-09-25).
_DAIRY = {"milk", "whey", "casein", "yogurt", "yoghurt", "cheese", "paneer", "butter",
          "ghee", "cream", "curd", "lactose", "kefir", "dairy", "skyr", "quark"}
_GLUTEN = {"wheat", "bread", "roti", "chapati", "naan", "paratha", "pasta", "couscous",
           "seitan", "barley", "rye", "semolina", "noodle", "bagel", "cracker", "gluten"}
_TREE_NUTS = {"almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "brazil",
              "macadamia", "nut"}
_FISH = {"fish", "salmon", "tuna", "cod", "tilapia", "sardine", "mackerel", "anchovy",
         "trout", "haddock", "pollock"}
_ALLERGEN_FAMILIES = {
    "dairy": _DAIRY, "milk": _DAIRY, "lactose": _DAIRY, "whey": _DAIRY | {"whey"},
    "egg": {"egg", "mayonnaise", "mayo", "albumen", "meringue", "omelette", "omelet"},
    "nut": _TREE_NUTS | {"peanut", "groundnut"}, "tree": _TREE_NUTS,
    "peanut": {"peanut", "groundnut"}, "groundnut": {"peanut", "groundnut"},
    "shellfish": {"shellfish", "shrimp", "prawn", "crab", "lobster", "scallop", "mussel",
                  "clam", "oyster", "crayfish"},
    "fish": _FISH, "seafood": _FISH | {"shrimp", "prawn", "crab", "lobster", "scallop",
                                        "mussel", "clam", "oyster"},
    "soy": {"soy", "soya", "tofu", "tempeh", "edamame", "miso"},
    "soya": {"soy", "soya", "tofu", "tempeh", "edamame", "miso"},
    "gluten": _GLUTEN, "wheat": _GLUTEN, "coeliac": _GLUTEN, "celiac": _GLUTEN,
    "sesame": {"sesame", "tahini"},
}


def _allergen_tokens(s):
    """Allergen words from a free-text string (intake allergies OR a plan's
    allergy_note). len>=3 keeps egg/soy/nut/fish; trailing 's' stemmed so the
    word-boundary scan catches singular and plural."""
    return {(w[:-1] if w.endswith("s") and len(w) > 3 else w)
            for w in re.split(r"[^a-z]+", str(s).lower())
            if len(w) >= 3 and w not in _ALLERGEN_STOP}


def _allergen_scan_words(s):
    """The intake's allergen words, each widened to its whole food family."""
    words = set()
    for w in _allergen_tokens(s):
        words |= _ALLERGEN_FAMILIES.get(w, {w})
    return words


def _plan_strings(o):
    if isinstance(o, dict):
        for v in o.values():
            yield from _plan_strings(v)
    elif isinstance(o, list):
        for v in o:
            yield from _plan_strings(v)
    elif isinstance(o, str):
        yield o


UNDER_18_MSG = ("The Trainer is for adults 18 and over. If you're younger, the right call is a "
                "qualified coach in person, with a parent or guardian in the loop.")


def _age_from_dob(dob):
    """Whole years from an ISO date string ('YYYY-MM-DD'); None if it isn't one."""
    m = re.match(r"^\s*(\d{4})-(\d{2})-(\d{2})", str(dob or ""))
    if not m:
        return None
    try:
        born = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None
    today = date.today()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


def _validate_plan(data, intake=None):
    """Quality gate beyond "parses as JSON with a type field". Returns the list
    of failed check names; empty = usable. Tolerances sit looser than the
    prompt's own promises (3% macro math vs its 2%, 7% sample-day vs its 5%)
    so borderline-honest output is not rejected; this catches the skeleton
    plans, broken arithmetic and allergen slips that used to ship."""
    if not isinstance(data, dict):
        return ["not_object"]
    t = data.get("type")
    if t == "questions":
        qs = data.get("questions")
        ok = (isinstance(qs, list) and 1 <= len(qs) <= 4 and all(
            (isinstance(q, str) and q.strip()) or
            (isinstance(q, dict) and str(q.get("question", "")).strip())
            for q in qs))
        return [] if ok else ["questions_shape"]
    if t != "plan":
        return ["type"]
    fails = []
    days = data.get("workout_days")
    if not (isinstance(days, list) and days):
        fails.append("no_workout_days")
    else:
        for d in days:
            exs = d.get("exercises") if isinstance(d, dict) else None
            if not (isinstance(exs, list) and len(exs) >= 3):
                fails.append("thin_day")
                break
            if not all(isinstance(x, dict) and isinstance(x.get("sets"), (int, float))
                       and isinstance(x.get("rest_seconds"), (int, float)) for x in exs):
                fails.append("non_numeric_sets")
                break
    dp = data.get("diet_plan")
    if not isinstance(dp, dict):
        fails.append("no_diet_plan")
        dp = {}
    kcal = dp.get("calorie_target_kcal")
    p, c, f = dp.get("protein_g"), dp.get("carbs_g"), dp.get("fat_g")
    if all(isinstance(v, (int, float)) and v > 0 for v in (kcal, p, c, f)):
        if abs(p * 4 + c * 4 + f * 9 - kcal) > 0.03 * kcal:
            fails.append("macro_math")
    else:
        fails.append("missing_macros")
    tot = dp.get("sample_day_totals")
    if isinstance(tot, dict) and isinstance(kcal, (int, float)) and kcal:
        ak = tot.get("approx_calories")
        if isinstance(ak, (int, float)) and abs(ak - kcal) > 0.07 * kcal:
            fails.append("sample_day_totals_off")
    for s in _plan_strings(data):
        if "\n" in s or "**" in s or "##" in s or "```" in s:
            fails.append("markdown_or_newline")
            break
    # banned filler phrases carry no instruction, the prompt bans them outright;
    # enforce it here too so a slip is retried server-side, not shipped
    _banned = ("eat healthy", "listen to your body", "stay consistent",
               "be consistent", "train hard", "trust the process")
    hay_all = " ".join(_plan_strings(data)).lower()
    if any(b in hay_all for b in _banned):
        fails.append("banned_filler")
    # Allergen scan (defence-in-depth behind the prompt). Word-boundary match
    # with an optional trailing 's' so "peanut" catches "peanut butter" and
    # "peanuts" without false-hitting "eggplant"/"nutrition". The allergies come
    # from the intake, on a check-in the client now carries them forward from
    # the saved plan's safety (SIMULATION finding: check-ins forgot allergies).
    # Scan supplements[] too: a whey/fish-oil can carry a dairy/fish allergen the
    # diet-only scan missed.
    words = _allergen_scan_words((intake or {}).get("allergies", ""))
    if words:
        food = {k: v for k, v in (dp.items() if isinstance(dp, dict) else [])
                if k not in ("allergy_note", "diet_preference_note")}
        supps = data.get("supplements") if isinstance(data.get("supplements"), list) else []
        hay = (" ".join(_plan_strings(food)) + " " + " ".join(_plan_strings(supps))).lower()
        if any(re.search(r"\b" + re.escape(w) + r"s?\b", hay) for w in words):
            fails.append("allergen_in_diet")
    return fails


@app.route("/api/trainer", methods=["POST"])
def trainer_api():
    payload = request.json if isinstance(request.json, dict) else {}

    # keyless demo: lets the document view + PDF be exercised without an API key.
    # demo=stream exercises the streamed text path the real API uses.
    if payload.get("demo"):
        if payload["demo"] in ("cut", "fatloss"):
            if TRAINER_DEMO_CUT is None:
                return jsonify({"error": "Demo plan is unavailable on the server."}), 500
            return jsonify(TRAINER_DEMO_CUT)
        if TRAINER_DEMO is None:
            return jsonify({"error": "Demo plan is unavailable on the server."}), 500
        if payload["demo"] == "stream":
            demo_text = json_mod.dumps(TRAINER_DEMO)

            def demo_gen():
                for i in range(0, len(demo_text), 2048):
                    yield demo_text[i:i + 2048]
            return Response(stream_with_context(demo_gen()), mimetype="text/plain")
        return jsonify(TRAINER_DEMO)

    intake = payload.get("intake")
    if not isinstance(intake, dict):  # hostile/malformed body must not 500 (RT-2)
        intake = {}
    if not str(intake.get("name", "")).strip() or not str(intake.get("goal", "")).strip():
        return jsonify({"error": "Please fill in at least your name and goal."}), 400
    age = _age_from_dob(intake.get("date of birth"))
    if age is not None and age < 18:
        return jsonify({"error": UNDER_18_MSG}), 400

    if not GEMINI_API_KEY:
        return jsonify({"error": AI_OFF_MSG}), 503
    if not TRAINER_SYSTEM:
        return jsonify({"error": "Trainer knowledge base missing on server."}), 500

    if _rate_limited(_client_ip()):
        return jsonify({"error": "That's several programs within the hour. The studio needs a moment. "
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
    followups = payload.get("followup_answers")
    followups = followups if isinstance(followups, list) else []
    if followups:
        lines.append("\nFOLLOW-UP ANSWERS (you asked, the client answered: do NOT ask again, produce the plan):")
        for qa in followups[:8]:
            if not isinstance(qa, dict):
                continue
            lines.append(f"- Q: {str(qa.get('q','')).strip()}\n  A: {str(qa.get('a','')).strip()}")
    if payload.get("mode") == "checkin":
        # the stateful check-in: the plan the client actually ran + their logged
        # numbers ride along, so recalibration evolves the program instead of
        # regenerating one from 13 form fields (shared with the Groq leg too)
        for key, label in (
                ("prev_plan", "PREVIOUS PLAN (digest of the program the client actually ran):"),
                ("log_digest", "THE CLIENT'S TRAINING LOG (recent sessions, best sets, stalls):")):
            blob = payload.get(key)
            if isinstance(blob, dict):
                bj = json_mod.dumps(blob)
                if len(bj) <= 20000:
                    lines.append("\n" + label)
                    lines.append(bj)
    user_content = "\n".join(lines)

    # Stream the JSON out as it is generated. A full plan takes well over the
    # 30 s that proxies tolerate for a silent response; streaming keeps bytes
    # flowing (same pattern as the journalist/analyst endpoints). The client
    # accumulates the text and parses the JSON at the end.
    #
    # The plan is a large structured object, so give the model generous output
    # room AND enough thinking budget to run its arithmetic self-check, a tight
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
    # blip, these are transient and on Google's side. Retry with exponential
    # backoff, then FALL BACK to the next configured model (GEMINI_MODELS) before
    # giving up. A retired model (404 / "no longer available") is skipped at once.
    TRANSIENT = ("503", "unavailable", "high demand", "overloaded",
                 "429", "resource_exhausted", "rate limit", "500", "internal error")
    MODEL_CHAIN = (GEMINI_MODELS[0],) * 2 + tuple(GEMINI_MODELS[1:3])
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
    # A plan that parses and is plan-shaped but flunks the quality gate is kept
    # as a last resort: retried for a clean one, served only if the whole chain
    # (including Groq) exhausts, better a flawed plan than an error page.
    soft = {"text": None}

    def keep_soft(text, fails):
        # A flawed-but-usable plan is kept as the last resort, EXCEPT one that puts
        # a listed allergen in the diet: that is a safety failure, never served
        # (SIMULATION E9 / content audit F-25).
        if "allergen_in_diet" not in fails:
            soft["text"] = soft["text"] or text

    def groq_fallback(q, fallback_err_msg):
        # Last resort when every Gemini attempt failed: one shot at Groq's
        # Llama 3.3 70B (independent infrastructure, same system prompt, same
        # validation). On any problem, surface the original friendly error.
        if not GROQ_API_KEY:
            q.put(("end", soft["text"] or fallback_err_msg))
            return
        try:
            print("[trainer] gemini exhausted, trying groq fallback", flush=True)
            req = urllib.request.Request(
                "https://api.groq.com/openai/v1/chat/completions",
                data=json_mod.dumps({
                    "model": GROQ_MODEL,
                    "messages": [
                        {"role": "system", "content": TRAINER_SYSTEM_COMPACT or TRAINER_SYSTEM},
                        {"role": "user", "content": user_content},
                    ],
                    "temperature": 0.5,
                    "max_tokens": 6000,
                    "response_format": {"type": "json_object"},
                }).encode(),
                headers={"Authorization": f"Bearer {GROQ_API_KEY}",
                         "Content-Type": "application/json",
                         # Groq's edge blocks the default Python-urllib agent
                         "User-Agent": "funflix-trainer/1.0"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=180, context=SSL_CTX) as resp:
                body = json_mod.loads(resp.read())
            text = body["choices"][0]["message"]["content"].strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            data = json_mod.loads(text)
            if isinstance(data, dict) and data.get("type") in ("questions", "plan"):
                fails = _validate_plan(data, intake)
                if not fails:
                    q.put(("end", text))
                    return
                print(f"[trainer] groq plan failed quality checks: {fails}", flush=True)
                keep_soft(text, fails)
            else:
                print(f"[trainer] groq fallback returned unusable output (chars={len(text)})", flush=True)
        except Exception as exc:
            print(f"[trainer] groq fallback failed: {exc}", flush=True)
        q.put(("end", soft["text"] or fallback_err_msg))

    def run_model_chain(q):
        dead = set()
        for attempt in range(MAX_ATTEMPTS):
            if MODEL_CHAIN[attempt] in dead:
                continue
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
                    fails = _validate_plan(data, intake)
                    if not fails:
                        q.put(("end", text))  # complete, validated payload
                        return
                    print(f"[trainer] attempt {attempt + 1} plan failed quality checks: {fails}", flush=True)
                    keep_soft(text, fails)
                    data = None

                # Unusable output. A safety block will not improve on retry;
                # everything else (truncated, malformed, empty) gets retried.
                if "SAFETY" in finish or "RECITATION" in finish or "BLOCK" in finish:
                    q.put(("end", "\nERROR: A content filter blocked the plan. This usually comes from "
                                  "sensitive wording in the health or extra-info box. Rephrase it plainly and try again."))
                    return
                print(f"[trainer] attempt {attempt + 1}/{MAX_ATTEMPTS} unusable output "
                      f"(model={MODEL_CHAIN[attempt]}, finish={finish or '?'}, chars={len(text)})", flush=True)
                if attempt < MAX_ATTEMPTS - 1:
                    backoff(attempt)
                    continue
                groq_fallback(q, "\nERROR: The model kept returning an incomplete plan. It is under heavy load "
                                 "right now. Nothing is wrong with your details; please try again in a few minutes.")
                return
            except Exception as exc:
                err = str(exc)
                low = err.lower()
                if "api_key" in low or "api key" in low or "401" in low:
                    q.put(("end", "\nERROR: " + AI_KEY_MSG))
                    return
                if _model_gone(err):
                    print(f"[trainer] {MODEL_CHAIN[attempt]} is not available, skipping it", flush=True)
                    dead.add(MODEL_CHAIN[attempt])
                    continue
                transient = any(m in low for m in TRANSIENT)
                if transient and attempt < MAX_ATTEMPTS - 1:
                    backoff(attempt)
                    continue
                if transient:
                    groq_fallback(q, "\nERROR: Gemini is temporarily overloaded (high demand on Google's side, "
                                     "not your account or key), even the backup model. Please try again in a minute or two.")
                    return
                print(f"[trainer] model error: {err[:300]}", flush=True)
                groq_fallback(q, "\nERROR: " + AI_BUSY_MSG)
                return
        # every configured model was retired or skipped: never leave the reader waiting
        groq_fallback(q, "\nERROR: " + AI_BUSY_MSG)

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


TRAINER_QA_SYSTEM = """You are The Trainer, the same evidence-based coach who wrote the client's \
program, attached below as JSON. Answer the client's questions about THEIR program.

Rules:
- Ground every answer in the attached plan and quote its numbers. When the plan already explains \
something (rationale, quality_vs_quantity, progressive_overload, safety_notes), teach from that \
material rather than inventing new reasoning.
- Exercise swaps: point to the substitution already listed in the plan when one exists; otherwise \
suggest an equal-stimulus alternative that fits the client's equipment context, keeping the same \
sets, rep range, rest, and effort.
- Missed days and scheduling: apply the plan's scheduling_note logic (keep a day between repeats \
of the same session type; never stack for lost time). Do not invent a new program.
- If a request would change targets wholesale (calories, weekly volume, the split itself), \
explain briefly and direct them to the Week-4 check-in, which recalibrates from measured data.
- Anything medical (pain, injury, illness, medication) is outside your expertise: recommend a \
physician or physiotherapist, offer at most a conservative suggestion labelled as such, \
consistent with the plan's safety notes.
- Tone: warm, direct, numbers attached. 2 to 5 short sentences, or a tight list. PLAIN TEXT only: \
no markdown symbols, no emojis, no em-dashes.
- If the question is unrelated to training, nutrition, recovery, or this plan, decline in one \
friendly sentence and steer back to the program.
- When a TRAINING LOG is attached, ground progress questions in the actual logged numbers: quote \
the client's real weights, reps and dates, name stalls the log shows and apply the plan's stall \
rule to them, and praise measured progress specifically. If no log is attached and progress is \
asked about, say the honest thing: log sessions (the Log tab or Coach Mode) and the answers get \
personal."""


@app.route("/api/trainer/ask", methods=["POST"])
def trainer_ask():
    payload = request.json if isinstance(request.json, dict) else {}
    plan = payload.get("plan")
    messages = payload.get("messages") or []
    if not isinstance(plan, dict) or plan.get("type") != "plan":
        return jsonify({"error": "No program attached. Build or restore a plan first."}), 400
    if not isinstance(messages, list) or not any(
            isinstance(m, dict) and m.get("role") == "user" for m in messages):
        return jsonify({"error": "Ask a question."}), 400
    if not GEMINI_API_KEY:
        return jsonify({"error": AI_OFF_MSG}), 503
    if _rate_limited(_client_ip(), bucket="qa", limit=20):
        return jsonify({"error": "That's a lot of questions within the hour. The studio needs a "
                                 "breather. Your limit resets soon."}), 429

    contents = []
    for m in messages[-12:]:
        if not isinstance(m, dict):
            continue
        role = "model" if m.get("role") == "assistant" else "user"
        text = str(m.get("content") or "").strip()
        if text:
            contents.append(types.Content(role=role, parts=[types.Part(text=text[:2000])]))
    if not contents:
        return jsonify({"error": "Ask a question."}), 400

    system = TRAINER_QA_SYSTEM + "\n\n==== THE CLIENT'S PLAN (JSON) ====\n" + json_mod.dumps(plan)
    digest = payload.get("log_digest")
    if isinstance(digest, dict) and len(json_mod.dumps(digest)) < 20_000:
        system += "\n\n==== THE CLIENT'S TRAINING LOG (their real logged sessions) ====\n" + json_mod.dumps(digest)
    config_kwargs = dict(system_instruction=system, temperature=0.4)
    try:
        config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=512)
    except AttributeError:
        pass

    def generate():
        client = genai.Client(api_key=GEMINI_API_KEY)
        yield from _stream_with_fallback(lambda model: client.models.generate_content_stream(
            model=model, contents=contents, config=types.GenerateContentConfig(**config_kwargs)), prefix="\nERROR: ")

    return Response(stream_with_context(generate()), mimetype="text/plain")


@app.route("/calculate", methods=["POST"])
def calculate():
    expression = _req_json().get("expression", "")
    try:
        result = safe_calculate(expression)
        return jsonify({"result": str(result)})
    except ZeroDivisionError:
        return jsonify({"error": "Division by zero"})
    except OverflowError:
        return jsonify({"error": "Result too large"})
    except CalcError as exc:
        return jsonify({"error": str(exc)})
    except (ValueError, TypeError):
        return jsonify({"error": "That isn't something I can compute"})

# NOTE: text/plain is deliberately EXCLUDED. Every streaming endpoint (live plan
# generation, demo=stream, Ask-the-Trainer) returns text/plain, and under gunicorn
# `resp.is_streamed` does NOT reliably flag those, so compressing text/plain
# buffered+gzipped the whole plan stream and the browser saw an "incomplete reply"
# (prod outage 2026-07-31). Excluding text/plain keeps every stream flowing while
# the real win (text/html for /trainer, JSON, CSS/JS) is untouched.
_COMPRESSIBLE = {"text/html", "text/css", "text/javascript",
                 "application/javascript", "application/json", "image/svg+xml",
                 "application/manifest+json"}


_NO_STORE_PREFIXES = ("/api/auth/", "/api/sync", "/api/history", "/api/profile", "/api/export")


@app.after_request
def _security_headers(resp):
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    resp.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
    if request.path.startswith(_NO_STORE_PREFIXES):
        resp.headers["Cache-Control"] = "no-store"
    return resp


@app.after_request
def _cache_fonts(resp):
    # the self-hosted fonts change rarely: let browsers keep them for a week
    # instead of revalidating three files on every page view
    if resp.status_code == 200 and request.path.startswith("/static/fonts/"):
        resp.headers["Cache-Control"] = "public, max-age=604800"
    return resp


@app.after_request
def _compress(resp):
    # Text compression, the biggest mobile-load win (Lighthouse "enable text
    # compression"): /trainer is ~187 KB of HTML/CSS/JS that gzips to ~52 KB.
    # Stdlib only ($0, no new dep). Streamed/SSE responses (all text/plain, now
    # excluded above) are left untouched so the live plan/demo streams keep flowing.
    try:
        if resp.direct_passthrough or resp.is_streamed:
            return resp
        if resp.headers.get("Content-Encoding"):
            return resp
        if "gzip" not in (request.headers.get("Accept-Encoding") or "").lower():
            return resp
        ctype = (resp.content_type or "").split(";")[0].strip().lower()
        if ctype not in _COMPRESSIBLE:
            return resp
        data = resp.get_data()
        if len(data) < 1024:                      # tiny bodies: not worth the CPU
            return resp
        packed = _gzip.compress(data, 6)
        resp.set_data(packed)
        resp.headers["Content-Encoding"] = "gzip"
        resp.headers["Content-Length"] = str(len(packed))
        resp.headers.add("Vary", "Accept-Encoding")
    except Exception:
        pass
    return resp


def _debug_enabled():
    # RED TEAM RT-8: never ship the Werkzeug debugger/reloader unless explicitly
    # asked for. Production runs via gunicorn (which ignores this block), so this
    # only governs `python app.py`; default OFF, opt in with FLASK_DEBUG=1.
    return os.environ.get("FLASK_DEBUG", "").strip().lower() in ("1", "true", "yes", "on")


if __name__ == "__main__":
    app.run(debug=_debug_enabled())
