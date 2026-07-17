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
        pg.click("#tabCheckin")
        pg.wait_for_timeout(250)
        vis1 = form_visibility()
        check("trainer_tab_switch_to_checkin", vis1["checkin"] and not vis1["intake"], vis1)
        pg.click("#tabPlan")
        pg.wait_for_timeout(250)
        vis2 = form_visibility()
        check("trainer_tab_switch_back_to_plan", vis2["intake"] and not vis2["checkin"], vis2)
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
        pg.click("#buildBtn")
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
