"""Integrity checks for data/trainer_demo.json — the keyless demo plan that
the /trainer UI renders. It must stay a well-formed 'plan' document: the
front-end renders its sections blindly, so structural drift shows up as
'undefined' in the rendered plan."""
import json
import os

import pytest

DEMO_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                         "data", "trainer_demo.json")

EXERCISE_KEYS = {"name", "sets", "rep_range", "rest_seconds",
                 "rpe_or_rir", "tempo_or_notes", "substitution"}
EVIDENCE_LEVELS = {"strong", "moderate", "context-dependent"}


@pytest.fixture(scope="module")
def demo():
    with open(DEMO_PATH) as f:
        return json.load(f)


def test_demo_file_parses(demo):
    assert isinstance(demo, dict)


def test_demo_type_is_plan(demo):
    assert demo.get("type") == "plan"


def test_macro_arithmetic_matches_calorie_target(demo):
    diet = demo["diet_plan"]
    protein = diet["protein_g"]
    carbs = diet["carbs_g"]
    fat = diet["fat_g"]
    target = diet["calorie_target_kcal"]
    computed = protein * 4 + carbs * 4 + fat * 9
    assert target > 0
    assert abs(computed - target) / target <= 0.02, (
        f"macros compute to {computed} kcal vs target {target} kcal "
        f"(off by {abs(computed - target) / target:.1%}, tolerance 2%)")


def test_every_exercise_has_exactly_the_expected_keys(demo):
    days = demo["workout_days"]
    assert isinstance(days, list) and days
    for day in days:
        exercises = day.get("exercises")
        assert isinstance(exercises, list) and exercises, f"day missing exercises: {day.get('day')}"
        for ex in exercises:
            assert isinstance(ex, dict)
            assert set(ex.keys()) == EXERCISE_KEYS, (
                f"exercise {ex.get('name')!r} keys {sorted(ex.keys())} "
                f"!= expected {sorted(EXERCISE_KEYS)}")


def test_weekly_split_has_seven_days(demo):
    days = demo["weekly_split"]["days"]
    assert isinstance(days, list)
    assert len(days) == 7


def test_supplement_evidence_levels_are_known(demo):
    supplements = demo["supplements"]
    assert isinstance(supplements, list) and supplements
    for sup in supplements:
        level = sup.get("evidence_level")
        assert level in EVIDENCE_LEVELS, (
            f"supplement {sup.get('name')!r} has evidence_level {level!r}")


def test_medical_disclaimer_present(demo):
    disclaimer = demo["safety_notes"]["medical_disclaimer"]
    assert isinstance(disclaimer, str)
    assert disclaimer.strip()
