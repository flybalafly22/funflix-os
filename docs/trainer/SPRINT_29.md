# Sprint 29 — Free email for everyone (Gmail SMTP), no domain, $0

**Why now (owner ask):** the OTP email path was live but Resend's test mode only
reaches the Resend account owner until a **domain is verified** — and the owner
wants to stay $0 and can't buy a domain. So OTP couldn't actually deliver to real
strangers. This sprint removes that blocker **for free**.

**What shipped:** a second, preferred mail provider — **Gmail SMTP** via stdlib
`smtplib` (no new dependency). It sends to **any** recipient on the free Gmail
tier (~500/day), needs **no domain**, and is enabled by two Render env vars
(`GMAIL_USER`, `GMAIL_APP_PASSWORD`). Resend is kept as an automatic fallback.

## Changes (`app.py`, tests, docs)
- `_gmail_configured()` + reworked `_mail_configured()` (true if **Gmail OR
  Resend**). OTP enforcement (`direct register → 400`) now trips on either
  provider, so configuring Gmail alone makes verification mandatory.
- `_send_email()` routes **Gmail first** (free, any recipient) → Resend fallback
  if Gmail is unset or its send fails and a key exists → direct-signup fallback if
  neither (never bricks). Split into `_send_via_gmail` / `_send_via_resend`.
- `_send_via_gmail`: `EmailMessage` (plain + html alt), STARTTLS on
  `smtp.gmail.com:587`, `From == GMAIL_USER` (Gmail rewrites otherwise), app-
  password spaces stripped, all exceptions captured into `_last_mail_err`.
- `tests/test_mail.py` (5): mail-configured logic, Gmail routing (faked SMTP,
  no network), app-password space-strip, Gmail-failure → Resend fallback, and
  **Gmail-only still enforces OTP** on the real register endpoints.
- `docs/trainer/EMAIL_SETUP.md`: the owner's 5-minute runbook (enable 2FA →
  create app password → set two env vars). This is the only remaining owner
  action, and it's free.

## Gates
- pytest **124 green** (119 + 5). No client/template change → site_qa unaffected
  (not re-run for a server-only mail change; contract untouched).
- Live activation needs the owner to set `GMAIL_USER` + `GMAIL_APP_PASSWORD` on
  Render (free). Until then the code is dormant and falls back exactly as before
  — shipping it now means zero further code once the env vars land.

## Outcome (closed)
Shipped. The pending "verify a domain (costs money)" blocker is replaced by a
free, domain-less Gmail SMTP path. Unblocks Sprint 30 (password reset) to deliver
to any user. Owner action: `EMAIL_SETUP.md` (free, ~5 min).
