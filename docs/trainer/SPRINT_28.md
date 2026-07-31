# Sprint 28 — Honest at Check-in (SIMULATION correctness cluster)

**Theme:** close the highest-integrity gaps the SIMULATION team flagged in the
check-in / recalibration loop. All three are fully unblocked (no owner-gated
mail/domain dependency) and entirely client-side (`templates/trainer.html`), so
the server contract and pytest suite are untouched.

**Re-baseline note (Producer):** the ROADMAP's "correctness still open" block is
dated 2026-07-19 and is partly stale. Verified against current code:
- **Allergen carry-through + `supplements[]` scan** → **already shipped Sprint 15**
  (`d5dcef6`); `_validate_plan` scans supplements and the client carries
  `safety.allergies` into the check-in payload. **No action.**
- What remains genuinely open and is scoped here: age/gender not persisted,
  check-in reachable with no plan, manual deload not tagged.

## Items (each with acceptance criterion)

### 28.1 — Special-population context survives the check-in
**Finding:** `captureSafety()` persists allergies/injuries/equipment/diet/goalWeight
but **not age (DOB) or gender**, so a 50+/60+/16–17 or women's-health plan loses
its special-population basis at the first recalibration (RED-S floor, older-lifter
recovery, teen rules silently expire).
**Fix:** persist `dob` + `sex` in `captureSafety()`; carry them into the check-in
`intake()` as `date of birth` + `gender assigned at birth` (the same keys a fresh
intake uses, so the server prompt re-applies the rules unchanged).
**Accept:** a check-in POST body from a plan built with DOB 1968 / female carries
both fields; older saved plans without them degrade to `''` (no worse than today).

### 28.2 — Check-in is gated on a saved plan
**Finding:** the "Week-4 check-in" tab is always visible; a first-time visitor with
no plan can open it and submit a "recalibration" that is really a stateless
from-scratch plan with no diff and empty safety context.
**Fix:** hide `#tabCheckin` until there is a saved plan with `workout_days`
(mirror the existing `#tabLog` gate in `refreshRestore()`); default the tab to
`display:none` in markup; defensively bounce `setMode('checkin')` back to `plan`
if no plan exists.
**Accept:** cold, no-plan `/trainer` → check-in tab not visible; after a plan
exists → visible and functional.

### 28.3 — A manually-logged deload week is tagged
**Finding:** Coach Mode tags reduced weeks `sess.deload=true` (stall-watch and
previous-performance skip them), but a **manually logged** deload has no such
flag, so a deliberate light week reads as a strength drop → false "you're
stalling, cut 10%" / a double-deload.
**Fix:** add a "This was a deload week" checkbox to the Log form; on save, tag
`sess.deload=true` and stamp the shared deload clock (`DL_KEY`) so the
plan-cadence / fatigue deload cards don't also fire (shared clock with Coach Mode,
never moved backward by a backdated entry).
**Accept:** a session logged with the box ticked is stored with `deload:true`, is
ignored by stall-watch, and suppresses a redundant prescribed deload for a week.

## Gates
- pytest green (no server change, but run it) · `qa/qa_checkin_safety.py` green
  (new: seeds a plan in localStorage, asserts 28.1/28.2/28.3) · site_qa green
  (contract intact) · desktop 1280 + mobile 390 screenshot review of the Log form
  and mode tabs · ship = push → CI → verify_live.

## Outcome (closed)
All three shipped, client-side only (server contract + pytest untouched).
- **28.1** `captureSafety()` now persists `dob`+`sex`; the check-in `intake()`
  carries them as `date of birth`/`gender assigned at birth`. Older saved plans
  degrade to `''`. Verified: a plan built female/DOB-1968 sends both on check-in.
- **28.2** `#tabCheckin` gated on a saved plan (markup default `display:none` +
  `refreshRestore()` mirror of `#tabLog` + a `setMode` guard that bounces
  checkin/log → plan with no plan). Verified: hidden cold, shown with a plan.
- **28.3** Log form gained a "This was a deload week" checkbox → tags
  `sess.deload=true` and stamps `DL_KEY` (max, never backward) so stall-watch
  ignores it and no redundant deload is prescribed. Mobile layout fixed (text in
  one `<span>` so the flex label doesn't shatter).
- **Gates:** pytest 119 ✓ · `qa/qa_checkin_safety.py` ALL OK ✓ · site_qa 32/32 ✓
  (two new contracts: `trainer_checkin_tab_gated_cold`,
  `trainer_checkin_tab_shown_with_plan`) · 390px screenshot reviewed.
- **Roll-over:** none. Next: Sprint 29 (free email via Gmail SMTP — unblocks OTP
  for all users at $0, no domain — then hardening).
