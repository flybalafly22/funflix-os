"""Compute (/calculate): it calculates, and nothing else.

RED TEAM 2026-09-25: the old eval() "sandbox" could be escaped with attribute walks
(().__class__.__base__.__subclasses__()) to reach os.popen: unauthenticated remote
code execution on a public route. These tests lock the replacement: an AST
evaluator that accepts numbers, arithmetic, brackets and a fixed list of math
functions, with guards against expressions built to burn the CPU.
"""
import time

import app as A


def _calc(expr):
    return A.app.test_client().post("/calculate", json={"expression": expr}).get_json()


def test_everyday_maths_still_works():
    cases = {
        "2+3*4": "14", "10//3": "3", "10%3": "1", "2**10": "1024", "-(-3)": "3",
        "sqrt(16)": "4.0", "factorial(5)": "120", "pow(2,3)": "8.0", "abs(-7)": "7",
        "degrees(pi)": "180.0", "round(2.567, 2)": "2.57", "log(100, 10)": "2.0",
        "sin(0)": "0.0", "exp(0)": "1.0", "log2(8)": "3.0", "radians(180)": str(A.math.pi),
        "(1+2)*(3+4)": "21", "e": str(A.math.e), "1.5*4": "6.0",
    }
    for expr, want in cases.items():
        assert _calc(expr) == {"result": want}, expr


def test_sandbox_escapes_are_refused():
    payloads = [
        "[c for c in ().__class__.__base__.__subclasses__() if c.__name__=='_wrap_close'][0]"
        ".__init__.__globals__['popen']('id').read()",
        "().__class__.__base__.__subclasses__()",
        "__import__('os').system('id')",
        "(lambda: 1)()",
        "open('/etc/passwd').read()",
        "getattr(1, '__class__')",
        "'a'*10",
        "[1,2,3]",
        "{}.keys()",
        "x",
    ]
    for p in payloads:
        r = _calc(p)
        assert "result" not in r and "error" in r, p


def test_cpu_bombs_are_refused_fast():
    t0 = time.time()
    for bomb in ("9**9**9", "10**100000", "factorial(100000)", "pow(10, 100000)",
                 "2**2**2**2**2**2", "1" + "+1" * 150):
        r = _calc(bomb)
        assert "result" not in r, bomb
    assert time.time() - t0 < 2.0


def test_bad_bodies_do_not_500():
    c = A.app.test_client()
    for body in ([], "x", 5, None):
        r = c.post("/calculate", json=body)
        assert r.status_code == 200 and "error" in r.get_json()
    assert c.post("/calculate", data="not json", content_type="application/json").status_code == 200


def test_errors_are_plain_words():
    assert _calc("1/0") == {"error": "Division by zero"}
    assert _calc("sqrt(-1)") == {"error": "That isn't something I can compute"}
    assert _calc("2+") == {"error": "Check the expression"}


# ── 2026-09-25 evaluation: the other server-side fixes, locked ──

def test_security_headers_and_no_store_on_account_data():
    c = A.app.test_client()
    r = c.get("/")
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["X-Frame-Options"] == "SAMEORIGIN"
    assert "strict-origin" in r.headers["Referrer-Policy"]
    assert c.get("/api/auth/me").headers.get("Cache-Control") == "no-store"


def test_malformed_bodies_on_ai_endpoints_do_not_500():
    c = A.app.test_client()
    assert c.post("/api/journalist", json=["x"]).status_code == 400
    assert c.post("/api/analyst", json={"messages": ["hi", 3]}).status_code in (400, 503)


def test_under_18s_are_refused_before_the_model_is_called(monkeypatch):
    called = []
    monkeypatch.setattr(A, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(A.genai, "Client", lambda **k: called.append(k))
    from datetime import date
    y = date.today().year
    for dob in (f"{y - 15}-01-01", f"{y - 17}-01-01"):
        r = A.app.test_client().post("/api/trainer", json={"intake": {"name": "T", "goal": "Strength", "date of birth": dob}})
        assert r.status_code == 400 and "18" in r.get_json()["error"]
    assert not called


def test_allergen_families_are_caught():
    p = {"type": "plan", "diet_plan": {"sample_day": [{"meal": "Breakfast", "foods": ["200 g Greek yogurt", "1 scoop whey"]}]}}
    assert "allergen_in_diet" in A._validate_plan(p, {"allergies": "dairy"})
    p2 = {"type": "plan", "diet_plan": {"sample_day": [{"meal": "Lunch", "foods": ["2 rotis", "dal"]}]}}
    assert "allergen_in_diet" in A._validate_plan(p2, {"allergies": "gluten (coeliac)"})


def test_email_with_markup_is_rejected():
    r = A.app.test_client().post("/api/auth/register/start", json={"email": "<img src=x>@a.co", "password": "longenough1"})
    assert r.status_code in (400, 503)


def test_favicon_is_served():
    r = A.app.test_client().get("/favicon.ico")
    assert r.status_code == 200 and r.data[:8] == b"\x89PNG\r\n\x1a\n"


def test_backup_ai_provider_is_disclosed_only_when_switched_on(monkeypatch):
    c = A.app.test_client()
    monkeypatch.setattr(A, "GROQ_API_KEY", "")
    assert b"Groq" not in c.get("/trainer").data
    monkeypatch.setattr(A, "GROQ_API_KEY", "test-key")
    assert b"our backup provider, Groq" in c.get("/trainer").data
