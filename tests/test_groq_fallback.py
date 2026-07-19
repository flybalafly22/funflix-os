"""Groq last-resort fallback: fires only after every Gemini attempt fails,
validates the JSON like the Gemini path, and never masks the original
friendly error when it can't help."""
import io
import json
import time

import pytest

import app as A


class _Chunk:
    def __init__(self, text, finish="STOP"):
        self.text = text
        self.candidates = [type("C", (), {"finish_reason": finish})()]


class _Down503:
    """Every Gemini model raises a transient 503."""
    calls = []

    def generate_content_stream(self, **kw):
        _Down503.calls.append(kw["model"])
        raise Exception("503 UNAVAILABLE high demand")


class _GeminiClient:
    def __init__(self, **kw):
        self.models = _Down503()


def _fake_urlopen_factory(payload_text, capture):
    class _Resp:
        def read(self):
            return json.dumps(
                {"choices": [{"message": {"content": payload_text}}]}).encode()

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def fake_urlopen(req, timeout=None, context=None):
        capture["url"] = req.full_url
        capture["body"] = json.loads(req.data)
        capture["auth"] = req.headers.get("Authorization")
        return _Resp()

    return fake_urlopen


@pytest.fixture(autouse=True)
def _fast(monkeypatch):
    monkeypatch.setattr(time, "sleep", lambda *a, **k: None)
    monkeypatch.setattr(A, "GEMINI_API_KEY", "dummy")
    monkeypatch.setattr(A.genai, "Client", _GeminiClient)
    _Down503.calls = []


GOOD_PLAN = {
    "type": "plan", "profile_summary": "groq client",
    "workout_days": [{"day_label": "D1", "exercises": [
        {"name": "Squat", "sets": 3, "rest_seconds": 180},
        {"name": "Bench Press", "sets": 3, "rest_seconds": 180},
        {"name": "Row", "sets": 3, "rest_seconds": 120}]}],
    "diet_plan": {"calorie_target_kcal": 3000, "protein_g": 165, "carbs_g": 405,
                  "fat_g": 80, "sample_day": [],
                  "sample_day_totals": {"approx_calories": 2965}},
}


def _post():
    return A.app.test_client().post(
        "/api/trainer", json={"intake": {"name": "R", "goal": "muscle gain"}})


def test_groq_rescues_total_gemini_outage(monkeypatch):
    monkeypatch.setattr(A, "GROQ_API_KEY", "test-groq-key")
    cap = {}
    good = dict(GOOD_PLAN, via="groq")
    plan = json.dumps(good)
    monkeypatch.setattr(A.urllib.request, "urlopen", _fake_urlopen_factory(plan, cap))
    body = _post().get_data(as_text=True)
    assert json.loads(body.strip()) == good
    assert "ERROR" not in body
    assert len(_Down503.calls) == 4  # full Gemini chain exhausted first
    assert "groq.com" in cap["url"]
    assert cap["auth"] == "Bearer test-groq-key"
    assert cap["body"]["model"] == A.GROQ_MODEL
    assert cap["body"]["response_format"] == {"type": "json_object"}
    assert cap["body"]["messages"][0]["role"] == "system"


def test_no_groq_key_keeps_friendly_error():
    body = _post().get_data(as_text=True)
    assert "even the backup model" in body


def test_groq_invalid_json_keeps_friendly_error(monkeypatch):
    monkeypatch.setattr(A, "GROQ_API_KEY", "test-groq-key")
    monkeypatch.setattr(A.urllib.request, "urlopen",
                        _fake_urlopen_factory("not json at all", {}))
    body = _post().get_data(as_text=True)
    assert "even the backup model" in body


def test_groq_http_failure_keeps_friendly_error(monkeypatch):
    monkeypatch.setattr(A, "GROQ_API_KEY", "test-groq-key")

    def boom(*a, **k):
        raise Exception("429 rate limit")

    monkeypatch.setattr(A.urllib.request, "urlopen", boom)
    body = _post().get_data(as_text=True)
    assert "even the backup model" in body


def test_groq_not_called_when_gemini_healthy(monkeypatch):
    class _Healthy:
        def generate_content_stream(self, **kw):
            return iter([_Chunk(json.dumps(dict(GOOD_PLAN, ok=True)))])

    monkeypatch.setattr(A.genai, "Client",
                        type("C", (), {"__init__": lambda s, **k: setattr(s, "models", _Healthy())}))
    monkeypatch.setattr(A, "GROQ_API_KEY", "test-groq-key")

    def fail_if_called(*a, **k):
        raise AssertionError("groq must not be called when gemini works")

    monkeypatch.setattr(A.urllib.request, "urlopen", fail_if_called)
    body = _post().get_data(as_text=True)
    assert json.loads(body.strip()) == dict(GOOD_PLAN, ok=True)
