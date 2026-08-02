"""Sprint 32 — server-side union merge for logs/weights, so two devices that
pull→append→push concurrently don't overwrite each other (RED TEAM lost-update
race), and two different sessions backdated to the same day both survive
(SIMULATION same-day collision)."""
import app as A
from test_accounts import MemStore, _reg


def _client(monkeypatch):
    monkeypatch.setattr(A, "STORE", MemStore())
    A._trainer_hits.clear()
    c = A.app.test_client()
    _reg(c)
    return c


def _sess(at, day="Push", entries=None):
    return {"at": at, "day": day, "entries": entries or [{"name": "Bench", "sets": [{"kg": "60", "reps": "8"}]}]}


def _put(c, kind, value, at):
    return c.put("/api/sync", json={kind: {"value": value, "at": at}})


def _logs(c):
    return c.get("/api/sync").get_json()["logs"]["value"]


def test_concurrent_pushes_do_not_clobber(monkeypatch):
    c = _client(monkeypatch)
    a, b = _sess(1000, entries=[{"name": "A", "sets": []}]), _sess(2000, entries=[{"name": "B", "sets": []}])
    _put(c, "logs", [a], 1000)          # device A pushes only its session
    _put(c, "logs", [b], 2000)          # device B (stale base) pushes only its session
    got = _logs(c)
    ats = {s["at"] for s in got}
    assert ats == {1000, 2000}, "both devices' sessions must survive the merge"
    assert got[0]["at"] == 2000          # newest first


def test_merge_is_idempotent(monkeypatch):
    c = _client(monkeypatch)
    s = _sess(1000)
    _put(c, "logs", [s], 1000)
    _put(c, "logs", [s], 1000)          # same session synced twice
    assert len(_logs(c)) == 1            # deduped, not doubled


def test_same_day_backdated_distinct_sessions_both_kept(monkeypatch):
    c = _client(monkeypatch)
    noon = 1_753_000_000_000            # two sessions backdated to the same day -> same `at`
    s1 = _sess(noon, day="Push", entries=[{"name": "Bench", "sets": [{"kg": "60", "reps": "8"}]}])
    s2 = _sess(noon, day="Pull", entries=[{"name": "Row", "sets": [{"kg": "50", "reps": "10"}]}])
    _put(c, "logs", [s1], noon)
    _put(c, "logs", [s2], noon)
    got = _logs(c)
    assert len(got) == 2, "distinct sessions sharing a backdated timestamp must not collide"


def test_log_merge_capped_at_400(monkeypatch):
    c = _client(monkeypatch)
    many = [_sess(i, entries=[{"name": "X%d" % i, "sets": []}]) for i in range(450)]
    _put(c, "logs", many, 450)
    got = _logs(c)
    assert len(got) == 400
    assert got[0]["at"] == 449           # newest kept, oldest dropped


def test_weights_union_by_date(monkeypatch):
    c = _client(monkeypatch)
    c.put("/api/sync", json={"weights": {"value": [{"d": "2026-07-01", "kg": 80}], "at": 1}})
    c.put("/api/sync", json={"weights": {"value": [{"d": "2026-07-02", "kg": 79}], "at": 2}})
    got = c.get("/api/sync").get_json()["weights"]["value"]
    dates = {w["d"] for w in got}
    assert dates == {"2026-07-01", "2026-07-02"}          # both weigh-ins survive


def test_weights_same_day_incoming_wins(monkeypatch):
    c = _client(monkeypatch)
    c.put("/api/sync", json={"weights": {"value": [{"d": "2026-07-01", "kg": 80}], "at": 1}})
    c.put("/api/sync", json={"weights": {"value": [{"d": "2026-07-01", "kg": 81}], "at": 2}})
    got = c.get("/api/sync").get_json()["weights"]["value"]
    assert len(got) == 1 and got[0]["kg"] == 81           # one per day, corrected value wins
