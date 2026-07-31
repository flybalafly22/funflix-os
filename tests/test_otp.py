"""Email-OTP account creation: signup is verified against a real inbox when a
mail provider is configured, with a safe direct-signup fallback when it isn't."""
import app as A
from test_accounts import MemStore


def _client(monkeypatch, mail=True):
    monkeypatch.setattr(A, "STORE", MemStore())
    A._trainer_hits.clear()
    monkeypatch.setattr(A, "_mail_configured", lambda: mail)
    sent = {}
    monkeypatch.setattr(A, "_send_email", lambda to, s, h: (sent.update(to=to, subject=s, html=h) or True))
    monkeypatch.setattr(A.secrets, "randbelow", lambda n: 123456)   # deterministic code "123456"
    return A.app.test_client(), sent


def test_otp_full_flow(monkeypatch):
    c, sent = _client(monkeypatch)
    r = c.post("/api/auth/register/start", json={"email": "a@x.com", "password": "hunter2boat"})
    assert r.status_code == 200 and r.get_json()["otp"] is True
    assert sent["to"] == "a@x.com" and "123456" in sent["html"]     # code emailed, not returned
    assert "123456" not in (r.get_data(as_text=True))               # never in the HTTP response
    assert c.get("/api/auth/me").get_json()["user"] is None          # NOT created until verified
    r2 = c.post("/api/auth/register/verify", json={"code": "123456"})
    assert r2.status_code == 200 and r2.get_json()["user"] == "a@x.com"
    assert c.get("/api/auth/me").get_json()["user"] == "a@x.com"     # now signed in


def test_otp_wrong_code_does_not_create(monkeypatch):
    c, _ = _client(monkeypatch)
    c.post("/api/auth/register/start", json={"email": "a@x.com", "password": "hunter2boat"})
    assert c.post("/api/auth/register/verify", json={"code": "000000"}).status_code == 400
    assert c.get("/api/auth/me").get_json()["user"] is None


def test_otp_too_many_attempts(monkeypatch):
    c, _ = _client(monkeypatch)
    c.post("/api/auth/register/start", json={"email": "a@x.com", "password": "hunter2boat"})
    for _ in range(6):
        c.post("/api/auth/register/verify", json={"code": "000000"})
    r = c.post("/api/auth/register/verify", json={"code": "123456"})   # correct, but locked out
    assert r.status_code == 429


def test_direct_register_blocked_when_mail_configured(monkeypatch):
    c, _ = _client(monkeypatch)
    r = c.post("/api/auth/register", json={"email": "a@x.com", "password": "hunter2boat"})
    assert r.status_code == 400   # OTP is mandatory — direct path is closed


def test_start_falls_back_to_direct_without_mail(monkeypatch):
    c, _ = _client(monkeypatch, mail=False)
    r = c.post("/api/auth/register/start", json={"email": "a@x.com", "password": "hunter2boat"})
    assert r.status_code == 200 and r.get_json()["otp"] is False   # never bricks signup
    assert c.get("/api/auth/me").get_json()["user"] == "a@x.com"


def test_start_rejects_existing_email(monkeypatch):
    c, _ = _client(monkeypatch)
    A.STORE.create_user("taken@x.com", A.generate_password_hash("hunter2boat"))
    r = c.post("/api/auth/register/start", json={"email": "taken@x.com", "password": "hunter2boat"})
    assert r.status_code == 409
