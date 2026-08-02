"""Sprint 33 — next-session targets. Seeds a plan + one prior session in
localStorage and asserts the Log form renders the right double-progression cue
per exercise (all offline, no API key).

    python3 qa/qa_next_target.py [base_url]   # default http://127.0.0.1:5099
"""
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5099"
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots")

EXS = [
    {"name": "Bench Press", "sets": 3, "rep_range": "5-10", "rest_seconds": 120},   # upper, all-top
    {"name": "Back Squat", "sets": 3, "rep_range": "5-8", "rest_seconds": 180},      # lower, all-top
    {"name": "Pull-up", "sets": 3, "rep_range": "6-12", "rest_seconds": 120},        # bodyweight, all-top
    {"name": "Overhead Press", "sets": 3, "rep_range": "5-10", "rest_seconds": 120},  # not-top
]
PLAN = {"at": int(time.time() * 1000),
        "plan": {"type": "plan", "workout_days": [{"day_label": "Full body", "exercises": EXS}],
                 "diet_plan": {"calorie_target_kcal": 2600, "protein_g": 180, "carbs_g": 300, "fat_g": 70}},
        "safety": {"allergies": "", "injuries": "", "equipment": "full gym", "diet": "omni", "dob": "1995-01-01", "sex": "Male"}}
LOGS = [{"at": int(time.time() * 1000) - 3 * 86400000, "day": "Full body", "entries": [
    {"name": "Bench Press", "sets": [{"kg": "60", "reps": "10"}, {"kg": "60", "reps": "10"}, {"kg": "60", "reps": "10"}]},
    {"name": "Back Squat", "sets": [{"kg": "100", "reps": "8"}, {"kg": "100", "reps": "8"}, {"kg": "100", "reps": "8"}]},
    {"name": "Pull-up", "sets": [{"kg": "", "reps": "12"}, {"kg": "", "reps": "12"}, {"kg": "", "reps": "12"}]},
    {"name": "Overhead Press", "sets": [{"kg": "40", "reps": "8"}, {"kg": "40", "reps": "7"}, {"kg": "40", "reps": "8"}]},
]}]
res = {}


def main():
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1280, "height": 1100})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.goto(BASE + "/trainer", wait_until="networkidle")
        pg.evaluate("(s) => localStorage.setItem('trainerLastPlan', s)", json.dumps(PLAN))
        pg.evaluate("(s) => localStorage.setItem('trainerLogs', s)", json.dumps(LOGS))
        pg.reload(wait_until="networkidle")
        pg.wait_for_timeout(300)
        pg.click("#tabLog")
        pg.wait_for_timeout(500)
        targets = pg.eval_on_selector_all(
            "#lgList .lg-ex", "els => els.map(e => { const t = e.querySelector('.lg-target'); return t ? t.textContent : null; })")
        res["count"] = len(targets)
        res["bench_add_2_5"] = bool(targets[0]) and "add 2.5 kg" in targets[0] and "62.5 kg" in targets[0]
        res["squat_add_5"] = bool(targets[1]) and "add 5 kg" in targets[1] and "105 kg" in targets[1]
        res["pullup_add_set"] = bool(targets[2]) and ("add a set" in targets[2] or "push past 12" in targets[2])
        res["ohp_aim_reps"] = bool(targets[3]) and "aim 8+" in targets[3] and "40 kg" in targets[3]
        pg.screenshot(path=os.path.join(SHOTS, "s33_next_target.png"))
        # a first-time exercise (no prior log) shows no target
        pg.evaluate("() => localStorage.setItem('trainerLogs', '[]')")
        pg.reload(wait_until="networkidle")
        pg.wait_for_timeout(300)
        pg.click("#tabLog")
        pg.wait_for_timeout(400)
        res["no_target_without_history"] = pg.eval_on_selector_all(
            "#lgList .lg-target", "els => els.length") == 0
        res["page_errors"] = errs
        b.close()


main()
print(json.dumps(res, indent=2))
ok = all(v is True for k, v in res.items() if isinstance(v, bool)) and not res.get("page_errors") and res.get("count") == 4
print("NEXT-TARGET:", "ALL OK" if ok else "FAIL")
sys.exit(0 if ok else 1)
