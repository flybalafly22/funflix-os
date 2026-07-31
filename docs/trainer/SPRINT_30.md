# Sprint 30 — Password reset (fully functional sign-in recovery)

**Why:** "sign-in must be fully functional" (owner mandate) isn't true if a user
who forgets their password is locked out of their own account — and their synced
plan/logs/history are stranded. Sprint 29's free Gmail SMTP path made emailed
reset codes deliverable to any user, so this is now buildable at $0.

## What shipped

### Server (`app.py`)
- `set_password(uid, pw_hash)` on `PgStore` (UPDATE) + `MemStore` (test store).
- `POST /api/auth/reset/start` `{email}` — emails a 6-digit code
  (`_otp_reset_html`). **Anti-enumeration:** identical `{ok:true}` response
  whether or not the address has an account; only arms the session + sends when it
  does. Gated on `_mail_configured()` (returns 503 "not set up" otherwise — a
  global fact, not a per-email answer). Session-stored (`pwr`: uid + code hash +
  10-min expiry + attempt counter), worker-safe under gunicorn (signed cookie,
  no DB row). Auth-bucket rate-limited (10/hr/IP).
- `POST /api/auth/reset/verify` `{code, password}` — checks expiry / ≤6 attempts /
  code; requires the new password ≥8 chars; `set_password`; clears `pwr`; and
  **signs the user straight in** (`session["uid"]`). A successful reset both
  changes the password and logs them in.

### Client (`static/os.js`)
- The stale "No password reset exists yet — keep it in a password manager" hint is
  replaced by a **"Forgot your password?"** link on the sign-in form.
- A reset step (`#acReset`: code + new-password fields, `#acRsBtns`: Set new
  password / Back) mirroring the OTP step. `resetStart()` posts the email →
  `resetVerify()` posts code+password → `finishLogin()`.
- **CSS bug fixed (found by screenshot review):** `.osacct .ac-btns{display:flex}`
  outranked the UA `[hidden]` rule, so hidden button rows (the OTP step *and* the
  new reset step) all rendered at once. Added `.ac-btns[hidden]{display:none}` —
  fixes both steps.

## Gates
- pytest **130 green** (124 + 6 in `tests/test_reset.py`: full flow changes
  password + logs in, old pw fails / new works, unknown-email indistinguishable,
  wrong code leaves pw unchanged, 6-attempt lockout, short-pw rejected, unavailable
  without a mail provider).
- `qa/qa_reset_client.py` **ALL OK** (in-process MemStore + deterministic code,
  real account modal: forgot → wrong code rejected → correct code + new pw → signed
  in, old pw rejected, new pw works).
- site_qa **32/32** · 390px screenshot reviewed (`qa/shots/s30_reset_390.png`).

## Live activation
Fully live in code. Reset **emails** require a mail provider — free via Gmail SMTP
(`EMAIL_SETUP.md`). Until the owner sets `GMAIL_USER`/`GMAIL_APP_PASSWORD`,
`/reset/start` honestly returns 503 "not set up yet"; the moment they're set, reset
works for every user. No further code needed.

## Outcome (closed)
Sign-in recovery is complete and tested. Sprints 28–30 close the SIMULATION
correctness cluster and the GUARDIANS' "sign-in fully functional" beat. Next:
Sprint 31 hardening (per-account auth limit, bound `_trainer_hits`, password cap,
OTP/reset endpoint fuzz).
