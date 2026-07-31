"""Site smoke QA: homepage cleanliness/overflow + The Trainer tabs and demo plan flow.

Assumes the Flask server is ALREADY running (does not start it):
    python3 qa/site_qa.py [base_url]     # default http://127.0.0.1:5099

Writes qa/trainer_report.json and screenshots into qa/shots/.
Exit code 1 if any check failed.
"""
import json
import os
import sys
import time
import traceback

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5099"
OUT = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(OUT, "shots")
REPORT = os.path.join(OUT, "trainer_report.json")
os.makedirs(SHOTS, exist_ok=True)

checks = []


def check(name, ok, detail=""):
    checks.append({"name": name, "pass": bool(ok), "detail": str(detail)[:400],
                   "ts": time.strftime("%Y-%m-%dT%H:%M:%S")})
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" — {str(detail)[:140]}" if detail else ""))


def fresh_page(browser, width, errs):
    pg = browser.new_page(viewport={"width": width, "height": 900})
    pg.on("console", lambda m: errs.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
    return pg


def no_h_overflow(pg):
    return pg.evaluate("""() => {
        const doc = document.documentElement;
        const w = Math.max(doc.scrollWidth, document.body ? document.body.scrollWidth : 0);
        return {overflow: w > doc.clientWidth + 1, scrollW: w, clientW: doc.clientWidth};
    }""")


with sync_playwright() as p:
    browser = p.chromium.launch()
    try:
        # ── homepage at desktop + mobile widths: console-clean, no horizontal overflow ──
        for width in (1280, 390):
            errs = []
            pg = fresh_page(browser, width, errs)
            pg.goto(BASE + "/", wait_until="networkidle", timeout=30000)
            pg.wait_for_timeout(600)
            check(f"home_{width}_console_clean", len(errs) == 0, "; ".join(errs[:5]))
            ov = no_h_overflow(pg)
            check(f"home_{width}_no_h_overflow", not ov["overflow"],
                  f"scrollW={ov['scrollW']} clientW={ov['clientW']}")
            pg.screenshot(path=os.path.join(SHOTS, f"site_home_{width}.png"))
            pg.close()

        # ── /trainer: mode tabs exist and toggle the two forms ──
        errs = []
        pg = fresh_page(browser, 1280, errs)
        pg.goto(BASE + "/trainer", wait_until="networkidle", timeout=30000)
        check("trainer_loads", pg.title() != "", pg.title())
        check("trainer_has_mode_tabs",
              pg.evaluate("() => !!document.getElementById('tabPlan') && !!document.getElementById('tabCheckin')"))

        def form_visibility():
            return pg.evaluate("""() => ({
                intake: getComputedStyle(document.getElementById('intakeForm')).display !== 'none',
                checkin: getComputedStyle(document.getElementById('checkinForm')).display !== 'none',
            })""")

        vis0 = form_visibility()
        check("trainer_default_shows_intake", vis0["intake"] and not vis0["checkin"], vis0)
        # S28: the check-in tab is gated on a saved plan (a no-plan "recalibration"
        # is a stateless from-scratch plan — a bug). Hidden cold; shown once a plan
        # exists. Seed one to exercise the toggle.
        checkin_hidden_cold = not pg.is_visible("#tabCheckin")
        check("trainer_checkin_tab_gated_cold", checkin_hidden_cold, "hidden with no plan")
        pg.evaluate("""() => localStorage.setItem('trainerLastPlan', JSON.stringify({
            at: Date.now(), plan: { type:'plan',
              workout_days:[{day_label:'Full body', exercises:[
                {name:'Squat', sets:3, rest_seconds:120},
                {name:'Bench Press', sets:3, rest_seconds:120},
                {name:'Row', sets:3, rest_seconds:90}]}],
              diet_plan:{calorie_target_kcal:2500, protein_g:180, carbs_g:250, fat_g:78} },
            safety:{ allergies:'', injuries:'', equipment:'full gym', diet:'omnivore',
              dob:'1995-01-01', sex:'Male' } })); """)
        pg.reload(wait_until="networkidle", timeout=30000)
        pg.wait_for_timeout(300)
        check("trainer_checkin_tab_shown_with_plan", pg.is_visible("#tabCheckin"), "shown with a plan")
        pg.click("#tabCheckin")
        pg.wait_for_timeout(250)
        vis1 = form_visibility()
        check("trainer_tab_switch_to_checkin", vis1["checkin"] and not vis1["intake"], vis1)
        pg.click("#tabPlan")
        pg.wait_for_timeout(250)
        vis2 = form_visibility()
        check("trainer_tab_switch_back_to_plan", vis2["intake"] and not vis2["checkin"], vis2)
        pg.evaluate("() => localStorage.clear()")
        pg.screenshot(path=os.path.join(SHOTS, "site_trainer_form.png"))
        pg.close()

        # ── /trainer?demo: full intake -> demo plan render ──
        errs = []
        pg = fresh_page(browser, 1280, errs)
        pg.goto(BASE + "/trainer?demo", wait_until="networkidle", timeout=30000)
        pg.fill("#fName", "QA Smoke")
        pg.fill("#fDob", "2002-05-01")
        pg.fill("#fHeight", "178 cm")
        pg.fill("#fWeight", "82 kg")
        pg.click("#next1"); pg.click("#next2"); pg.click("#buildBtn")
        try:
            pg.wait_for_selector(".plan-wrap.show", timeout=45000)
            check("demo_plan_appears", True)
        except Exception as exc:
            check("demo_plan_appears", False, exc)
        pg.wait_for_timeout(500)

        sections = pg.evaluate("() => document.querySelectorAll('.pd-h').length")
        check("demo_plan_sections_gte_8", sections >= 8, f"{sections} .pd-h sections")

        doc_text = pg.evaluate(
            "() => { const d = document.getElementById('planDoc'); return d ? d.innerText : ''; }")
        check("demo_plan_no_undefined", bool(doc_text) and "undefined" not in doc_text,
              f"{len(doc_text)} chars of plan text")
        check("demo_flow_console_clean", len(errs) == 0, "; ".join(errs[:5]))
        pg.screenshot(path=os.path.join(SHOTS, "site_trainer_plan.png"), full_page=True)

        # ── sprint 2: share link round-trip (same page keeps the saved plan) ──
        share_url = None
        try:
            ctx_share = browser.new_context(permissions=["clipboard-read", "clipboard-write"])
            pgs = ctx_share.new_page()
            pgs.goto(BASE + "/trainer?demo", wait_until="networkidle", timeout=30000)
            pgs.fill("#fName", "QA Smoke"); pgs.fill("#fDob", "2002-05-01")
            pgs.fill("#fHeight", "178 cm"); pgs.fill("#fWeight", "82 kg")
            pgs.click("#next1"); pgs.click("#next2"); pgs.click("#buildBtn"); pgs.wait_for_selector(".plan-wrap.show", timeout=45000)
            pgs.click("#shareBtn"); pgs.wait_for_timeout(600)
            share_url = pgs.evaluate("navigator.clipboard.readText()")
            check("share_link_copied", isinstance(share_url, str) and "#p=" in share_url,
                  f"{len(share_url or '')} chars")
            ctx_share.close()
        except Exception as exc:
            check("share_link_copied", False, exc)

        if share_url:
            errs_s = []
            pg2 = fresh_page(browser, 1280, errs_s)
            pg2.goto(share_url, wait_until="networkidle", timeout=30000)
            try:
                pg2.wait_for_selector(".plan-wrap.show", timeout=10000)
                sec2 = pg2.evaluate("() => document.querySelectorAll('.pd-h').length")
                check("shared_link_renders_plan", sec2 >= 8, f"{sec2} sections")
            except Exception as exc:
                check("shared_link_renders_plan", False, exc)
            check("shared_link_console_clean", len(errs_s) == 0, "; ".join(errs_s[:5]))
            pg2.close()

        # ── sprint 2: workout logger + check-in autofill ──
        # seed a REAL saved plan (samples no longer persist — privacy fix) so the
        # Log tab has a program to log against
        REAL_PLAN = {"type": "plan", "profile_summary": {"name": "QA", "goal": "Muscle gain"},
                     "workout_days": [{"day_label": "Day 1", "exercises": [
                        {"name": "Bench press", "sets": 3, "rep_range": "5-8", "rest_seconds": 120, "rpe_or_rir": "RIR 2"},
                        {"name": "Barbell row", "sets": 3, "rep_range": "8-12", "rest_seconds": 90, "rpe_or_rir": "RIR 2"},
                        {"name": "Back squat", "sets": 3, "rep_range": "5-8", "rest_seconds": 150, "rpe_or_rir": "RIR 2"}]}],
                     "diet_plan": {"calorie_target_kcal": 2800}}
        pg.goto(BASE + "/trainer", wait_until="networkidle", timeout=30000)
        pg.evaluate("(p) => localStorage.setItem('trainerLastPlan', JSON.stringify({at: Date.now(), plan: p}))", REAL_PLAN)
        pg.reload(wait_until="networkidle", timeout=30000)
        check("log_tab_visible_with_saved_plan",
              pg.evaluate("() => document.getElementById('tabLog').style.display !== 'none'"))
        pg.click("#tabLog"); pg.wait_for_timeout(300)
        blocks = pg.evaluate("() => document.querySelectorAll('#lgList .lg-ex').length")
        check("log_form_has_exercises", blocks >= 3, f"{blocks} exercise blocks")
        for kg in ("60", "65"):
            pg.fill('#lgList input[data-ex="0"][data-set="0"][data-k="kg"]', kg)
            pg.fill('#lgList input[data-ex="0"][data-set="0"][data-k="reps"]', "8")
            pg.click("#logBtn"); pg.wait_for_timeout(250)
        hist = pg.evaluate("() => document.querySelectorAll('#lgHist .lg-hrow').length")
        check("log_history_two_sessions", hist == 2, f"{hist} history rows")
        pg.click("#tabCheckin"); pg.wait_for_timeout(250)
        autofill = pg.evaluate("() => document.getElementById('cLifts').value")
        check("checkin_autofill_from_logs",
              "60 kg x 8 -> 65 kg x 8" in autofill, autofill[:120])

        # ── sprint 7: a demo submit must never clobber a saved real plan ──
        pg.evaluate("localStorage.setItem('trainerLastPlan', JSON.stringify({at: 111, plan: {type:'plan', profile_summary:{goal:'REAL'}, workout_days:[{day_label:'D', exercises:[{name:'X', sets:3}]}]}}))")
        pg.goto(BASE + "/trainer?demo", wait_until="networkidle", timeout=30000)
        pg.fill("#fName", "QA"); pg.fill("#fDob", "2002-05-01")
        pg.fill("#fHeight", "178"); pg.fill("#fWeight", "82")
        pg.click("#next1"); pg.click("#next2"); pg.click("#buildBtn")
        pg.wait_for_selector(".plan-wrap.show", timeout=45000)
        check("demo_never_clobbers_saved_plan",
              pg.evaluate("() => JSON.parse(localStorage.getItem('trainerLastPlan')).plan.profile_summary.goal === 'REAL'"))
        # PRIVACY: a sample/demo is exploratory and must NEVER persist as a saved
        # plan or raise a "Restore last plan" tab — it used to, so a peeked sample
        # masqueraded as the visitor's own data on a shared browser (GUARDIANS bug).
        pg.evaluate("localStorage.removeItem('trainerLastPlan')")
        pg.goto(BASE + "/trainer?demo", wait_until="networkidle", timeout=30000)
        pg.fill("#fName", "QA"); pg.fill("#fDob", "2002-05-01")
        pg.fill("#fHeight", "178"); pg.fill("#fWeight", "82")
        pg.click("#next1"); pg.click("#next2"); pg.click("#buildBtn")
        pg.wait_for_selector(".plan-wrap.show", timeout=45000)
        check("demo_peek_does_not_persist",
              pg.evaluate("() => localStorage.getItem('trainerLastPlan') === null"))
        check("demo_peek_no_restore_tab",
              pg.evaluate("() => document.getElementById('tabRestore').style.display === 'none'"))
        # re-seed the real plan for the coach-mode checks below
        pg.evaluate("(p) => localStorage.setItem('trainerLastPlan', JSON.stringify({at: Date.now(), plan: p}))", REAL_PLAN)
        pg.goto(BASE + "/trainer", wait_until="networkidle", timeout=30000)

        # ── sprint 6: Q&A panel + account surfaces exist ──
        check("qa_panel_present",
              pg.evaluate("() => !!document.getElementById('qaWrap') && document.querySelectorAll('.qa-chip').length === 3"))
        check("account_surfaces_present",
              pg.evaluate("() => !!document.getElementById('acct') && !!document.getElementById('tabAcct')"))

        # ── sprint 5: coach mode opens, adjusts, and counts rest ──
        pg.click("#tabLog"); pg.wait_for_timeout(250)
        pg.click("#coachStart"); pg.wait_for_timeout(250)
        check("coach_opens_readiness",
              pg.evaluate("() => !document.getElementById('coach').hidden && !document.getElementById('coReady').hidden"))
        pg.click("#coBegin"); pg.wait_for_timeout(250)
        check("coach_shows_exercise",
              pg.evaluate("() => !document.getElementById('coEx').hidden && document.getElementById('coName').textContent.length > 3"))
        pg.fill("#coKg0", "60"); pg.fill("#coRp0", "8")
        pg.click('.co-log[data-set="0"]'); pg.wait_for_timeout(300)
        check("coach_rest_timer_runs",
              pg.evaluate("() => !document.getElementById('coRest').hidden && /\\d:\\d\\d/.test(document.getElementById('coTimer').textContent)"))
        pg.click("#coSkip"); pg.wait_for_timeout(200)
        pg.click("#coExit"); pg.wait_for_timeout(200)
        pg.click("#coClose"); pg.wait_for_timeout(200)
        check("coach_session_saved_to_log",
              pg.evaluate("() => JSON.parse(localStorage.getItem('trainerLogs'))[0].entries.some(e => e.sets.length)"))

        # ── sprint 3: PWA assets reachable and sane ──
        pwa = pg.evaluate("""async () => {
          const out = { manifest_link: !!document.querySelector('link[rel="manifest"]') };
          for (const [k, u] of [['sw', '/trainer-sw.js'],
                                ['manifest', '/static/trainer/manifest.json'],
                                ['icon192', '/static/trainer/icon-192.png'],
                                ['icon512', '/static/trainer/icon-512.png']]) {
            try { out[k] = (await fetch(u)).status; } catch (e) { out[k] = String(e); }
          }
          try { out.start_url = (await (await fetch('/static/trainer/manifest.json')).json()).start_url; }
          catch (e) { out.start_url = String(e); }
          return out;
        }""")
        check("pwa_assets_served", pwa.get("manifest_link") and pwa.get("sw") == 200
              and pwa.get("manifest") == 200 and pwa.get("icon192") == 200
              and pwa.get("icon512") == 200 and pwa.get("start_url") == "/trainer", pwa)
        pg.close()

    except Exception:
        check("script_completed_without_exception", False, traceback.format_exc())
    finally:
        browser.close()

passed = sum(1 for c in checks if c["pass"])
failed = len(checks) - passed
report = {"base_url": BASE, "generated": time.strftime("%Y-%m-%dT%H:%M:%S"),
          "passed": passed, "failed": failed, "checks": checks}
with open(REPORT, "w") as f:
    json.dump(report, f, indent=2)
print(f"\n{passed}/{len(checks)} checks passed — report: {REPORT}")
sys.exit(1 if failed else 0)
