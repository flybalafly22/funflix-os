"""THE GUARDIANS' browser-level privacy regressions (shared device, signed out first).

Self-contained: starts the app on a free local port with accounts ON (the in-memory
store from tests/test_accounts.py, so no database or secrets are needed), then
replays the scenarios from the 2026-09-25 evaluation and asserts each stays fixed:

  1. signing out on a page other than /trainer still wipes this browser
  2. signing in over someone else's guest plan asks first, and "Not mine" uploads nothing
  3. a brand-new account does not silently absorb the previous guest's data
  4. ?sample always shows the sample, never the plan this browser holds
  5. a sample request carries nothing personal
  6. "Clear this data" removes every trainer key, the owner stamp and the handoff
  7. deleting an account keeps this browser's copy (as promised) but un-stamps it

    python3 qa/privacy_qa.py            # exit 1 on any failure
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
sys.path.insert(0, os.path.join(ROOT, "tests"))
os.chdir(ROOT)
import app as A                        # noqa: E402
from test_accounts import MemStore     # noqa: E402

A.STORE = MemStore()
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


def seed_guest(pg, who="Ben Stranger"):
    plan = json.loads(json.dumps(DEMO))
    plan["profile_summary"]["name"] = who
    pg.evaluate("""(p) => {
        localStorage.setItem('trainerLastPlan', JSON.stringify({at: Date.now(), plan: p,
            safety: {allergies: 'peanuts', injuries: 'ACL repair 2019', equipment: 'gym', diet: 'Non-veg', dob: '1990-01-01', sex: 'Male'}}));
        localStorage.setItem('trainerLogs', JSON.stringify([{at: Date.now() - 864e5, day: 'Upper A', sets: {'Bench press': [{kg: 100, reps: 3}]}}]));
        localStorage.setItem('trainerWeights', JSON.stringify([{d: new Date().toISOString().slice(0, 10), kg: 91}]));
        localStorage.setItem('trainerSwaps', '{"x":"y"}');
        localStorage.setItem('trainerBar', '15kg');
        sessionStorage.setItem('trainerHandoff', JSON.stringify({v: 1, name: 'Ben', goal: 'muscle', at: Date.now()}));
    }""", plan)


def api(pg, path, body=None):
    return pg.evaluate("""async ([path, body]) => {
        const r = await fetch(path, body ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)} : {});
        let j = null; try { j = await r.json(); } catch (e) {}
        return {status: r.status, body: j};
    }""", [path, body])


def trainer_keys(pg):
    return pg.evaluate("Object.keys(localStorage).filter(k => k.indexOf('trainer') === 0 && k !== 'trainerTheme')")


with sync_playwright() as p:
    b = p.chromium.launch()

    # ── 1. sign out on the HOME page wipes the Trainer's data in this browser ──
    ctx = b.new_context(); pg = ctx.new_page()
    pg.goto(BASE + "/trainer", wait_until="networkidle")
    api(pg, "/api/auth/register/start", {"email": "maya@example.com", "password": "correct horse 9"})
    seed_guest(pg, "Maya")
    pg.evaluate("localStorage.setItem('trainerOwner', 'maya@example.com')")
    pg.goto(BASE + "/", wait_until="networkidle")
    pg.wait_for_function("window.OS_ACCT && OS_ACCT.ready && OS_ACCT.user", timeout=8000)
    pg.evaluate("OS_ACCT.open()"); pg.wait_for_timeout(300)
    pg.evaluate("document.getElementById('acLogout').click()"); pg.wait_for_timeout(600)
    left = trainer_keys(pg)
    check("1 sign-out on home wipes every trainer key", left == [], left)
    check("1 sign-out on home drops the handoff", pg.evaluate("sessionStorage.getItem('trainerHandoff')") is None)
    pg.goto(BASE + "/trainer", wait_until="networkidle"); pg.wait_for_timeout(400)
    check("1 next person sees a cold Trainer", pg.inner_text("#modTitle").startswith("Let"), pg.inner_text("#modTitle"))
    ctx.close()

    # ── 2 + 3. signing in over someone else's guest data asks first ──
    ctx = b.new_context(); pg = ctx.new_page()
    pg.goto(BASE + "/trainer", wait_until="networkidle")
    seed_guest(pg, "Ben Stranger")
    sent = []
    pg.on("request", lambda r: sent.append(r.post_data or "") if "/api/sync" in r.url and r.method == "PUT" else None)
    api(pg, "/api/auth/register/start", {"email": "ana@example.com", "password": "correct horse 9"})   # a NEW account
    pg.reload(wait_until="load"); pg.wait_for_timeout(1000)
    check("3 new account over guest data shows the question", pg.is_visible("#adopt"))
    check("3 the question names the plan", "Ben Stranger" in pg.inner_text("#adoptD"), pg.inner_text("#adoptD"))
    check("3 nothing uploaded while unanswered", not sent, sent[:1])
    pg.click("#adoptNo"); pg.wait_for_timeout(900)
    srv = api(pg, "/api/sync")["body"] or {}
    check("2 'Not mine' uploads nothing to the account", not srv.get("plan") and not ((srv.get("logs") or {}).get("value")), srv)
    check("2 'Not mine' removes it from this browser", pg.evaluate("localStorage.getItem('trainerLastPlan')") is None)
    ctx.close()

    ctx = b.new_context(); pg = ctx.new_page()
    pg.goto(BASE + "/trainer", wait_until="networkidle")
    seed_guest(pg, "Owen")
    api(pg, "/api/auth/register/start", {"email": "owen@example.com", "password": "correct horse 9"})
    pg.reload(wait_until="load"); pg.wait_for_timeout(1000)
    pg.click("#adoptYes"); pg.wait_for_timeout(1200)
    srv = api(pg, "/api/sync")["body"] or {}
    check("2 'It's mine' adds the plan to the account", ((srv.get("plan") or {}).get("value") or {}).get("profile_summary", {}).get("name") == "Owen")
    check("2 the device is now stamped to that account", pg.evaluate("localStorage.getItem('trainerOwner')") == "owen@example.com")
    ctx.close()

    # ── 4 + 5. ?sample shows the sample, and a sample request carries nothing personal ──
    ctx = b.new_context(); pg = ctx.new_page()
    pg.goto(BASE + "/trainer", wait_until="networkidle")
    seed_guest(pg, "Ben Stranger")
    bodies = []
    pg.on("request", lambda r: bodies.append(r.post_data or "") if r.url.endswith("/api/trainer") else None)
    pg.goto(BASE + "/trainer?sample", wait_until="networkidle")
    pg.wait_for_selector(".plan-wrap.show", timeout=15000); pg.wait_for_timeout(300)
    check("4 ?sample shows the sample, not the saved plan", "Ben Stranger" not in pg.inner_text("#planDoc")
          and pg.inner_text("#modTitle") == "A sample program.", pg.inner_text("#modTitle"))
    check("5 the sample request carries no answers", bodies and all("intake" not in x and "Ben" not in x for x in bodies), bodies[:1])
    pg.goto(BASE + "/trainer", wait_until="networkidle")
    pg.evaluate("document.getElementById('fName').value = 'Priya Secret'; document.getElementById('fHealth').value = 'asthma'")
    bodies.clear()
    pg.evaluate("document.getElementById('peekBtn').click()"); pg.wait_for_selector(".plan-wrap.show", timeout=15000)
    check("5 'Preview a sample' sends nothing typed", bodies and all("Priya" not in x and "asthma" not in x for x in bodies), bodies[:1])
    ctx.close()

    # ── 6. "Clear this data" removes everything, owner stamp and handoff included ──
    ctx = b.new_context(); pg = ctx.new_page()
    pg.goto(BASE + "/trainer", wait_until="networkidle")
    seed_guest(pg); pg.evaluate("localStorage.setItem('trainerOwner', 'gone@example.com')")
    pg.reload(wait_until="load"); pg.wait_for_timeout(1000)
    pg.on("dialog", lambda d: d.accept())
    pg.evaluate("document.getElementById('devClearBtn').click()"); pg.wait_for_timeout(400)
    left = trainer_keys(pg)
    check("6 Clear this data leaves no trainer key", left == [], left)
    check("6 Clear this data drops the handoff", pg.evaluate("sessionStorage.getItem('trainerHandoff')") is None)
    ctx.close()

    # ── 7. deleting the account keeps this browser's copy, un-stamped ──
    ctx = b.new_context(); pg = ctx.new_page()
    pg.goto(BASE + "/trainer", wait_until="networkidle")
    api(pg, "/api/auth/register/start", {"email": "dee@example.com", "password": "correct horse 9"})
    seed_guest(pg, "Dee"); pg.evaluate("localStorage.setItem('trainerOwner', 'dee@example.com')")
    pg.reload(wait_until="load"); pg.wait_for_timeout(1000)
    pg.evaluate("OS_ACCT.open()"); pg.wait_for_timeout(300)
    pg.evaluate("document.getElementById('acDelOpen').click()")
    pg.fill("#acDelPw", "correct horse 9")
    pg.evaluate("document.getElementById('acDelGo').click()"); pg.wait_for_timeout(800)
    check("7 delete keeps the plan in this browser", pg.evaluate("localStorage.getItem('trainerLastPlan')") is not None)
    check("7 delete removes the owner stamp", pg.evaluate("localStorage.getItem('trainerOwner')") is None)
    check("7 the server copy is gone", api(pg, "/api/auth/me")["body"].get("user") is None)
    ctx.close()
    b.close()

print("PRIVACY: ALL PASS" if ok else "PRIVACY: SOME FAILED")
sys.exit(0 if ok else 1)
