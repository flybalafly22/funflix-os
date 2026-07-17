# Sprint 6 — The Studio Remembers

**Goal:** the two features that change what The Trainer is: a coach you can
question, and a memory that follows you across devices — while keeping the
no-account privacy promise fully intact.

## Scope & acceptance criteria

### 1. Ask The Trainer (plan-grounded Q&A)
- Chat panel under every rendered plan (incl. restored and shared plans);
  answers stream live, grounded in THAT plan's JSON; starter chips.
- Scope rules: quote the plan's numbers; swaps use the plan's substitutions;
  wholesale changes → pointed to the Week-4 check-in; medical → referral;
  off-topic → friendly decline. Own rate bucket (20/hr) so chat can't eat
  the plan-generation quota. **Accept:** grounded answer on prod; plan JSON
  verified riding in the system instruction; bucket independence tested.

### 2. Accounts & sync (Neon Postgres via DATABASE_URL)
- PgStore (users + JSONB blobs, newer-wins upserts), auto schema init,
  graceful "accounts disabled" when no DATABASE_URL.
- Auth: register/login/logout/me — hashed passwords (scrypt via werkzeug),
  90-day sessions, auth rate bucket, honest error copy.
- Sync: plan (newer-wins by timestamp) + logs (union-merge, 200-session cap,
  up from 40); pushed automatically on every save incl. Coach Mode; pulled
  and merged on load; fully offline-tolerant (PWA still works, syncs later).
- Opt-in privacy: without an account, nothing leaves the device — copy
  updated to say exactly that. **Accept:** register→sync→pull round-trip on
  production Neon; memory-store suite covers the route logic.

### 3. UI (standing luxury mandate — every sprint)
- Sync pill in the segmented tab row; account modal: blurred veil, serif
  lead, hairline fields, signed-in state. Desktop + mobile (390px) clean.

## Outcome — CLOSED 2026-07-17, all scope shipped
- Q&A verified in-browser (stream renders, chips, print-hidden) and by unit
  tests incl. grounding assertion and bucket separation.
- Accounts: 8 new tests (hashing, dup email 409, wrong-pw 401, 503-when-
  disabled, sync auth, round-trip, newer-wins, size guard) — 53 total green.
- Client sync engine verified in-browser: newer server plan replaces local,
  logs union-merge, restore pill appears, pushes fire on save; zero console
  errors; no mobile overflow.
- Live production verification: real register + sync round-trip on Neon and
  a real grounded Q&A answer (see ship log in git).
