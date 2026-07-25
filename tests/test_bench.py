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


def test_muscle_map_ignores_superset_parenthetical():
    # the superset partner in "(Superset with Lateral Raises)" must not decide
    # this exercise's muscle
    prim, _ = B.muscles_for("Cable Triceps Pushdowns (Superset with Lateral Raises)")
    assert prim == ["triceps"]
    prim2, _ = B.muscles_for("Dumbbell Bicep Curls (Superset with Face Pulls)")
    assert prim2 == ["biceps"]


def test_allergen_scan_skips_the_allergy_note():
    plan = {"diet_plan": {"allergy_note": "peanuts and eggs excluded",
                          "sample_day": [{"foods": ["200 g chicken"]}]}}
    entry = {"intake": {"allergies": "peanuts, eggs"}}
    assert B.check_allergen_scan(plan, entry)[1] is True
    plan["diet_plan"]["sample_day"] = [{"foods": ["3 eggs"]}]
    assert B.check_allergen_scan(plan, entry)[1] is False


def test_rir_no_failure_ignores_philosophy_prose():
    # "to failure" in the quality_vs_quantity stance is fine; in an effort cue is not
    ok = {"workout_days": [{"exercises": [{"name": "Squat", "rpe_or_rir": "RIR 2"}]}],
          "quality_vs_quantity": {"stance": "growth lives close to failure"}}
    bad = {"workout_days": [{"exercises": [{"name": "Squat", "rpe_or_rir": "take it to failure"}]}]}
    assert B._a_rir_no_failure(ok, {}, "")[0] is True
    assert B._a_rir_no_failure(bad, {}, "")[0] is False


def test_session_time_holds_model_to_declared_duration():
    entry = {"meta": {"hours_per_session": 1.25}}  # 75 min slot
    fits = {"workout_days": [{"day_label": "A", "estimated_duration_minutes": 70,
            "exercises": [{"name": "x", "sets": 20, "rest_seconds": 180}]}]}
    blown = {"workout_days": [{"day_label": "A", "estimated_duration_minutes": 100,
             "exercises": [{"name": "x", "sets": 4, "rest_seconds": 180}]}]}
    assert B.check_session_time(fits, entry)[1] is True   # declared 70 <= 75*1.15
    assert B.check_session_time(blown, entry)[1] is False  # declared 100 > budget


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
