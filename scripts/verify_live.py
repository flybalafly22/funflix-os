#!/usr/bin/env python3
"""Verify the live Render deployment.

Usage:
    python3 scripts/verify_live.py                       # smoke the live site now
    python3 scripts/verify_live.py --wait-for <sha>      # poll /api/version until
                                                         # the commit is live, then smoke

Exit 0 = live site serves the expected commit and a working demo plan.
Used by CI on every push to main, and by hand after any deploy.
"""
import json
import ssl
import sys
import time
import urllib.request

BASE = "https://funflix-os.onrender.com"
DEPLOY_TIMEOUT_S = 900   # Render build + swap can take a while
POLL_S = 15

# macOS system Python often lacks root CAs; certifi is already a repo dependency.
try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()


def get(path, timeout=30):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": "verify-live/1.0"})
    with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as r:
        return r.status, r.read()


def post_json(path, payload, timeout=60):
    req = urllib.request.Request(
        BASE + path, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "verify-live/1.0"},
        method="POST")
    with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as r:
        return r.status, r.read()


def wait_for_commit(sha):
    want = sha[:7]
    deadline = time.time() + DEPLOY_TIMEOUT_S
    while time.time() < deadline:
        try:
            _, body = get("/api/version", timeout=15)
            live = json.loads(body).get("commit", "")
            print(f"live commit: {live} (want {want})", flush=True)
            if live == want:
                return True
        except Exception as exc:
            print(f"version poll: {exc}", flush=True)
        time.sleep(POLL_S)
    return False


def smoke():
    failures = []

    for path in ("/", "/trainer"):
        try:
            status, body = get(path)
            ok = status == 200 and len(body) > 1000
        except Exception as exc:
            ok, status = False, exc
        print(f"GET {path}: {status} {'OK' if ok else 'FAIL'}", flush=True)
        if not ok:
            failures.append(path)

    try:
        status, body = post_json("/api/trainer", {"demo": 1})
        plan = json.loads(body)
        ok = status == 200 and plan.get("type") == "plan" and plan.get("workout_days")
    except Exception as exc:
        ok, status = False, exc
    print(f"POST /api/trainer demo: {status} {'OK' if ok else 'FAIL'}", flush=True)
    if not ok:
        failures.append("demo-plan")

    try:
        status, body = get("/api/auth/me")
        me = json.loads(body)
        ok = status == 200 and "enabled" in me
        note = f"accounts {'enabled' if me.get('enabled') else 'DISABLED'}"
    except Exception as exc:
        ok, note = False, exc
    print(f"GET /api/auth/me: {'OK' if ok else 'FAIL'} ({note})", flush=True)
    if not ok:
        failures.append("auth-me")

    return failures


def main():
    if "--wait-for" in sys.argv:
        sha = sys.argv[sys.argv.index("--wait-for") + 1]
        if not wait_for_commit(sha):
            print(f"FAIL: commit {sha[:7]} never went live within {DEPLOY_TIMEOUT_S}s")
            return 1
    failures = smoke()
    if failures:
        print(f"FAIL: {failures}")
        return 1
    print("live verification: ALL OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
