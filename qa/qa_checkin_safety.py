"""Sprint 28 — Honest at check-in. Verifies, fully offline (the /api/trainer
call is intercepted, so no API key is needed):

  28.1  the check-in payload carries age (DOB) + gender forward from the saved
        plan's safety, so special-population rules survive a recalibration.
  28.2  the "Week-4 check-in" tab is hidden with no saved plan and shown once one
        exists (a no-plan check-in is a stateless from-scratch plan — a bug).
  28.3  a manually logged deload week is tagged deload:true and stamps the shared
        deload clock (DL_KEY), so stall-watch ignores it and no redundant deload
        is prescribed on top of it.

Assumes the server is already running.
    python3 qa/qa_checkin_safety.py [base_url]   # default http://127.0.0.1:5099
"""
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5099"
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots")
os.makedirs(SHOTS, exist_ok=True)

SEED_PLAN = {
    "at": int(time.time() * 1000) - 30 * 86400000,  # 30 days ago → ~4 weeks in
    "plan": {
        "type": "plan",
        "workout_days": [{
            "day_label": "Push",
            "exercises": [
                {"name": "Bench Press", "sets": 3, "rest_seconds": 120},
                {"name": "Overhead Press", "sets": 3, "rest_seconds": 120},
                {"name": "Triceps Pushdown", "sets": 3, "rest_seconds": 90},
            ],
        }],
        "diet_plan": {"calorie_target_kcal": 2500, "protein_g": 180, "carbs_g": 250, "fat_g": 78},
    },
    "safety": {"allergies": "peanuts", "injuries": "", "equipment": "full gym",
               "diet": "omnivore", "dob": "1968-04-12", "sex": "Female"},
}

res = {}


def main():
    with sync_playwright() as p:
        b = p.chromium.launch()
        errs = []
        pg = b.new_page(viewport={"width": 1280, "height": 900})
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)

        # a renderable plan to fulfill the intercepted /api/trainer with (keyless demo)
        pg.goto(BASE + "/trainer", wait_until="networkidle")
        demo = pg.evaluate(
            "() => fetch('/api/trainer', {method:'POST', headers:{'Content-Type':'application/json'},"
            " body: JSON.stringify({demo:1})}).then(r => r.text())")

        # ── 28.2a: cold, no saved plan → check-in tab hidden ──
        pg.evaluate("() => { localStorage.clear(); }")
        pg.reload(wait_until="networkidle")
        pg.wait_for_timeout(300)
        res["checkin_hidden_no_plan"] = not pg.is_visible("#tabCheckin")

        # ── seed a saved plan, reload → check-in + log tabs appear (28.2b) ──
        pg.evaluate("(s) => localStorage.setItem('trainerLastPlan', s)", json.dumps(SEED_PLAN))
        pg.reload(wait_until="networkidle")
        pg.wait_for_timeout(300)
        res["checkin_shown_with_plan"] = pg.is_visible("#tabCheckin")

        # ── 28.1: check-in payload carries DOB + gender forward ──
        captured = {}

        def handle(route):
            try:
                captured["body"] = route.request.post_data
            except Exception:
                captured["body"] = None
            route.fulfill(status=200, content_type="text/plain", body=demo)

        pg.route("**/api/trainer", handle)
        pg.click("#tabCheckin")
        pg.wait_for_timeout(300)
        pg.fill("#cName", "Meera")
        pg.fill("#cWeightStart", "72 kg")
        pg.fill("#cWeightNow", "70.4 kg")
        pg.click("#checkinForm button[type=submit]")
        pg.wait_for_timeout(700)
        body = json.loads(captured.get("body") or "{}")
        intake = body.get("intake", {})
        res["checkin_mode_sent"] = body.get("mode") == "checkin"
        res["dob_carried"] = intake.get("date of birth") == "1968-04-12"
        res["gender_carried"] = intake.get("gender assigned at birth") == "Female"
        res["allergies_still_carried"] = intake.get("allergies") == "peanuts"
        pg.unroute("**/api/trainer")

        # ── 28.3: a manually logged deload week is tagged + stamps the clock ──
        pg.reload(wait_until="networkidle")
        pg.wait_for_timeout(300)
        pg.click("#tabLog")
        pg.wait_for_timeout(400)
        pg.check("#lgDeload")
        pg.fill('#lgList input[data-ex="0"][data-k="kg"]', "60")
        pg.fill('#lgList input[data-ex="0"][data-k="reps"]', "8")
        pg.click("#logBtn")
        pg.wait_for_timeout(500)
        logs = pg.evaluate("() => JSON.parse(localStorage.getItem('trainerLogs') || '[]')")
        dl_clock = pg.evaluate("() => localStorage.getItem('trainerDeloadDone')")
        res["deload_session_tagged"] = bool(logs) and logs[0].get("deload") is True
        res["deload_clock_stamped"] = bool(dl_clock)
        res["box_reset_after_save"] = pg.evaluate("() => !document.getElementById('lgDeload').checked")

        pg.screenshot(path=os.path.join(SHOTS, "s28_checkin_safety.png"))
        res["page_errors"] = errs
        b.close()


main()
print(json.dumps(res, indent=2))
ok = all(v is True for k, v in res.items() if isinstance(v, bool)) and not res.get("page_errors")
print("CHECKIN-SAFETY:", "ALL OK" if ok else "FAIL")
sys.exit(0 if ok else 1)
