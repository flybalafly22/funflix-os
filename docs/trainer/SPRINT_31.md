# Sprint 31 — Harden the doors (RED TEAM watch-list, all closed)

**Theme:** turn the RED TEAM's standing watch-list into shipped defences + tests,
now that Sprints 29–30 added new auth surface (OTP, password reset). Server-only,
no client change.

## Closed this sprint

### 31.1 — `_trainer_hits` can't grow without bound (memory-DoS)
`_rate_limited` hard-bounds the rate-limit map: past `_RL_MAX_KEYS` (5000) it
sweeps stale/empty keys, and if still full it **fails open for a brand-new key**
rather than allocating more. An `X-Forwarded-For` IP-rotation flood can no longer
leak memory.

### 31.2 — per-account auth limit (XFF-rotation brute force)
A per-IP cap alone can't stop a distributed guess against one account (each spoofed
IP is a fresh bucket). `_rate_limited_account(email)` adds a per-email cap
(`AUTH_ACCT_LIMIT`=20/hr) on **login** and **reset/start**, independent of source
IP. Deliberately generous: a real user's typos never reach it; an attacker gets
≤20 guesses/hr/account (useless against an 8+ char password); worst-case malicious
lockout is one account for one hour, never the site (documented tradeoff).

### 31.3 — password length capped (KDF CPU-DoS)
`_PW_MAX`=128 wherever a password is **set** (register, reset); **login** rejects
anything over a 1024-char ceiling *before* the KDF runs. No real password is
locked out; a multi-MB string can't burn CPU in `check_password_hash`.

### 31.4 — auth endpoints survive non-dict JSON (fuzz)
`_req_json()` coerces a list/string/number/malformed body to `{}`, so `.get(...)`
can't `AttributeError` → 500. Applied to every `request.json or {}` site
(register/login/reset + analyst); `/api/trainer` already guarded.

## Tests (tests/test_hardening.py — Sprint 31 block, 6)
password cap on register; login rejects absurd password without 500; per-account
limit trips under IP rotation; hits-map bounded under a fresh-IP flood; hits-map
sweeps stale keys; auth endpoints survive non-dict JSON.

## Gates
pytest **136 green** (130 + 6). Server-only; site_qa contract untouched. No new
dependency, no owner action, fully $0.

## Outcome (closed)
The auth surface added over Sprints 29–30 is now hardened and regression-tested;
the RED TEAM watch-list is empty except the known client-side sync lost-update
race (queued for a server-side per-kind merge). This closes the planned
5-sprint hardening/correctness/recovery arc (28–31 + the free-mail 29).
