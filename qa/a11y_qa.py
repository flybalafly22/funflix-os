"""CADENCE's design and accessibility regressions from the 2026-09-25 evaluation.

Self-contained: starts the app on a free local port (no accounts, no secrets) and
checks, in headless Chromium, that each fixed finding stays fixed:

  F12  Coach Mode is a modal dialog: focus moves in, Tab stays in, Escape exits,
       the page behind is inert, focus comes back to the button that opened it
       (and a finished session is never logged twice)
  F13  Coach Mode set inputs carry real labels
  F16  one main landmark per page, a skip link, h2/h3 structure in the plan
  F15  home's locked questions are inert until unlocked
  F07  on phones the "Clear the floor" eyebrow never prints over "All of it. Gone."
  F19  the Log's "enter a set" error appears next to the button
  F22  44 px touch targets on phones (bar, tabs, Log set)
  F23  no "No. N" legacy labels in the footer
       and the palette never opens on top of another dialog

    python3 qa/a11y_qa.py            # exit 1 on any failure
"""
import json
import os
import socket
import sys
import threading
import time

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
os.chdir(ROOT)
import app as A                        # noqa: E402

with socket.socket() as s:
    s.bind(("127.0.0.1", 0))
    PORT = s.getsockname()[1]
BASE = f"http://127.0.0.1:{PORT}"
threading.Thread(target=lambda: A.app.run(host="127.0.0.1", port=PORT, use_reloader=False, threaded=True),
                 daemon=True).start()
for _ in range(80):
    try:
        socket.create_connection(("127.0.0.1", PORT), timeout=0.2).close()
        break
    except OSError:
        time.sleep(0.1)

DEMO = json.load(open(os.path.join(ROOT, "data", "trainer_demo.json")))
ok = True


def check(name, cond, detail=""):
    global ok
    ok = ok and bool(cond)
    print(("PASS " if cond else "FAIL ") + name + (f"  {detail}" if detail and not cond else ""), flush=True)


def logs(pg):
    return pg.evaluate("JSON.parse(localStorage.getItem('trainerLogs') || '[]').length")


with sync_playwright() as p:
    b = p.chromium.launch()
    errs = []

    # ── the Trainer on a phone, with a saved plan ──
    pg = b.new_page(viewport={"width": 390, "height": 844})
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE + "/trainer", wait_until="networkidle")
    pg.evaluate("(p) => localStorage.setItem('trainerLastPlan', JSON.stringify({at: Date.now(), plan: p}))", DEMO)
    pg.reload(wait_until="load"); pg.wait_for_timeout(900)
    pg.click("#tabLog"); pg.wait_for_timeout(300)

    tabs = pg.evaluate("Array.from(document.querySelectorAll('#modeTabs .mtab')).filter(t => t.offsetParent).map(t => Math.round(t.getBoundingClientRect().height))")
    check("F22 mode tabs are 44 px tall on phones", tabs and min(tabs) >= 44, tabs)
    bar = pg.evaluate("['hudBurger', 'hudTheme', 'hudCta'].map(id => { const e = document.getElementById(id); return e ? Math.round(e.getBoundingClientRect().height) : 44; })")
    check("F22 the shared bar's buttons are 44 px tall on phones", min(bar) >= 44, bar)
    check("F17 no sideways scrolling at 390", pg.evaluate("document.documentElement.scrollWidth <= innerWidth"))

    pg.evaluate("document.getElementById('logBtn').scrollIntoView({block: 'center'})"); pg.wait_for_timeout(150)
    pg.click("#logBtn"); pg.wait_for_timeout(200)
    e = pg.evaluate("(() => { const r = document.getElementById('lgErr').getBoundingClientRect(); return [r.height > 0, r.top >= 0 && r.bottom <= innerHeight]; })()")
    check("F19 the Log error shows on screen, by the button", e == [True, True], e)

    pg.focus("#coachStart"); pg.keyboard.press("Enter"); pg.wait_for_timeout(250)
    st = pg.evaluate("""(() => { const c = document.getElementById('coach');
        return [c.getAttribute('role'), c.getAttribute('aria-modal'), document.activeElement.id,
                document.querySelector('.page-wrap').inert, document.querySelector('.hud').inert]; })()""")
    check("F12 Coach Mode opens as a modal dialog with focus inside", st[:3] == ["dialog", "true", "coLeadR"], st)
    check("F12 the page behind Coach Mode is inert", st[3] and st[4], st)
    inside = []
    for key in ["Tab"] * 12 + ["Shift+Tab"] * 6:
        pg.keyboard.press(key)
        inside.append(pg.evaluate("document.getElementById('coach').contains(document.activeElement)"))
    check("F12 Tab and Shift+Tab never leave Coach Mode", all(inside), inside)
    pg.keyboard.press("Control+k"); pg.wait_for_timeout(150)
    check("the palette never opens over Coach Mode", not pg.evaluate("document.querySelector('.palette').classList.contains('open')"))

    pg.click("#coBegin"); pg.wait_for_timeout(250)
    lab = pg.evaluate("[document.getElementById('coKg0').getAttribute('aria-label'), document.getElementById('coRp0').getAttribute('aria-label')]")
    check("F13 set inputs are labelled", lab == ["Set 1 weight, kg", "Set 1 reps"], lab)
    check("F22 Log set is a 44 px target", pg.evaluate("document.querySelector('.co-log').getBoundingClientRect().height") >= 44)

    before = logs(pg)
    pg.fill("#coKg0", "60"); pg.fill("#coRp0", "8"); pg.click(".co-log[data-set='0']"); pg.wait_for_timeout(250)
    pg.click("#coSkip"); pg.wait_for_timeout(200)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(250)
    check("F12 Escape mid-session saves it once and shows the summary",
          logs(pg) == before + 1 and pg.evaluate("!document.getElementById('coDone').hidden"))
    pg.click("#coExit"); pg.wait_for_timeout(250)
    check("Exit on the summary closes without logging the session again", logs(pg) == before + 1, logs(pg))
    back = pg.evaluate("[document.getElementById('coach').hidden, document.activeElement.id, document.querySelector('.page-wrap').inert]")
    check("F12 closing returns focus and the page comes back to life", back == [True, "coachStart", False], back)

    lm = pg.evaluate("[document.querySelectorAll('main, [role=main]').length, !!document.querySelector('.skip-link'), document.querySelectorAll('h2.sec').length]")
    check("F16 one main landmark, a skip link, h2 section labels", lm[0] == 1 and lm[1] and lm[2] >= 10, lm)
    check("F23 the footer carries no 'No. N' label", "No." not in pg.inner_text(".statusbar"))
    pg.goto(BASE + "/trainer?sample", wait_until="networkidle"); pg.wait_for_selector(".plan-wrap.show", timeout=15000)
    hs = pg.evaluate("[document.querySelectorAll('#planDoc h2.pd-h').length, document.querySelectorAll('#planDoc h3.dn').length]")
    check("F16 plan sections are h2 and training days h3", hs[0] >= 8 and hs[1] >= 3, hs)
    pg.close()

    # ── home ──
    pg = b.new_page(viewport={"width": 390, "height": 844})
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE + "/", wait_until="networkidle"); pg.wait_for_timeout(2400)
    check("F15 locked questions are inert", pg.evaluate("Array.from(document.querySelectorAll('.q.locked')).every(q => q.inert)"))
    pg.fill("#nameInput", "Sam"); pg.press("#nameInput", "Enter"); pg.wait_for_timeout(1500)
    check("F15 answering unlocks the next question", pg.evaluate("(() => { const q = document.getElementById('q-goal'); return !q.classList.contains('locked') && !q.inert; })()"))
    y = pg.evaluate("document.getElementById('crush').offsetTop + document.getElementById('crush').offsetHeight - innerHeight - 20")
    pg.evaluate(f"scrollTo({{top: {y}, behavior: 'instant'}})"); pg.wait_for_timeout(900)
    over = pg.evaluate("""(() => { const a = document.querySelector('.crush-label'), h = document.querySelector('#crushAfter h2');
        const ra = a.getBoundingClientRect(), rh = h.getBoundingClientRect();
        const hit = ra.left < rh.right && rh.left < ra.right && ra.top < rh.bottom && rh.top < ra.bottom;
        return [+getComputedStyle(a).opacity, hit]; })()""")
    check("F07 the eyebrow is gone when 'All of it. Gone.' shows", over[0] < 0.05 or not over[1], over)
    pg.close()
    b.close()

check("no page errors", not errs, errs[:3])
print("A11Y: ALL PASS" if ok else "A11Y: SOME FAILED")
sys.exit(0 if ok else 1)
