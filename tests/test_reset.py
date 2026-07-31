"""Password reset via emailed one-time code (Sprint 30): a user who forgot their
password recovers their account (and its synced data) via a code sent to their
inbox. Anti-enumeration, attempt-limited, and gated on a configured mail provider."""
import app as A
from test_accounts import MemStore
from werkzeug.security import check_password_hash


def _client(monkeypatch, mail=True):
    monkeypatch.setattr(A, "STORE", MemStore())
    A._trainer_hits.clear()
    monkeypatch.setattr(A, "_mail_configured", lambda: mail)
    sent = {}
    monkeypatch.setattr(A, "_send_email", lambda to, s, h: (sent.update(to=to, subject=s, html=h) or True))
    monkeypatch.setattr(A.secrets, "randbelow", lambda n: 123456)   # deterministic "123456"
    # a pre-existing account whose password we will reset
    A.STORE.create_user("user@x.com", A.generate_password_hash("oldpassword"))
    return A.app.test_client(), sent


def test_reset_full_flow_changes_password_and_logs_in(monkeypatch):
    c, sent = _client(monkeypatch)
    r = c.post("/api/auth/reset/start", json={"email": "user@x.com"})
    assert r.status_code == 200 and r.get_json()["ok"] is True
    assert sent["to"] == "user@x.com" and "123456" in sent["html"]   # code emailed
    assert "123456" not in r.get_data(as_text=True)                  # never in the response
    assert c.get("/api/auth/me").get_json()["user"] is None          # not logged in mid-reset
    r2 = c.post("/api/auth/reset/verify", json={"code": "123456", "password": "brandnewpass"})
    assert r2.status_code == 200 and r2.get_json()["user"] == "user@x.com"
    assert c.get("/api/auth/me").get_json()["user"] == "user@x.com"  # signed in after reset
    # the new password works and the old one no longer does
    assert check_password_hash(A.STORE.get_user("user@x.com")[1], "brandnewpass")
    c.post("/api/auth/logout")
    assert c.post("/api/auth/login", json={"email": "user@x.com", "password": "oldpassword"}).status_code == 401
    assert c.post("/api/auth/login", json={"email": "user@x.com", "password": "brandnewpass"}).status_code == 200


def test_reset_unknown_email_is_indistinguishable(monkeypatch):
    c, sent = _client(monkeypatch)
    r = c.post("/api/auth/reset/start", json={"email": "nobody@x.com"})
    assert r.status_code == 200 and r.get_json()["ok"] is True       # same success shape
    assert sent == {}                                                # but nothing sent
    # and no session is armed → verify can't do anything
    assert c.post("/api/auth/reset/verify", json={"code": "123456", "password": "brandnewpass"}).status_code == 400


def test_reset_wrong_code_leaves_password_unchanged(monkeypatch):
    c, _ = _client(monkeypatch)
    c.post("/api/auth/reset/start", json={"email": "user@x.com"})
    r = c.post("/api/auth/reset/verify", json={"code": "000000", "password": "brandnewpass"})
    assert r.status_code == 400
    assert check_password_hash(A.STORE.get_user("user@x.com")[1], "oldpassword")   # unchanged


def test_reset_locks_out_after_six_wrong_codes(monkeypatch):
    c, _ = _client(monkeypatch)
    c.post("/api/auth/reset/start", json={"email": "user@x.com"})
    for _ in range(6):
        c.post("/api/auth/reset/verify", json={"code": "000000", "password": "brandnewpass"})
    r = c.post("/api/auth/reset/verify", json={"code": "123456", "password": "brandnewpass"})
    assert r.status_code == 429                                      # correct code, but locked


def test_reset_rejects_short_new_password(monkeypatch):
    c, _ = _client(monkeypatch)
    c.post("/api/auth/reset/start", json={"email": "user@x.com"})
    r = c.post("/api/auth/reset/verify", json={"code": "123456", "password": "short"})
    assert r.status_code == 400
    assert check_password_hash(A.STORE.get_user("user@x.com")[1], "oldpassword")   # unchanged


def test_reset_unavailable_without_mail_provider(monkeypatch):
    c, _ = _client(monkeypatch, mail=False)
    r = c.post("/api/auth/reset/start", json={"email": "user@x.com"})
    assert r.status_code == 503                                      # honest "not set up"
