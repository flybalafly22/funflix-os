"""RED TEAM hardening regressions (Sprint 15): malformed input no longer 500s,
request bodies are capped, sync timestamps are coerced+clamped, and the
rate-limit exemption is gated on the real TCP peer (not a spoofable header).
"""
import time

import pytest

import app as A
from test_accounts import MemStore, _reg  # reuse the in-memory store + helper


@pytest.fixture()
def acct_client(monkeypatch):
    monkeypatch.setattr(A, "STORE", MemStore())
    A._trainer_hits.clear()
    return A.app.test_client()


# ── RT-2: malformed input types return 4xx, never 500 ──

def test_nondict_intake_is_4xx_not_500():
    c = A.app.test_client()
    assert c.post("/api/trainer", json={"intake": [1, 2, 3]}).status_code == 400
    assert c.post("/api/trainer", json=[1, 2, 3]).status_code == 400          # top-level non-dict
    # ask endpoint with non-dict messages must not 500
    r = c.post("/api/trainer/ask", json={"plan": {"type": "plan"}, "messages": [1, 2]})
    assert r.status_code == 400


# ── RT-3: request bodies are capped (memory-DoS lever) ──

def test_oversized_body_rejected():
    c = A.app.test_client()
    big = b'{"intake":{"name":"x","goal":"y","p":"' + b"z" * (3 * 1024 * 1024 + 100) + b'"}}'
    assert c.post("/api/trainer", data=big, content_type="application/json").status_code == 413


# ── RT-4 / RT-5: sync timestamp is coerced + clamped ──

def test_sync_at_is_clamped_not_frozen_forever(acct_client):
    _reg(acct_client)
    now = int(time.time() * 1000)
    acct_client.put("/api/sync", json={"weights": {"value": [{"d": "2026-07-01", "kg": 80}],
                                                   "at": 9 * 10 ** 18}})  # far future
    at = acct_client.get("/api/sync").get_json()["weights"]["at"]
    assert at <= now + 86_400_000 + 5000, "far-future timestamp must be clamped, not stored"


def test_sync_nonnumeric_at_does_not_500(acct_client):
    _reg(acct_client)
    r = acct_client.put("/api/sync", json={"weights": {"value": [{"d": "2026-07-02", "kg": 79}],
                                                       "at": "not-a-number"}})
    assert r.status_code == 200


# ── RT-1: the loopback rate-limit exemption is gated on the real peer ──

def test_rate_limit_exemption_ignores_spoofed_xff(acct_client):
    A._trainer_hits.clear()
    env = {"REMOTE_ADDR": "203.0.113.9"}          # a real, non-loopback peer
    hdr = {"X-Forwarded-For": "127.0.0.1"}        # spoofed loopback
    codes = [acct_client.post("/api/auth/login",
                              json={"email": "no@x.com", "password": "nope12345"},
                              headers=hdr, environ_base=env).status_code
             for _ in range(14)]
    assert 429 in codes, "spoofed loopback XFF must not grant rate-limit exemption"


def test_local_peer_still_exempt(acct_client):
    # local dev / the test suite (loopback peer) stays exempt so nothing breaks
    A._trainer_hits.clear()
    codes = [acct_client.post("/api/auth/login",
                              json={"email": "no@x.com", "password": "nope12345"}).status_code
             for _ in range(14)]
    assert 429 not in codes


# ── RT-8: the Werkzeug debugger/reloader is opt-in, never on by default ──

def test_debug_gated_off_by_default(monkeypatch):
    monkeypatch.delenv("FLASK_DEBUG", raising=False)
    assert A._debug_enabled() is False
    for on in ("1", "true", "TRUE", "yes", "on"):
        monkeypatch.setenv("FLASK_DEBUG", on)
        assert A._debug_enabled() is True, on
    for off in ("0", "false", "no", "", "off"):
        monkeypatch.setenv("FLASK_DEBUG", off)
        assert A._debug_enabled() is False, off


# ── Sprint 26: text compression (gzip) is on for HTML, off for streams ──

def test_gzip_on_html_when_accepted():
    import gzip as _g
    c = A.app.test_client()
    r = c.get("/trainer", headers={"Accept-Encoding": "gzip"})
    assert r.status_code == 200
    assert r.headers.get("Content-Encoding") == "gzip"
    assert b"planWrap" in _g.decompress(r.data)          # decompresses to real HTML
    assert "Accept-Encoding" in (r.headers.get("Vary") or "")


def test_no_gzip_when_not_accepted():
    c = A.app.test_client()
    r = c.get("/trainer", headers={"Accept-Encoding": "identity"})
    assert r.headers.get("Content-Encoding") is None      # graceful fallback


def test_streamed_response_not_compressed():
    c = A.app.test_client()
    r = c.post("/api/trainer", json={"demo": "stream"}, headers={"Accept-Encoding": "gzip"})
    assert r.headers.get("Content-Encoding") is None       # SSE/stream left intact


def test_text_plain_never_compressed():
    # every streaming endpoint (live plan gen, demo=stream, Ask) is text/plain, and
    # under gunicorn `is_streamed` did NOT catch them → the plan stream got buffered
    # and gzipped, so the browser saw an "incomplete reply" (prod outage 2026-07-31).
    # text/plain must be permanently OUT of the compressible set.
    assert "text/plain" not in A._COMPRESSIBLE


# ── Sprint 27: the second (fat-loss) demo is valid and served on ?demo=cut ──

def test_cut_demo_valid_and_served():
    assert A.TRAINER_DEMO_CUT is not None
    assert A._validate_plan(A.TRAINER_DEMO_CUT, intake={}) == []      # passes the shipped gate
    c = A.app.test_client()
    d = c.post("/api/trainer", json={"demo": "cut"}).get_json()
    assert d["profile_summary"]["gender_assigned_at_birth"] == "female"
    assert d["profile_summary"]["goal"].lower().startswith("fat loss")
    assert d["diet_plan"]["calorie_target_kcal"] == 1650
    # default demo is unchanged (muscle gain)
    d0 = c.post("/api/trainer", json={"demo": 1}).get_json()
    assert d0["profile_summary"]["name"] == "Rohan"
