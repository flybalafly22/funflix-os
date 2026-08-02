"""Sprint 36 — configurable bar + unit in Coach Mode's plate math. The bar was
hardcoded to a 20 kg Olympic bar; now a 15 kg women's bar or a 45/35 lb bar loads
correctly, in the user's unit, and the choice is remembered. Offline (no API).

    python3 qa/qa_bar_plate.py [base_url]   # default http://127.0.0.1:5099
"""
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5099"
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots")

PLAN = {"at": int(time.time() * 1000),
        "plan": {"type": "plan",
                 "workout_days": [{"day_label": "Lower", "estimated_duration_minutes": 60, "warmup": "5 min bike",
                                   "exercises": [{"name": "Back Squat", "sets": 3, "rep_range": "5-8",
                                                  "rest_seconds": 180, "rpe_or_rir": "RIR 2",
                                                  "tempo_or_notes": "brace hard", "substitution": "Goblet squat"}]}],
                 "diet_plan": {"calorie_target_kcal": 2600, "protein_g": 180, "carbs_g": 300, "fat_g": 70}},
        "safety": {"allergies": "", "injuries": "", "equipment": "gym", "diet": "omni",
                   "dob": "1995-01-01", "sex": "Male"}}
res = {}


def open_coach(pg):
    pg.click("#tabLog")
    pg.wait_for_timeout(300)
    pg.click("#coachStart")
    pg.wait_for_timeout(250)
    pg.click("#coBegin")
    pg.wait_for_timeout(300)


def main():
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1280, "height": 950})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.goto(BASE + "/trainer", wait_until="networkidle")
        pg.evaluate("(s) => localStorage.setItem('trainerLastPlan', s)", json.dumps(PLAN))
        pg.reload(wait_until="networkidle")
        pg.wait_for_timeout(300)
        open_coach(pg)
        res["plates_visible_for_barbell"] = pg.is_visible("#coPlates") and pg.is_visible("#coBar")

        # ── default 20 kg bar: 100 kg → 25 + 15 per side, kg ──
        res["unit_label_kg"] = pg.inner_text("#coWUnit").strip().lower() == "kg"
        pg.fill("#coW", "100")
        pg.wait_for_timeout(150)
        out = pg.inner_text("#coPlateOut")
        res["kg_100_breakdown"] = "25 + 15" in out and "per side" in out
        res["kg_ramp_unit"] = "kg" in pg.inner_text("#coRamp")

        # ── switch to a 45 lb bar: 135 lb → single 45 per side, lb ──
        pg.select_option("#coBar", "45lb")
        pg.wait_for_timeout(150)
        res["unit_label_lb"] = pg.inner_text("#coWUnit").strip().lower() == "lb"
        pg.fill("#coW", "135")
        pg.wait_for_timeout(150)
        out2 = pg.inner_text("#coPlateOut")
        res["lb_135_breakdown"] = "45" in out2 and "per side" in out2
        res["lb_ramp_unit"] = "lb" in pg.inner_text("#coRamp")
        res["bar_choice_persisted"] = pg.evaluate("() => localStorage.getItem('trainerBar') === '45lb'")

        # ── 15 kg women's bar: 60 kg → 20 + 2.5 per side ──
        pg.select_option("#coBar", "15kg")
        pg.fill("#coW", "60")
        pg.wait_for_timeout(150)
        res["kg15_60_breakdown"] = "20 + 2.5" in pg.inner_text("#coPlateOut")

        pg.screenshot(path=os.path.join(SHOTS, "s36_bar_plate.png"))

        # ── choice survives a reload (remembered next session) ──
        pg.select_option("#coBar", "45lb")
        pg.wait_for_timeout(150)
        pg.reload(wait_until="networkidle")
        pg.wait_for_timeout(300)
        open_coach(pg)
        res["remembered_after_reload"] = pg.input_value("#coBar") == "45lb" and pg.inner_text("#coWUnit").strip().lower() == "lb"

        res["page_errors"] = errs
        b.close()


main()
print(json.dumps(res, indent=2))
ok = all(v is True for k, v in res.items() if isinstance(v, bool)) and not res.get("page_errors")
print("BAR-PLATE:", "ALL OK" if ok else "FAIL")
sys.exit(0 if ok else 1)
