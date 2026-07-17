"""Accounts & sync: registration, login, sessions, sync round-trip, newer-wins."""
import pytest

import app as A


class MemStore:
    """In-memory stand-in matching PgStore's contract."""

    def __init__(self):
        self.users = {}   # email -> (id, pw_hash)
        self.blobs = {}   # (uid, kind) -> {"value":..., "at":...}
        self._seq = 0

    def create_user(self, email, pw_hash):
        if email in self.users:
            return None
        self._seq += 1
        self.users[email] = (self._seq, pw_hash)
        return self._seq

    def get_user(self, email):
        return self.users.get(email)

    def get_email(self, uid):
        for e, (i, _) in self.users.items():
            if i == uid:
                return e
        return None

    def put_blob(self, uid, kind, value, at):
        cur = self.blobs.get((uid, kind))
        if cur and cur["at"] > at:
            return
        self.blobs[(uid, kind)] = {"value": value, "at": int(at)}

    def get_blobs(self, uid):
        return {k: dict(v) for (u, k), v in self.blobs.items() if u == uid}


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr(A, "STORE", MemStore())
    c = A.app.test_client()
    return c


def _reg(c, email="lift@example.com", pw="hunter2boat"):
    return c.post("/api/auth/register", json={"email": email, "password": pw})


def test_accounts_disabled_without_db(monkeypatch):
    monkeypatch.setattr(A, "STORE", None)
    c = A.app.test_client()
    assert c.get("/api/auth/me").get_json() == {"enabled": False, "user": None}
    assert _reg(c).status_code == 503
    assert c.get("/api/sync").status_code == 503


def test_register_login_logout_flow(client):
    r = _reg(client)
    assert r.status_code == 200 and r.get_json()["user"] == "lift@example.com"
    assert client.get("/api/auth/me").get_json()["user"] == "lift@example.com"
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").get_json()["user"] is None
    r = client.post("/api/auth/login", json={"email": "LIFT@example.com ", "password": "hunter2boat"})
    assert r.status_code == 200
    assert client.get("/api/auth/me").get_json()["user"] == "lift@example.com"


def test_register_validation(client):
    assert _reg(client, email="not-an-email").status_code == 400
    assert _reg(client, pw="short").status_code == 400
    _reg(client)
    assert _reg(client).status_code == 409  # duplicate


def test_login_wrong_password(client):
    _reg(client)
    client.post("/api/auth/logout")
    r = client.post("/api/auth/login", json={"email": "lift@example.com", "password": "wrongwrong"})
    assert r.status_code == 401


def test_passwords_are_hashed(client):
    _reg(client)
    _, pw_hash = A.STORE.get_user("lift@example.com")
    assert "hunter2boat" not in pw_hash
    assert pw_hash.startswith(("pbkdf2:", "scrypt:"))


def test_sync_requires_auth(client):
    assert client.get("/api/sync").status_code == 401


def test_sync_roundtrip_and_newer_wins(client):
    _reg(client)
    plan = {"type": "plan", "profile_summary": {"name": "R"}}
    r = client.put("/api/sync", json={"plan": {"value": plan, "at": 2000},
                                      "logs": {"value": [{"at": 1, "day": "D1", "entries": []}], "at": 2000}})
    assert r.status_code == 200 and r.get_json()["plan_at"] == 2000
    d = client.get("/api/sync").get_json()
    assert d["plan"]["value"] == plan and d["logs"]["at"] == 2000
    # an older write must not clobber
    client.put("/api/sync", json={"plan": {"value": {"type": "plan", "old": True}, "at": 1000}})
    d = client.get("/api/sync").get_json()
    assert d["plan"]["at"] == 2000 and "old" not in d["plan"]["value"]


def test_sync_size_guard(client):
    _reg(client)
    huge = {"type": "plan", "x": "y" * 400_000}
    assert client.put("/api/sync", json={"plan": {"value": huge, "at": 1}}).status_code == 413
