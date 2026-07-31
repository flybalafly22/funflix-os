"""Sprint 30 — password reset in the browser, end to end. Runs the Flask app
in-process with a MemStore + a deterministic code (no DB, no network mail), then
drives the real account modal:

  forgot password -> emailed code -> new password -> signed straight in, the new
  password works and the old one no longer does.

    python3 qa/qa_reset_client.py        # self-contained (starts its own server)
"""
import json
import os
import sys
import threading
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tests"))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import app as A                       # noqa: E402
from test_accounts import MemStore    # noqa: E402
from playwright.sync_api import sync_playwright   # noqa: E402

PORT = 5096
BASE = "http://127.0.0.1:%d" % PORT
EMAIL = "user@x.com"
OLD_PW = "oldpassword"
NEW_PW = "brandnewpass1"
res = {}

# in-process test wiring: memory store, deterministic 6-digit code, no real mail
A.STORE = MemStore()
A.STORE.create_user(EMAIL, A.generate_password_hash(OLD_PW))
A._mail_configured = lambda: True
A._send_email = lambda to, s, h: True
A.secrets.randbelow = lambda n: 123456     # -> code "123456"


def _serve():
    A.app.run(port=PORT, debug=False, use_reloader=False, threaded=True)


def main():
    t = threading.Thread(target=_serve, daemon=True)
    t.start()
    for _ in range(50):
        try:
            import urllib.request
            urllib.request.urlopen(BASE + "/api/auth/me", timeout=1)
            break
        except Exception:
            time.sleep(0.1)

    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1280, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        # ignore "Failed to load resource" — the wrong-code (400) and old-password
        # (401) negative-path checks below deliberately trigger those HTTP statuses
        pg.on("console", lambda m: errs.append(m.text)
              if m.type == "error" and "Failed to load resource" not in m.text else None)
        pg.goto(BASE + "/trainer", wait_until="networkidle")
        pg.evaluate("() => window.OS_ACCT.open()")
        pg.wait_for_selector("#acForgot", timeout=8000)

        # ── forgot password: enter email, request a code ──
        pg.fill("#acEmail", EMAIL)
        pg.click("#acForgot")
        pg.wait_for_timeout(400)
        res["reset_step_shown"] = pg.is_visible("#acReset") and pg.is_visible("#acRsVerify")
        res["form_hidden_during_reset"] = not pg.is_visible("#acForm")
        res["not_logged_in_yet"] = pg.evaluate(
            "() => fetch('/api/auth/me').then(r=>r.json()).then(d=>d.user===null)")

        # ── wrong code is rejected, password stays unchanged ──
        pg.fill("#acRsCode", "000000")
        pg.fill("#acRsPw", NEW_PW)
        pg.click("#acRsVerify")
        pg.wait_for_timeout(400)
        res["wrong_code_error"] = "code" in (pg.inner_text("#acErr") or "").lower()
        res["still_not_logged_in"] = pg.evaluate(
            "() => fetch('/api/auth/me').then(r=>r.json()).then(d=>d.user===null)")

        # ── correct code + new password → signed straight in ──
        pg.fill("#acRsCode", "123456")
        pg.fill("#acRsPw", NEW_PW)
        pg.click("#acRsVerify")
        pg.wait_for_timeout(600)
        res["logged_in_after_reset"] = pg.evaluate(
            "(e) => fetch('/api/auth/me').then(r=>r.json()).then(d=>d.user===e)", EMAIL)
        res["modal_shows_signed_in"] = pg.is_visible("#acIn")

        # ── old password fails, new password works ──
        pg.click("#acLogout")
        pg.wait_for_timeout(400)
        pg.evaluate("() => window.OS_ACCT.open()")
        pg.wait_for_timeout(200)
        pg.fill("#acEmail", EMAIL)
        pg.fill("#acPw", OLD_PW)
        pg.click("#acLogin")
        pg.wait_for_timeout(400)
        res["old_password_rejected"] = pg.evaluate(
            "() => fetch('/api/auth/me').then(r=>r.json()).then(d=>d.user===null)")
        pg.fill("#acEmail", EMAIL)
        pg.fill("#acPw", NEW_PW)
        pg.click("#acLogin")
        pg.wait_for_timeout(400)
        res["new_password_works"] = pg.evaluate(
            "(e) => fetch('/api/auth/me').then(r=>r.json()).then(d=>d.user===e)", EMAIL)

        res["page_errors"] = errs
        b.close()


main()
print(json.dumps(res, indent=2))
ok = all(v is True for k, v in res.items() if isinstance(v, bool)) and not res.get("page_errors")
print("RESET-CLIENT:", "ALL OK" if ok else "FAIL")
sys.exit(0 if ok else 1)
