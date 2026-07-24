# Sprint 14 — Your Data, Only Yours

**Owner ask (2026-07-19):** confirm every user's data is saved separately with
no bugs or discrepancies, then build Sprint 14. The audit itself became the
sprint: server-side isolation was already airtight, but the audit found a real
client-side cross-account bleed on shared browsers. This sprint closes it and
makes multi-user isolation a permanent, tested guarantee.

## The audit

**Server — clean (verified, now regression-tested).** Every data query is
scoped by `user_id`; the uid always comes from the signed session cookie
(unforgeable — HttpOnly, SameSite=Lax, Secure on Render, stable secret). Plan
history is fetched `WHERE user_id=%s AND id=%s`, so no user can read another's
archived plan by guessing an id (no IDOR). Delete cascades only the caller's
rows. No client-supplied identity is ever trusted for access.

**Client — a real shared-browser bleed (FIXED).** `localStorage` is per-browser,
not per-account. Logout called `refreshRestore()` but never cleared the cached
plan/logs, so: user A signs in → data caches locally → A signs out (data
stays) → user B signs in on the same browser → `pullMerge()` union-merged A's
leftover logs and **pushed them into B's account**. A's training bled into B's
server data.

## Scope & acceptance criteria

1. **Owner-stamped device storage.** Every device caches its training data
   under an owner stamp (`trainerOwner`). On any identity change the device is
   reset so nothing crosses accounts:
   - sign-in as a DIFFERENT account than the stamp → wipe plan/logs/deload
     before any sync, then pull the new account fresh;
   - explicit sign-out / account deletion → wipe everything incl. the stamp;
   - a dead/expired session (401) is NOT an explicit logout → data is kept
     (still owner-stamped, so it can never merge elsewhere), only the
     signed-out state is reflected.
   - un-owned (guest) data is adopted UP only into an account that has no plan
     yet (a fresh registration keeping the plan it just built); if the account
     already has a plan, this browser's guest data is treated as a stranger's
     and the server wins.
   *Accept: A→logout→B login pushes none of A's data and wipes it from disk;
   same-user re-auth keeps and syncs their data; explicit logout wipes all.*
2. **Isolation as a permanent test dimension.** Server: two accounts on one
   store never see/touch each other's plan, logs, history, profile, export;
   IDOR on history denied; deleting one leaves the other intact; every data
   endpoint rejects the anonymous. Client: the shared-device browser test.
   *Accept: pytest + a scripted 3-scenario browser isolation pass, both green,
   in CI.*

## Outcome — CLOSED 2026-07-19, all scope shipped

- Client isolation fix live: `deviceReset()` + `trainerOwner` stamp + the
  guest-adopt-only-into-empty-account rule; `syncAuthLost` now emits a distinct
  `authlost` (non-destructive) vs. explicit `logout` (wipes).
- Tests: pytest 82/82 (5 new cross-user isolation tests — separate
  plans/logs/history/profile/export, IDOR denied, one user's writes never
  touch another, delete-isolation, anonymous rejected). 3-scenario browser
  isolation pass (A→B no-bleed + device wipe, same-user keep+sync, logout
  wipe). site_qa 29/29.
- Verified on live Neon after deploy: two real accounts round-tripped with
  fully separate data; B could not fetch A's history id (404).
