"""Sprint 35 — the check-in payload now carries measured training state so the
recalibration can apply its own rules (deload if 6+ weeks since the last; a
stalled lift -> 10% reset) instead of guessing. Offline (intercepts /api/trainer).

    python3 qa/qa_checkin_state.py [base_url]   # default http://127.0.0.1:5099
"""
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5099"
DAY = 86400000
NOW = int(time.time() * 1000)

PLAN = {"at": NOW - int(49.1 * DAY),   # 7 weeks ago
        "plan": {"type": "plan", "experience_level": "intermediate",
                 "workout_days": [{"day_label": "Full body", "exercises": [
                     {"name": "Bench Press", "sets": 3, "rep_range": "5-10", "rest_seconds": 120}]}],
                 "progressive_overload": {"deload": "Deload every 6 weeks."},
                 "duration_and_paths": {"plan_duration_months": 3},
                 "diet_plan": {"calorie_target_kcal": 2600, "protein_g": 180, "carbs_g": 300, "fat_g": 70}},
        "safety": {"allergies": "", "injuries": "", "equipment": "gym", "diet": "omni",
                   "dob": "1995-01-01", "sex": "Male"}}
# 6 flat weekly sessions of Bench -> stalled (no e1RM gain) AND 6 trained weeks -> deload due
LOGS = [{"at": NOW - k * 7 * DAY, "day": "Full body",
         "entries": [{"name": "Bench Press",
                      "sets": [{"kg": "60", "reps": "8"}, {"kg": "60", "reps": "8"}, {"kg": "60", "reps": "8"}]}]}
        for k in range(1, 7)]
res = {}


def main():
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1280, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.goto(BASE + "/trainer", wait_until="networkidle")
        demo = pg.evaluate("() => fetch('/api/trainer', {method:'POST', headers:{'Content-Type':'application/json'},"
                           " body: JSON.stringify({demo:1})}).then(r => r.text())")
        pg.evaluate("(s) => localStorage.setItem('trainerLastPlan', s)", json.dumps(PLAN))
        pg.evaluate("(s) => localStorage.setItem('trainerLogs', s)", json.dumps(LOGS))
        pg.reload(wait_until="networkidle")
        pg.wait_for_timeout(300)

        captured = {}

        def handle(route):
            captured["body"] = route.request.post_data
            route.fulfill(status=200, content_type="text/plain", body=demo)

        pg.route("**/api/trainer", handle)
        pg.click("#tabCheckin")
        pg.wait_for_timeout(300)
        pg.fill("#cName", "Sam")
        pg.fill("#cWeightStart", "80 kg")
        pg.fill("#cWeightNow", "80.2 kg")
        pg.click("#checkinForm button[type=submit]")
        pg.wait_for_timeout(700)
        intake = json.loads(captured.get("body") or "{}").get("intake", {})
        res["intake_keys_present"] = all(k in intake for k in (
            "weeks since last deload (computed)",
            "deload currently due (computed)",
            "lifts stalled 2+ sessions by e1RM (computed)"))
        try:
            res["weeks_since_deload_ge_6"] = int(intake.get("weeks since last deload (computed)", "0")) >= 6
        except ValueError:
            res["weeks_since_deload_ge_6"] = False
        res["deload_due_yes"] = intake.get("deload currently due (computed)") == "yes"
        res["stall_lists_bench"] = "Bench Press" in (intake.get("lifts stalled 2+ sessions by e1RM (computed)") or "")
        pg.unroute("**/api/trainer")
        res["page_errors"] = errs
        b.close()


main()
print(json.dumps(res, indent=2))
ok = all(v is True for k, v in res.items() if isinstance(v, bool)) and not res.get("page_errors")
print("CHECKIN-STATE:", "ALL OK" if ok else "FAIL")
sys.exit(0 if ok else 1)
