"""Accounts & sync: registration, login, sessions, sync round-trip, newer-wins."""
import pytest

import app as A


class MemStore:
    """In-memory stand-in matching PgStore's contract."""

    def __init__(self):
        self.users = {}   # email -> (id, pw_hash)
        self.blobs = {}   # (uid, kind) -> {"value":..., "at":...}
        self.hist = {}    # uid -> [(id, plan, at)] newest first
        self._seq = 0
        self._hseq = 0

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
        if kind == "plan" and cur and int(at) > cur["at"]:
            self._hseq += 1
            self.hist.setdefault(uid, []).insert(0, (self._hseq, cur["value"], cur["at"]))
            self.hist[uid] = self.hist[uid][:10]
        self.blobs[(uid, kind)] = {"value": value, "at": int(at)}

    def get_history(self, uid):
        return list(self.hist.get(uid, []))

    def get_history_item(self, uid, hid):
        for i, p, at in self.hist.get(uid, []):
            if i == hid:
                return p
        return None

    def get_blobs(self, uid):
        return {k: dict(v) for (u, k), v in self.blobs.items() if u == uid}

    def get_account(self, uid):
        for e, (i, h) in self.users.items():
            if i == uid:
                return {"email": e, "pw_hash": h, "since": "2026-01-01T00:00:00"}
        return None

    def delete_user(self, uid):
        email = self.get_email(uid)
        if email is None:
            return False
        del self.users[email]
        self.blobs = {(u, k): v for (u, k), v in self.blobs.items() if u != uid}
        self.hist.pop(uid, None)
        return True


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


def _plan(goal, kcal):
    return {"type": "plan", "profile_summary": {"goal": goal},
            "diet_plan": {"calorie_target_kcal": kcal},
            "workout_days": [{"day_label": "D1", "exercises": []}]}


def test_plan_overwrite_archives_previous(client):
    _reg(client)
    client.put("/api/sync", json={"plan": {"value": _plan("First", 2800), "at": 1000}})
    client.put("/api/sync", json={"plan": {"value": _plan("Second", 3000), "at": 2000}})
    h = client.get("/api/history").get_json()["history"]
    assert len(h) == 1 and h[0]["goal"] == "First" and h[0]["kcal"] == 2800 and h[0]["days"] == 1
    item = client.get(f"/api/history/{h[0]['id']}").get_json()["plan"]
    assert item["profile_summary"]["goal"] == "First"


def test_history_cap_ten(client):
    _reg(client)
    for i in range(12):
        client.put("/api/sync", json={"plan": {"value": _plan(f"P{i}", 3000), "at": 1000 + i}})
    h = client.get("/api/history").get_json()["history"]
    assert len(h) == 10
    assert h[0]["goal"] == "P10"  # newest archived = the one replaced last


def test_history_requires_auth(client):
    assert client.get("/api/history").status_code == 401
    assert client.get("/api/history/1").status_code == 401


def test_older_plan_write_does_not_archive(client):
    _reg(client)
    client.put("/api/sync", json={"plan": {"value": _plan("Current", 3000), "at": 5000}})
    client.put("/api/sync", json={"plan": {"value": _plan("Stale", 2000), "at": 1000}})
    assert client.get("/api/history").get_json()["history"] == []


def test_profile_requires_auth(client):
    assert client.get("/api/profile").status_code == 401
    assert client.get("/api/export").status_code == 401


def test_profile_counts(client):
    _reg(client)
    client.put("/api/sync", json={"plan": {"value": _plan("First", 2800), "at": 1000},
                                  "logs": {"value": [{"at": 1}, {"at": 2}], "at": 1000}})
    client.put("/api/sync", json={"plan": {"value": _plan("Second", 3000), "at": 2000}})
    d = client.get("/api/profile").get_json()
    assert d["user"] == "lift@example.com" and d["since"]
    assert d["plan_at"] == 2000 and d["logs_n"] == 2 and d["history_n"] == 1


def test_export_shape(client):
    _reg(client)
    client.put("/api/sync", json={"plan": {"value": _plan("First", 2800), "at": 1000},
                                  "logs": {"value": [{"at": 1}], "at": 1000}})
    client.put("/api/sync", json={"plan": {"value": _plan("Second", 3000), "at": 2000}})
    r = client.get("/api/export")
    assert r.status_code == 200
    assert "attachment" in r.headers.get("Content-Disposition", "")
    d = r.get_json()
    assert d["format"] == "the-trainer/export-1"
    assert d["account"]["email"] == "lift@example.com"
    assert d["plan"]["value"]["profile_summary"]["goal"] == "Second"
    assert len(d["logs"]["value"]) == 1
    assert len(d["history"]) == 1
    assert d["history"][0]["plan"]["profile_summary"]["goal"] == "First"


def test_delete_account_wipes_everything(client):
    _reg(client)
    client.put("/api/sync", json={"plan": {"value": _plan("First", 2800), "at": 1000}})
    client.put("/api/sync", json={"plan": {"value": _plan("Second", 3000), "at": 2000}})
    # wrong password → refused, nothing deleted
    r = client.post("/api/auth/delete", json={"password": "wrongwrong"})
    assert r.status_code == 401
    assert client.get("/api/auth/me").get_json()["user"] == "lift@example.com"
    # right password → gone: session cleared, rows wiped, login impossible
    r = client.post("/api/auth/delete", json={"password": "hunter2boat"})
    assert r.status_code == 200 and r.get_json()["ok"] is True
    assert client.get("/api/auth/me").get_json()["user"] is None
    assert A.STORE.get_user("lift@example.com") is None
    assert A.STORE.get_blobs(1) == {} and A.STORE.get_history(1) == []
    r = client.post("/api/auth/login", json={"email": "lift@example.com", "password": "hunter2boat"})
    assert r.status_code == 401


def test_delete_requires_auth(client):
    assert client.post("/api/auth/delete", json={"password": "x"}).status_code == 401
