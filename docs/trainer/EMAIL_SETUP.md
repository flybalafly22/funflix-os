# Sending OTP / password-reset emails for $0 (no domain)

The Trainer emails a 6-digit code for **account creation** and (Sprint 30)
**password reset**. To send those to *any* user's inbox for free, use **Gmail
SMTP** — no domain to buy, no paid plan. Resend stays as an optional fallback.

## Why not Resend alone?
Resend's free tier works, but its default `onboarding@resend.dev` sender only
delivers to the **Resend account owner's own** address until you **verify a
domain** — and owning a domain costs money. Gmail SMTP has no such limit.

## The free path — Gmail app password (~5 minutes, $0)

1. Use any Gmail account (a dedicated one like `thetrainer.codes@gmail.com` is
   tidier than a personal inbox, but either works).
2. Turn on **2-Step Verification** for that Google account
   (https://myaccount.google.com/security) — app passwords require it.
3. Create an **App password**: Google Account → Security → *2-Step Verification*
   → **App passwords** → name it "The Trainer" → copy the 16-character password
   (shown as four groups, e.g. `abcd efgh ijkl mnop`).
4. On **Render** (the service's *Environment* tab) add two env vars:
   - `GMAIL_USER` = the full Gmail address (e.g. `thetrainer.codes@gmail.com`)
   - `GMAIL_APP_PASSWORD` = the 16-char app password (spaces are fine, we strip them)
5. Save → Render redeploys. Done. New signups now receive a real code, and OTP
   verification becomes **mandatory** automatically (`_mail_configured()` flips on).

That's it — no `MAIL_FROM`, no domain, no cost. Limit: ~500 emails/day on a free
Gmail, far more than signup traffic needs.

## How the code uses it (`app.py`)
- `_gmail_configured()` → true when both `GMAIL_USER` + `GMAIL_APP_PASSWORD` are set.
- `_mail_configured()` → true if **Gmail OR Resend** is configured; this is what
  makes email verification mandatory (direct signup returns 400 when true).
- `_send_email()` tries **Gmail first** (any recipient, free); if Gmail isn't
  configured or its send fails and a `RESEND_API_KEY` exists, it falls back to
  Resend. With neither, signup safely falls back to direct (never bricked).
- Send path: stdlib `smtplib` over STARTTLS on `smtp.gmail.com:587`, `From` kept
  equal to `GMAIL_USER` (Gmail rewrites it otherwise). No new dependency.

## Verifying after you set the env vars
```
# 1. accounts + mail enabled, OTP enforced:
curl -s https://funflix-os.onrender.com/api/auth/me            # {"enabled":true,...}
curl -s -X POST https://funflix-os.onrender.com/api/auth/register \
     -H 'Content-Type: application/json' \
     -d '{"email":"you@example.com","password":"testpassword"}' # -> 400 "verification required"

# 2. real signup in a browser at /trainer → you receive the code → verify → in.
```
If a send fails, the reason is captured server-side in `_last_mail_err` (not
exposed in responses, for security) — a common first-time cause is 2-Step
Verification not being on, or the app password being for the wrong account.

## Optional: Resend fallback / alternative
Keep `RESEND_API_KEY` set if you like — it's a backstop. To make Resend send to
arbitrary users (not just its owner), verify a domain there and set `MAIL_FROM`
to an address on it. Not required if Gmail SMTP is configured.
