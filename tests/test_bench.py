"""Guards for the golden-intake eval bench (qa/trainer_bench.py).

Keeps the rubric code honest without touching the network: the demo plan must
score full, every assertion named in bench_intakes.json must exist in the
registry, and the muscle map / core checks must run cleanly.
"""
import json
import os
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QA = os.path.join(ROOT, "qa")
sys.path.insert(0, QA)

import trainer_bench as B  # noqa: E402


def _demo():
    with open(os.path.join(ROOT, "data", "trainer_demo.json")) as f:
        return json.load(f)


def _intakes():
    with open(os.path.join(QA, "bench_intakes.json")) as f:
        return json.load(f)["intakes"]


def test_demo_scores_full():
    entry = next(e for e in _intakes() if e["id"] == "demo_rohan")
    checks, passed = B.score_plan(_demo(), entry)
    fails = [(c[0], c[2]) for c in checks if not c[1]]
    assert not fails, f"demo regressed: {fails}"
    assert passed == len(checks)


def test_every_assertion_is_known():
    for e in _intakes():
        for a in (e.get("assertions") or []):
            name = a.split(":", 1)[0]
            assert name in B.REGISTRY or name in B.CORE_ALIASES, \
                f"{e['id']}: unknown assertion '{name}'"


def test_muscle_map_matches_demo_movements():
    # every exercise the flagship plan uses must map to a muscle (no unmapped)
    unmapped = []
    for ex in B._all_exercises(_demo()):
        prim, _ = B.muscles_for(ex.get("name"))
        if prim is None:
            unmapped.append(ex.get("name"))
    assert not unmapped, f"unmapped demo exercises: {unmapped}"


def test_banned_phrase_needs_a_number_to_pass():
    good = {"workout_days": [], "note": "add 2.5 kg when you beat the top of the range"}
    bad = {"workout_days": [], "note": "just listen to your body and stay consistent"}
    assert B.check_banned_phrase(good, {})[1] is True
    assert B.check_banned_phrase(bad, {})[1] is False


def test_exercise_match_is_word_bounded():
    # "run" must not match inside "Crunch"; a real "Box Jump" must match
    crunch = {"workout_days": [{"exercises": [
        {"name": "Cable Crunch", "substitution": "Abdominal Crunch Machine"}]}]}
    jump = {"workout_days": [{"exercises": [{"name": "Box Jump", "substitution": ""}]}]}
    assert B._a_no_exercise_matching(crunch, {}, "jump|run|sprint")[0] is True
    assert B._a_no_exercise_matching(jump, {}, "jump|run|sprint")[0] is False


def test_checked_in_fixtures_still_pass():
    # the live-captured regression anchors must stay green offline
    fx = os.path.join(QA, "bench_fixtures")
    ids = [f[:-5] for f in os.listdir(fx)] if os.path.isdir(fx) else []
    by_id = {e["id"]: e for e in _intakes()}
    for eid in ids:
        with open(os.path.join(fx, eid + ".json")) as f:
            plan = json.load(f)
        checks, passed = B.score_plan(plan, by_id[eid])
        fails = [(c[0], c[2]) for c in checks if not c[1]]
        assert not fails, f"fixture {eid} regressed: {fails}"
