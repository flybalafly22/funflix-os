"""Sprint 37 — interactive exercise swap (Log form) + hardened deload-cadence
parse. Offline (no API key).

    python3 qa/qa_swap_cadence.py [base_url]   # default http://127.0.0.1:5099
"""
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5099"
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots")
res = {}


def swap_plan():
    return {"at": int(time.time() * 1000),
            "plan": {"type": "plan", "workout_days": [{"day_label": "Push", "exercises": [
                {"name": "Barbell Bench Press", "sets": 3, "rep_range": "5-8", "rest_seconds": 150,
                 "rpe_or_rir": "RIR 2", "substitution": "Dumbbell bench press"}]}],
                "diet_plan": {"calorie_target_kcal": 2600, "protein_g": 180, "carbs_g": 300, "fat_g": 70}},
            "safety": {"allergies": "", "injuries": "", "equipment": "gym", "diet": "omni",
                       "dob": "1995-01-01", "sex": "Male"}}


def cadence_plan(deload_text):
    return {"at": int(time.time() * 1000) - 3600000,   # ~an hour in -> week 1, accumulation
            "plan": {"type": "plan", "workout_days": [{"day_label": "Full body", "exercises": [
                {"name": "Squat", "sets": 3, "rep_range": "5-8", "rest_seconds": 180}]}],
                "progressive_overload": {"deload": deload_text},
                "duration_and_paths": {"plan_duration_months": 3},
                "diet_plan": {"calorie_target_kcal": 2600, "protein_g": 180, "carbs_g": 300, "fat_g": 70}},
            "safety": {"allergies": "", "injuries": "", "equipment": "gym", "diet": "omni",
                       "dob": "1995-01-01", "sex": "Male"}}


def read_cadence(pg, text):
    pg.evaluate("(s) => localStorage.setItem('trainerLastPlan', s)", json.dumps(cadence_plan(text)))
    pg.evaluate("() => localStorage.setItem('trainerLogs', '[]')")
    pg.reload(wait_until="networkidle")
    pg.wait_for_timeout(250)
    pg.click("#tabLog")
    pg.wait_for_timeout(350)
    return pg.inner_text("#nxBlock").lower() if pg.is_visible("#nxBlock") else ""


def main():
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1280, "height": 950})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.goto(BASE + "/trainer", wait_until="networkidle")

        # ── interactive swap ──
        pg.evaluate("(s) => localStorage.setItem('trainerLastPlan', s)", json.dumps(swap_plan()))
        pg.evaluate("() => localStorage.setItem('trainerLogs', '[]')")
        pg.reload(wait_until="networkidle")
        pg.wait_for_timeout(300)
        pg.click("#tabLog")
        pg.wait_for_timeout(400)
        res["shows_original_name"] = "Barbell Bench Press" in pg.inner_text("#lgList .lg-name")
        res["swap_btn_offers_sub"] = "Dumbbell bench press" in pg.inner_text("#lgList .lg-swap")
        pg.click("#lgList .lg-swap")
        pg.wait_for_timeout(250)
        res["after_swap_shows_sub"] = "Dumbbell bench press" in pg.inner_text("#lgList .lg-name")
        res["swap_persisted"] = pg.evaluate(
            "() => (JSON.parse(localStorage.getItem('trainerSwaps')||'{}'))['Push::Barbell Bench Press'] === 'Dumbbell bench press'")
        # log a set while swapped -> the entry is stored under the substitution name
        pg.fill('#lgList input[data-ex="0"][data-k="kg"]', "30")
        pg.fill('#lgList input[data-ex="0"][data-k="reps"]', "8")
        pg.click("#logBtn")
        pg.wait_for_timeout(400)
        res["logged_under_sub"] = pg.evaluate(
            "() => (JSON.parse(localStorage.getItem('trainerLogs')||'[]')[0]||{}).entries[0].name === 'Dumbbell bench press'")
        pg.screenshot(path=os.path.join(SHOTS, "s37_swap.png"))
        # swap back
        pg.click("#lgList .lg-swap")
        pg.wait_for_timeout(250)
        res["revert_shows_original"] = "Barbell Bench Press" in pg.inner_text("#lgList .lg-name")

        # ── hardened deload-cadence parse ──
        res["cad_every5"] = "of 5" in read_cadence(pg, "Deload every 5 weeks (halve sets).")
        res["cad_ordinal4"] = "of 4" in read_cadence(pg, "Take a deload every 4th week.")
        res["cad_after7"] = "of 7" in read_cadence(pg, "Plan a deload after 7 weeks of hard training.")
        res["cad_default6"] = "of 6" in read_cadence(pg, "Deload periodically as fatigue accumulates.")

        res["page_errors"] = errs
        b.close()


main()
print(json.dumps(res, indent=2))
ok = all(v is True for k, v in res.items() if isinstance(v, bool)) and not res.get("page_errors")
print("SWAP-CADENCE:", "ALL OK" if ok else "FAIL")
sys.exit(0 if ok else 1)
