# Sprint 2 — Close the Loop

**Goal:** the plan stops being a static document. Users log real sessions in the
browser, the week-4 check-in recalibrates from that logged data automatically,
and any plan can be handed to a friend as a link — all with zero server storage.

## Scope & acceptance criteria

### 1. Workout logger
- A third "Log a session" tab, visible once a plan is saved on the device.
- Pick the session (from the plan's workout days) and date; every exercise
  shows its prescription and per-set `kg × reps` inputs.
- Sessions save to localStorage (device-only), newest first, capped at 40;
  a "Previous sessions" list shows recent history with best-set summaries.
- **Accept:** save two sessions in a browser, both appear in history, data
  survives reload.

### 2. Check-in autofill from logs
- Opening the Week-4 check-in with ≥2 logged sessions auto-fills "Key lifts,
  then → now" with first-vs-latest best sets per exercise (only if the field
  is empty — typed text always wins).
- **Accept:** after logging bench 60×8 then 65×8, the check-in field contains
  "bench … 60 kg x 8 -> 65 kg x 8".

### 3. Share a plan
- "Share link" button beside Download PDF: the full plan JSON is
  deflate-compressed into a `#p=` URL fragment (never sent to a server) and
  copied to the clipboard.
- Opening a shared link renders the plan immediately — recipient can print,
  restore-save it, or start their own intake.
- Feature-detected (CompressionStream); button hidden on old browsers.
- **Accept:** share → open link in a fresh context → identical plan renders.

### 4. QA
- `qa/site_qa.py` extended: logger save/history/autofill flow + share
  round-trip. Pytest suite stays green (no server changes this sprint).
- **Accept:** site_qa exit 0; CI green including live-verify.

## Out of scope (roadmap)
Plan diffing at check-in, exercise illustrations, PWA, third-provider fallback.

## Outcome — CLOSED 2026-07-17, all scope shipped

- Logger: Log-a-session tab (appears once a plan is saved), per-set kg × reps
  entry against each exercise's prescription, history with best-set summaries,
  40-session cap. Same-day sessions keep real order (timestamp fix found by
  local QA: two same-day logs autofilled in reverse).
- Check-in autofill verified: 60 kg x 8 -> 65 kg x 8 lands in "Key lifts",
  typed text always wins, stuck lifts reported as "stuck at".
- Share: deflate-compressed #p= fragment (~13 KB URL for a full plan),
  clipboard copy with "Copied ✓" feedback, fresh-context round-trip renders
  all 10 sections; feature-detected, print/PDF unaffected.
- Mobile: tab row wrapped (4 pills overflowed 390 px — caught and fixed).
- QA: site_qa.py extended to 20 checks, all passing; pytest 32/32 (no server
  changes this sprint). CI + live-verify green on the sprint commit.
