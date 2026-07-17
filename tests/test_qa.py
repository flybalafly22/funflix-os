"""Ask-the-Trainer endpoint: validation, grounding, streaming, rate bucket."""
import json

import pytest

import app as A


class _Chunk:
    def __init__(self, text):
        self.text = text
        self.candidates = [type("C", (), {"finish_reason": "STOP"})()]


PLAN = {"type": "plan", "profile_summary": {"name": "R", "goal": "muscle gain"},
        "workout_days": [{"day_label": "D1", "exercises": [
            {"name": "Barbell bench press", "sets": 4, "rep_range": "5-8",
             "rest_seconds": 180, "rpe_or_rir": "RIR 1-2", "tempo_or_notes": "", "substitution": "DB press"}]}]}


@pytest.fixture(autouse=True)
def _setup(monkeypatch):
    import time
    monkeypatch.setattr(time, "sleep", lambda *a, **k: None)  # plan-endpoint retries must not wait
    monkeypatch.setattr(A, "GEMINI_API_KEY", "dummy")
    captured = {}

    class M:
        def generate_content_stream(self, **kw):
            captured.update(kw)
            return iter([_Chunk("Your plan already lists DB press as the swap.")])

    monkeypatch.setattr(A.genai, "Client",
                        type("C", (), {"__init__": lambda s, **k: setattr(s, "models", M())}))
    yield captured


def _c():
    return A.app.test_client()


def test_requires_plan():
    r = _c().post("/api/trainer/ask", json={"messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 400
    assert "plan" in r.get_json()["error"].lower() or "program" in r.get_json()["error"].lower()


def test_requires_question():
    r = _c().post("/api/trainer/ask", json={"plan": PLAN, "messages": []})
    assert r.status_code == 400


def test_answers_grounded_in_plan(_setup):
    r = _c().post("/api/trainer/ask",
                  json={"plan": PLAN, "messages": [{"role": "user", "content": "Can I swap bench?"}]})
    assert r.status_code == 200
    assert "text/plain" in r.content_type
    assert "DB press" in r.get_data(as_text=True)
    # the plan JSON must ride along in the system instruction
    sysinstr = _setup["config"].system_instruction
    assert "Barbell bench press" in sysinstr and "CLIENT'S PLAN" in sysinstr


def test_qa_rate_bucket_is_separate_from_plan_bucket(monkeypatch):
    ip = {"X-Forwarded-For": "203.0.113.77"}
    c = _c()
    # exhaust the plan bucket (limit 6)
    for _ in range(7):
        c.post("/api/trainer", json={"intake": {"name": "R", "goal": "x"}}, headers=ip)
    r = c.post("/api/trainer", json={"intake": {"name": "R", "goal": "x"}}, headers=ip)
    assert r.status_code == 429
    # qa bucket must still be open
    r = c.post("/api/trainer/ask",
               json={"plan": PLAN, "messages": [{"role": "user", "content": "hello"}]}, headers=ip)
    assert r.status_code == 200
