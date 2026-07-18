# Sprint 10 — One Door, Everywhere

**Owner feedback:** "Create account" must open the account window on every
screen, in place — not navigate to /trainer first. Plus: team study for more
discrepancies, and ideas where things are lacking.

## Scope & acceptance criteria

1. **Shared account modal (chrome-owned)** — os.js injects a self-contained
   account modal (own styles, no os.css dependency) and exposes
   `window.OS_ACCT` (open/close, state, subscribe). The hud CTA, ⌘K entry,
   homepage nav link, and the trainer's Sync pill all open it IN PLACE.
   `#account` hash opens it on any page. Homepage runs os.js in chrome-less
   mode (`OS_NO_CHROME`) so the bespoke nav is untouched.
   *Accept: modal opens in place on /, /study and /trainer; hud pill and
   homepage link update live after login/logout without reload.*
2. **Trainer consumes, not owns** — trainer deletes its private modal;
   its sync engine subscribes to OS_ACCT (login → pullMerge, logout →
   state reset). Plan-history entries open in place on /trainer and
   deep-link (`#history=<id>`) from other pages.
   *Accept: login on /study then visit /trainer → synced; history restore
   still works; site_qa green.*
3. **Producer study** — fresh discrepancy review (running in parallel);
   verified findings fixed this sprint or queued with reasons.
4. **Luxury + both viewports** — standing mandate.

## Outcome — CLOSED 2026-07-18, all scope shipped

- One door: os.js now injects a fully self-contained account modal (own
  styles, print-safe, z-safe) and exposes window.OS_ACCT (open/close/state/
  subscribe). The hud CTA, ⌘K, homepage nav link and the trainer's Sync pill
  all open it IN PLACE — zero navigation. Homepage runs os.js in
  OS_NO_CHROME mode: no double header, no palette double-bind, its own ⌘K now
  leads with the account. Verified in place on /, /study, /trainer.
- Trainer consumes, not owns: private modal deleted; sync engine subscribes
  to OS_ACCT (me/login → pullMerge, logout → reset); archived plans open in
  place on /trainer and via #history=<id> cross-page deep links.
- Producer study (10 findings, 8 risks, 3 ideas) executed:
  A1 dual-pill desync — dead by architecture (single OS_ACCT source, both
  pills verified live-updating). A2 mobile homepage hid the CTA — visible
  now. A3 remaining "no account" copy (og:description, $0 card) — honest
  now. A4 homepage ⌘K account entry — first row. A5 cmd/ctrl-click swallowed
  by shared nav — guarded. A6 pre-auth CTA dumped users to the homepage —
  now opens the modal optimistically. A7 print modal leak — @media print in
  injected CSS. A9 silent dead-session sync — 401s flip every surface to
  signed-out (verified: trainer pill AND hud pill). A10 stale comment fixed.
  B3/B7 bfcache + tab-switch staleness — pageshow/visibilitychange re-check.
  A8 (export & erase) + C ideas → roadmap for Sprint 11.
- QA: pytest 59/59, site_qa 29/29, no overflow at 390px incl. modal.
