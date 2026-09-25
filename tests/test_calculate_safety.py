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
