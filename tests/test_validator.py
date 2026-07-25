"""Sprint 12: _validate_plan quality gate + stateful check-in digests.

The validator rejects plan-shaped-but-broken output (skeletons, macro
arithmetic that doesn't reconcile, markdown in strings, allergens in the
sample day) so the existing retry chain fires; the check-in route forwards
the previous-plan and training-log digests into the model prompt.
"""
import copy
import json

import pytest

import app as A

from test_trainer import (VALID_PLAN, install_fake_client, post_trainer,
                          client, api_key, fast_sleep)  # noqa: F401


def _good():
    return copy.deepcopy(VALID_PLAN)


def test_demo_plan_passes_validator():
    # demo-Rohan reports no allergies; the flagship sample must clear the gate
    assert A._validate_plan(A.TRAINER_DEMO, {"allergies": "none"}) == []


def test_minimal_valid_plan_passes():
    assert A._validate_plan(_good()) == []


def test_skeleton_plan_fails():
    fails = A._validate_plan({"type": "plan", "note": "ok"})
    assert "no_workout_days" in fails and "no_diet_plan" in fails


def test_thin_day_fails():
    p = _good()
    p["workout_days"][0]["exercises"] = p["workout_days"][0]["exercises"][:2]
    assert "thin_day" in A._validate_plan(p)


def test_string_sets_fail():
    p = _good()
    p["workout_days"][0]["exercises"][0]["sets"] = "3-4"
    assert "non_numeric_sets" in A._validate_plan(p)


def test_macro_math_must_reconcile():
    p = _good()
    p["diet_plan"]["protein_g"] = 300  # 4*300+4*405+9*80 = 3540 vs 3000 target
    assert "macro_math" in A._validate_plan(p)


def test_markdown_in_strings_fails():
    p = _good()
    p["profile_summary"] = "**bold** client"
    assert "markdown_or_newline" in A._validate_plan(p)


def test_allergen_in_sample_day_fails():
    p = _good()
    p["diet_plan"]["sample_day"] = [{"meal": "M1", "foods": ["20 g peanut butter"]}]
    assert "allergen_in_diet" in A._validate_plan(p, {"allergies": "peanuts"})
    assert A._validate_plan(p, {"allergies": "none"}) == []


def test_short_allergens_are_enforced():
    # "egg"/"soy"/"nut" (<=4 chars) used to slip past the len>=4 floor
    p = _good()
    p["diet_plan"]["sample_day"] = [{"meal": "M1", "foods": ["3 whole eggs", "oats"]}]
    assert "allergen_in_diet" in A._validate_plan(p, {"allergies": "egg"})
    assert "allergen_in_diet" in A._validate_plan(p, {"allergies": "eggs, shellfish"})


def test_allergen_scanned_beyond_sample_day():
    # an allergen hiding in meal_schedule (not sample_day) must still be caught
    p = _good()
    p["diet_plan"]["sample_day"] = []
    p["diet_plan"]["meal_schedule"] = [{"meal": "Lunch", "timing_note": "grilled fish fillet"}]
    assert "allergen_in_diet" in A._validate_plan(p, {"allergies": "fish"})


def test_allergen_word_boundary_no_false_positive():
    # "nut" allergy must not false-hit "nutrition" / "coconut" prose
    p = _good()
    p["diet_plan"]["macro_rationale"] = "solid nutrition with coconut water"
    assert A._validate_plan(p, {"allergies": "nut"}) == []


def test_questions_shape():
    assert A._validate_plan({"type": "questions", "questions": ["How many days?"]}) == []
    assert A._validate_plan({"type": "questions", "questions": []}) == ["questions_shape"]


def test_bad_plan_is_retried_then_clean_one_served(client, api_key, monkeypatch):
    broken = _good()
    broken["diet_plan"]["protein_g"] = 300
    calls = install_fake_client(monkeypatch, [json.dumps(broken), json.dumps(VALID_PLAN)])
    resp, body = post_trainer(client, {"intake": {"name": "T", "goal": "muscle gain"}})
    assert resp.status_code == 200
    assert json.loads(body.strip()) == VALID_PLAN
    assert len(calls) == 2  # first attempt flunked the gate, second served


def test_flawed_plan_served_when_chain_exhausts(client, api_key, monkeypatch):
    broken = _good()
    broken["diet_plan"]["protein_g"] = 300
    calls = install_fake_client(monkeypatch, [json.dumps(broken)] * 4)
    resp, body = post_trainer(client, {"intake": {"name": "T", "goal": "muscle gain"}})
    assert resp.status_code == 200
    assert json.loads(body.strip()) == broken  # soft-served, never an error page
    assert len(calls) == 4


def test_checkin_digests_reach_the_model(client, api_key, monkeypatch):
    calls = install_fake_client(monkeypatch, [json.dumps(VALID_PLAN)])
    resp, body = post_trainer(client, {
        "mode": "checkin",
        "intake": {"name": "T", "goal": "muscle gain"},
        "prev_plan": {"split": "Upper/Lower", "days": [{"day": "Upper A"}]},
        "log_digest": {"sessions": [{"day": "Upper A", "best_sets": ["Bench: 70kg x 8"]}]},
    })
    assert resp.status_code == 200
    contents = calls[0]["contents"]
    assert "PREVIOUS PLAN" in contents and "Upper/Lower" in contents
    assert "TRAINING LOG" in contents and "70kg x 8" in contents


def test_digests_ignored_outside_checkin_and_when_oversized(client, api_key, monkeypatch):
    calls = install_fake_client(monkeypatch, [json.dumps(VALID_PLAN)])
    post_trainer(client, {"intake": {"name": "T", "goal": "muscle gain"},
                          "prev_plan": {"split": "Upper/Lower"}})
    assert "PREVIOUS PLAN" not in calls[0]["contents"]
    calls2 = install_fake_client(monkeypatch, [json.dumps(VALID_PLAN)])
    post_trainer(client, {"mode": "checkin",
                          "intake": {"name": "T", "goal": "muscle gain"},
                          "prev_plan": {"pad": "x" * 30000}})
    assert "PREVIOUS PLAN" not in calls2[0]["contents"]
