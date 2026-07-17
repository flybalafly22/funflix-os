"""Tests for the Funflix Flask app, focused on The Trainer (/api/trainer).

No network: the Gemini SDK is mocked by monkeypatching the module attribute
`app.genai.Client`. `/api/trainer` buffers the model output in a worker
thread, JSON-validates it (dict with type "questions" or "plan"), and walks a
model chain of 2x gemini-2.5-flash then 2x gemini-2.5-flash-lite with
time.sleep backoffs between attempts — time.sleep is patched so retries are
instant.
"""
import json
import time

import pytest

import app as A

VALID_PLAN = {"type": "plan", "profile_summary": "test client", "note": "ok"}
VALID_PLAN_TEXT = json.dumps(VALID_PLAN)

INTAKE_BODY = {"intake": {"name": "Test User", "goal": "muscle gain"}}


# ─────────────────────────── fixtures / fakes ───────────────────────────

@pytest.fixture(autouse=True)
def fast_sleep(monkeypatch):
    """Retry backoffs call time.sleep via the shared `time` module (app.py does
    `import time`); neutralize it so the retry tests run instantly."""
    monkeypatch.setattr(time, "sleep", lambda *_a, **_k: None)


@pytest.fixture
def client():
    A.app.config["TESTING"] = True
    with A.app.test_client() as c:
        yield c


@pytest.fixture
def api_key(monkeypatch):
    """GEMINI_API_KEY is read from the module global at request time."""
    monkeypatch.setattr(A, "GEMINI_API_KEY", "test-dummy-key")


class FakeCandidate:
    def __init__(self, finish_reason=None):
        self.finish_reason = finish_reason


class FakeChunk:
    """Minimal stand-in for a Gemini stream chunk: the app reads `.text` and
    `.candidates[0].finish_reason`."""

    def __init__(self, text, finish_reason=None):
        self.text = text
        self.candidates = [FakeCandidate(finish_reason)]


def chunks_for(text, finish="STOP"):
    mid = max(1, len(text) // 2)
    return [FakeChunk(text[:mid]), FakeChunk(text[mid:], finish_reason=finish)]


def install_fake_client(monkeypatch, script):
    """Replace app.genai.Client with a fake whose generate_content_stream
    consumes `script` one entry per attempt (last entry repeats):
      - Exception instance  -> raised
      - (text, finish) pair -> streamed as two chunks with that finish_reason
      - str                 -> streamed as two chunks, finish_reason "STOP"
    Returns the list of recorded calls ({"model", "contents"})."""
    calls = []
    state = {"n": 0}

    class _Models:
        def generate_content_stream(self, model=None, contents=None, config=None):
            calls.append({"model": model, "contents": contents})
            item = script[min(state["n"], len(script) - 1)]
            state["n"] += 1
            if isinstance(item, Exception):
                raise item
            if isinstance(item, tuple):
                text, finish = item
            else:
                text, finish = item, "STOP"
            return iter(chunks_for(text, finish))

    class _Client:
        def __init__(self, api_key=None):
            self.api_key = api_key
            self.models = _Models()

    monkeypatch.setattr(A.genai, "Client", _Client)
    return calls


def post_trainer(client, body):
    resp = client.post("/api/trainer", json=body)
    return resp, resp.get_data(as_text=True)


# ─────────────────────────────── GET routes ───────────────────────────────

@pytest.mark.parametrize("route", [
    "/", "/trainer", "/calculator", "/meme", "/journalist", "/study", "/api/version",
])
def test_get_routes_return_200(client, route):
    resp = client.get(route)
    assert resp.status_code == 200


def test_api_version_shape(client):
    data = client.get("/api/version").get_json()
    assert isinstance(data, dict)
    assert "commit" in data and isinstance(data["commit"], str)


# ─────────────────────────────── demo paths ───────────────────────────────

def test_demo_returns_plan_json(client):
    resp = client.post("/api/trainer", json={"demo": 1})
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, dict)
    assert data.get("type") == "plan"


def test_demo_stream_is_text_plain_and_parses_to_same_plan(client):
    resp = client.post("/api/trainer", json={"demo": "stream"})
    assert resp.status_code == 200
    assert resp.content_type.startswith("text/plain")
    streamed = json.loads(resp.get_data(as_text=True))
    assert streamed.get("type") == "plan"
    assert streamed == client.post("/api/trainer", json={"demo": 1}).get_json()


# ─────────────────────────────── validation ───────────────────────────────

@pytest.mark.parametrize("intake", [
    {},                       # nothing
    {"name": "Bala"},         # missing goal
    {"goal": "fat loss"},     # missing name
    {"name": "  ", "goal": "fat loss"},  # whitespace-only name
])
def test_missing_name_or_goal_returns_400(client, intake):
    resp = client.post("/api/trainer", json={"intake": intake})
    assert resp.status_code == 400
    data = resp.get_json()
    assert data and data.get("error")


def test_missing_api_key_returns_500(client, monkeypatch):
    monkeypatch.setattr(A, "GEMINI_API_KEY", "")
    resp = client.post("/api/trainer", json=INTAKE_BODY)
    assert resp.status_code == 500
    assert "GEMINI_API_KEY" in resp.get_json()["error"]


# ───────────────────────── mocked model chain ─────────────────────────

def test_valid_plan_single_attempt_on_flash(client, api_key, monkeypatch):
    calls = install_fake_client(monkeypatch, [VALID_PLAN_TEXT])
    resp, body = post_trainer(client, INTAKE_BODY)
    assert resp.status_code == 200
    assert resp.content_type.startswith("text/plain")
    assert json.loads(body.strip()) == VALID_PLAN
    assert len(calls) == 1
    assert calls[0]["model"] == "gemini-2.5-flash"


def test_503_on_flash_falls_back_to_flash_lite(client, api_key, monkeypatch):
    boom = Exception("503 UNAVAILABLE: the model is overloaded, high demand")
    calls = install_fake_client(monkeypatch, [boom, boom, VALID_PLAN_TEXT])
    resp, body = post_trainer(client, INTAKE_BODY)
    assert resp.status_code == 200
    assert json.loads(body.strip()) == VALID_PLAN
    assert [c["model"] for c in calls] == [
        "gemini-2.5-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"]


def test_persistent_503_reports_backup_model_failure(client, api_key, monkeypatch):
    boom = Exception("503 Service Unavailable")
    calls = install_fake_client(monkeypatch, [boom])
    resp, body = post_trainer(client, INTAKE_BODY)
    assert resp.status_code == 200
    assert "\nERROR:" in body
    assert "even the backup model" in body
    # full chain exhausted: 2x flash then 2x flash-lite
    assert [c["model"] for c in calls] == [
        "gemini-2.5-flash", "gemini-2.5-flash",
        "gemini-2.5-flash-lite", "gemini-2.5-flash-lite"]


def test_unusable_json_twice_then_valid_plan(client, api_key, monkeypatch):
    calls = install_fake_client(monkeypatch, [
        '{"type": "plan", "weekly_split": {"days": [',  # truncated JSON
        "sorry, here is your plan: not json at all",     # invalid JSON
        VALID_PLAN_TEXT,
    ])
    resp, body = post_trainer(client, INTAKE_BODY)
    assert resp.status_code == 200
    assert "ERROR" not in body
    assert json.loads(body.strip()) == VALID_PLAN
    assert len(calls) == 3


def test_wrong_type_dict_is_retried(client, api_key, monkeypatch):
    # valid JSON but not type questions/plan -> unusable, retried
    calls = install_fake_client(monkeypatch, ['{"type": "poem"}', VALID_PLAN_TEXT])
    resp, body = post_trainer(client, INTAKE_BODY)
    assert resp.status_code == 200
    assert json.loads(body.strip()) == VALID_PLAN
    assert len(calls) == 2


def test_safety_block_gives_content_filter_error_without_retry(client, api_key, monkeypatch):
    calls = install_fake_client(
        monkeypatch, [("", "FinishReason.SAFETY")])
    resp, body = post_trainer(client, INTAKE_BODY)
    assert resp.status_code == 200
    assert "\nERROR:" in body
    assert "content filter" in body
    assert len(calls) == 1  # safety blocks are not retried


def test_non_transient_error_yields_error_text(client, api_key, monkeypatch):
    calls = install_fake_client(monkeypatch, [Exception("kaboom: totally novel failure")])
    resp, body = post_trainer(client, INTAKE_BODY)
    assert resp.status_code == 200
    assert "\nERROR: kaboom: totally novel failure" in body
    assert len(calls) == 1  # non-transient -> no retry


def test_invalid_api_key_error_message(client, api_key, monkeypatch):
    install_fake_client(monkeypatch, [Exception("401 API_KEY_INVALID")])
    resp, body = post_trainer(client, INTAKE_BODY)
    assert resp.status_code == 200
    assert "Invalid GEMINI_API_KEY" in body


# ─────────────────────────────── checkin mode ───────────────────────────────

def test_checkin_mode_returns_plan_and_flags_checkin(client, api_key, monkeypatch):
    calls = install_fake_client(monkeypatch, [VALID_PLAN_TEXT])
    body_in = {"mode": "checkin",
               "intake": {"name": "Test User", "goal": "muscle gain",
                          "weight_now": "83.1 kg"}}
    resp, body = post_trainer(client, body_in)
    assert resp.status_code == 200
    assert json.loads(body.strip()) == VALID_PLAN
    assert len(calls) == 1
    contents = calls[0]["contents"]
    assert "WEEK-4 CHECK-IN" in contents
    assert "weight_now: 83.1 kg" in contents


def test_plan_mode_prompt_uses_intake_header(client, api_key, monkeypatch):
    calls = install_fake_client(monkeypatch, [VALID_PLAN_TEXT])
    post_trainer(client, INTAKE_BODY)
    contents = calls[0]["contents"]
    assert contents.startswith("INTAKE FORM:")
    assert "WEEK-4 CHECK-IN" not in contents
    assert "- name: Test User" in contents
    assert "- goal: muscle gain" in contents
