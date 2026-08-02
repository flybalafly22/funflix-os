"""Sprint 34 — periodization block banner. Seeds plans with a known start date +
deload cadence and asserts the What's-Next card shows the right mesocycle line
(all offline, no API key).

    python3 qa/qa_block_phase.py [base_url]   # default http://127.0.0.1:5099
"""
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5099"
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots")
DAY = 86400000
res = {}


def plan_started_weeks_ago(n):
    at = int(time.time() * 1000) - int((n * 7 + 0.04) * DAY)   # n full weeks + a sliver
    return {"at": at, "plan": {"type": "plan",
            "workout_days": [{"day_label": "Full body", "exercises": [
                {"name": "Squat", "sets": 3, "rep_range": "5-8", "rest_seconds": 180}]}],
            "progressive_overload": {"deload": "Deload every 6 weeks (halve sets, -15-20% load)."},
            "duration_and_paths": {"plan_duration_months": 3},
            "diet_plan": {"calorie_target_kcal": 2600, "protein_g": 180, "carbs_g": 300, "fat_g": 70}},
            "safety": {"allergies": "", "injuries": "", "equipment": "gym", "diet": "omni",
                       "dob": "1995-01-01", "sex": "Male"}}


def read_block(pg, weeks_ago):
    pg.evaluate("(s) => localStorage.setItem('trainerLastPlan', s)", json.dumps(plan_started_weeks_ago(weeks_ago)))
    pg.evaluate("() => localStorage.setItem('trainerLogs', '[]')")
    pg.reload(wait_until="networkidle")
    pg.wait_for_timeout(250)
    pg.click("#tabLog")
    pg.wait_for_timeout(400)
    if not pg.is_visible("#nxBlock"):
        return ""
    return pg.inner_text("#nxBlock")


def main():
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1280, "height": 1000})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.goto(BASE + "/trainer", wait_until="networkidle")

        b2 = read_block(pg, 2).lower()        # 2 full weeks in -> week 3 of 6, block 1
        res["wk2"] = b2
        res["wk2_block1_wk3"] = "block 1" in b2 and "week 3 of 6" in b2 and "3 to deload" in b2 and "of ~13" in b2

        # 7 weeks in, having marked a deload ~1 week ago -> block 2, week 2 accumulation
        pg.evaluate("(s) => localStorage.setItem('trainerLastPlan', s)", json.dumps(plan_started_weeks_ago(7)))
        pg.evaluate("() => localStorage.setItem('trainerLogs', '[]')")
        pg.evaluate("(t) => localStorage.setItem('trainerDeloadDone', String(t))",
                    int(time.time() * 1000) - int((7 + 0.04) * DAY))
        pg.reload(wait_until="networkidle")
        pg.wait_for_timeout(250)
        pg.click("#tabLog")
        pg.wait_for_timeout(400)
        b7 = (pg.inner_text("#nxBlock") if pg.is_visible("#nxBlock") else "").lower()
        res["wk7"] = b7
        res["wk7_block2_wk2"] = "block 2" in b7 and "week 2 of 6" in b7 and "accumulation" in b7
        pg.evaluate("() => localStorage.removeItem('trainerDeloadDone')")

        b5 = read_block(pg, 5).lower()        # week 6 of the block -> deload week
        res["wk5"] = b5
        res["wk5_deload"] = "deload week" in b5

        pg.click("#tabLog")
        pg.wait_for_timeout(200)
        pg.screenshot(path=os.path.join(SHOTS, "s34_block_phase.png"))
        res["page_errors"] = errs
        b.close()


main()
print(json.dumps(res, indent=2))
ok = all(v is True for k, v in res.items() if isinstance(v, bool)) and not res.get("page_errors")
print("BLOCK-PHASE:", "ALL OK" if ok else "FAIL")
sys.exit(0 if ok else 1)
