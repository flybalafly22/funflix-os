# Sprint 5 — Coach Mode

**Goal:** the plan's own written rules become executable. The Trainer stops
being a document you read and becomes the coach in your hand during the hour
that matters — plus a luxury pass on the whole UI.

## Scope & acceptance criteria

### 1. Live session runner
- "Run live" from the Log tab: full-screen runner walks the chosen workout
  day one exercise at a time — pictogram, target sets × reps @ RIR, tempo cue.
- Logging a set starts a countdown using THAT exercise's prescribed
  rest_seconds (chime + vibration at zero, skippable). Inputs prefill from
  the last logged session of the same exercise (double progression made
  visible). Finished sessions save into the existing logger automatically.
- **Accept:** full run-through in headless browser logs a session into
  localStorage identical in shape to manual logs; partial exit saves.

### 2. Plate math + warm-up ramp
- Barbell exercises get a working-weight field → per-side plate breakdown
  (20 kg bar, 25→1.25 plates, closest-load note when not exactly loadable).
- First exercise of a session also shows the ramp: bar ×10, 40% ×8, 60% ×5,
  80% ×3, rounded to 2.5.
- **Accept:** 67.5 → "20 + 2.5 + 1.25 per side"; ramp math correct.

### 3. Readiness → session compression (deterministic, no API)
- 30-second pre-session check: sleep, soreness, time available. Rules from
  the plan's own philosophy: short on time → isolation trims first, compounds
  keep their sets; rough recovery → drop an isolation set + cap effort at
  RIR 3 with an explanatory banner.
- **Accept:** "~45 min" trims isolation to 2 sets with badges; "under 5.5 h
  sleep" shows the RIR-3 banner.

### 4. Stall forensics
- The plan's stall rule, applied automatically: 3 logged sessions of an
  exercise with no best-set improvement → "Stall watch" card in the Log tab
  naming the lift and the plan-prescribed 10% reset load.
- **Accept:** crafted stalled logs trigger the card with the correct reset.

### 5. UI luxury pass
- Segmented-control tabs, layered soft shadows, editorial section rules,
  tabular numerals in all number columns, refined buttons/inputs, elevated
  thinking state, premium coach-mode design. Print/PDF untouched.
- **Accept:** before/after screenshots reviewed; no mobile overflow; zero
  console errors; demo flow + print emulation still green.

## Out of scope
Plan Q&A chat (quota cost), progress-photo vault (roadmap).

## Outcome — CLOSED 2026-07-17, all scope shipped

- Session runner verified end-to-end in headless Chromium: readiness →
  adjusted session (RIR-3 banner + isolation trimmed 3→2 sets under "45
  min") → set logged → 3:00 rest countdown from the exercise's own
  rest_seconds → skip → progress ✓ marks → exit-with-partial saves → session
  in trainerLogs in the manual-log shape. Prefills come from the last logged
  session of the same exercise.
- Plate math exact: 67.5 → "20 + 2.5 + 1.25 per side"; ramp bar/27.5/40/55
  from 40/60/80% rounded to 2.5. Barbell-only detection avoids nonsense on
  dumbbell/machine work.
- Stall watch: 3× 70 kg × 8 bench sessions → card citing the plan's rule
  with the correct 62.5 kg reset. Shown in the Log tab and session summary.
- Luxury pass: segmented-control tabs, layered shadows, editorial hairlines
  after section heads, tabular numerals in all numeric columns, shimmering
  serif thinking state, full coach-mode design (giant serif rest timer).
- One bug found by tests: the coach overlay was trapped under the site nav
  (page-wrap stacking context z=5 vs hud z=100) — reparented to body.
- QA: pytest 41/41; site_qa extended to 25 checks; print/PDF unaffected;
  no mobile overflow. CI + live-verify green on the sprint commit.
