# Sprint 15 — charter (every team, more ambitious)

Owner directive (2026-07-19): "I want every single team to get more ambitious
for Sprint 15." Below is each standing team's bolder mandate. Research teams
(R&D LAB, SIMULATION) are already running their Sprint 15 studies; their
findings land in RND_LAB.md / SIM_STUDY.md and are groomed here as they arrive.

## The ambition, per team

- **R&D LAB** — stop shipping prompt changes on faith. Deliver the drop-in
  spec for the **golden-intake eval bench** (its own #1 idea): ~10 fixed
  synthetic intakes across the special populations, a deterministic pure-Python
  rubric, runnable offline and (gated) against ≤10 real API calls. Plus a fresh
  audit of the surfaces shipped in Sprints 12–14 and 5+ bolder new quality
  ideas. The bar rises from "find issues" to "make every future change
  provably safe."

- **SIMULATION** — prove the fixes worked. Re-run the three original subjects
  WITH the Sprint 12–14 features live and quantify the outcome delta vs. the
  first study (which findings are now FIXED / PARTIAL / OPEN), then add two
  adversarial subjects (plateau-prone advanced lifter; highly intermittent
  traveller) built to break what's left. The bar rises from "find gaps" to
  "measure whether we closed them."

- **QA** — from feature tests to **invariant tests**. Sprint 14 introduced the
  multi-user isolation dimension; Sprint 15 formalizes a standing invariant
  suite (isolation, no-cross-account-write, no-IDOR, anonymous-rejected) that
  every future data feature must pass, plus adopt the R&D eval bench as a
  quality gate. Target: a red bench or a broken invariant blocks merge, same
  as a red pytest.

- **CI/CD** — the eval bench and the browser isolation test should run in CI,
  not just by hand. Ambition: wire the Playwright isolation scenario and the
  offline eval-bench scoring into the pipeline so regressions in data
  separation or plan quality are caught before deploy, not after.

- **Automation** — anything done by hand twice becomes a script. The live
  two-account isolation round-trip and the live check-in proof were both
  hand-run this cycle; fold them into scripts/ so post-deploy verification of
  isolation + stateful check-in is one command.

- **Project management / Producer** — keep the sprint cadence, but raise the
  gate: every sprint now closes against the four-value test AND the isolation
  invariant AND (once built) the eval-bench score. Groom the research teams'
  Sprint 15 output into the highest-leverage build sprint.

## Build candidates already queued (groomed)
- Golden-intake eval bench (R&D idea 1) — the safety tool for all prompt work.
- Bodyweight quick-log + trend sparkline feeding the check-in (the last
  missing measured-data source; built under the owner-stamp isolation model).
- Deload checkbox + stall-history into the check-in payload (SIM cluster remainder).
- "Numbers verified" badge (server recomputes BMR/TDEE/macros, badges when it reconciles).

## Hotfix pass — SHIPPED 2026-07-19 (before the main build)

Both Sprint-15 studies landed and independently converged on a cluster of real
regressions in the Sprint 12–13 code. Fixed and verified immediately:

- **Deload autopilot keyed on calendar age, not training** (R&D A4 / SIM S1):
  `deloadInfo()` now counts weeks that actually contain a logged session since
  the anchor (non-loggers still get a calendar reminder), and a >14-day gap
  since the last session suppresses the deload entirely — a returning user
  ramps back up, not down.
- **Deload sessions poisoned the stall watch / progression cue** (R&D A3):
  Coach Mode now tags deload sessions; `stallWatch()` and `coProgressCue()`
  skip them, so a deliberately reduced week can't read as a stall or become
  the baseline the next session tries to beat.
- **Coach told a detrained lifter to ADD load** (SIM S7): if the newest
  non-deload log for a lift is >14 days old, the cue eases back (−10%,
  2–3 RIR) instead of "add 2.5 kg" off a stale number.
- **Stall watch window ignored experience and time** (SIM S2): the window is
  now experience-scaled (advanced → 4 flat sessions, not 3) and sessions more
  than 21 days apart are treated as non-comparable (a layoff isn't a stall).
- **Allergen validator gap** (R&D A2): short allergens (egg, soy, nut, fish)
  are now enforced (the old len≥4 floor dropped them), the scan covers the
  whole diet plan (not just the sample day), and word-boundary matching avoids
  "nut"→"nutrition" false hits.

Evidence: pytest 85/85 (+4 allergen tests), a 10-check browser hotfix pass
(trained-weeks trigger, welcome-back suppression, no deload-poison, stale-cue
ease-back, preserved add-load happy path), site_qa 29/29. SIM also confirmed
Sprints 12–14 improved simulated outcomes (Marcus ~80%→90% adherence, Dev's
knee-safe programming survives recalibration).

## Outcome (main build) — Golden-intake eval bench SHIPPED 2026-07-19

Built R&D LAB's #1 deliverable: a deterministic plan-quality bench so prompt /
model / validator changes are gated by a number, not a hand-eyeballed plan.

- **`qa/trainer_bench.py`** (stdlib only) imports the shipped gate
  (`app._validate_plan` / `_plan_strings`) so bench and production can't drift.
  6-part rubric (structural, volume-band tally via a 40-movement muscle map,
  session-time budget, whole-plan allergen scan, banned-phrase-without-a-number
  grep) + a 15-entry population-assertion registry.
- **`qa/bench_intakes.json`** — 12 fixed intakes (BMI-37 novice, 58-y/o novice,
  17-y/o minor, vegetarian/low-sleep, night shift, home-DB-only, RED-S floor,
  ACL knee, current-lifts, low-adherence check-in, allergen stress) with real
  intake keys + per-intake population assertions.
- **Two modes**: offline (default, $0, no key — scores the demo + checked-in
  live fixtures; wired into CI right after pytest) and live
  (`BENCH_LIVE=1 … --server …` — POSTs each intake once, ≤1 call each, captures
  the plan as next run's fixture). `--only <ids>` for targeted seeding.
- **First live run against production caught genuine issues** (the bench's whole
  point): the ACL-knee plan contained the banned filler "listen to your body"
  with no number nearby, and its sample-day macros drifted >7% off target
  (`structural`); the BMI-37 3-day plan trained hamstrings only 1×/week. These
  are logged below as the next prompt-pass targets. The clean production plans
  (home-DB-only 7/7, current-lifts 6/6) are checked in as CI regression anchors
  alongside the demo (4/4).
- Guardrails: 5 pytest bench tests (demo scores full, every assertion is known,
  the muscle map covers the demo, banned-phrase needs a number, checked-in
  fixtures stay green). pytest 90/90, offline bench 17/17, site_qa 29/29.

### Findings the bench surfaced (next prompt pass)
- **Banned filler slips through**: "listen to your body" with no adjacent number
  reached a live plan — tighten TONE enforcement / add to the plan self-check.
- **Sample-day macro drift**: a live plan's sample-day totals were >7% off the
  target — the validator caught it but it was soft-served; investigate whether
  the retry budget or the prompt's arithmetic self-check needs strengthening.
- **Posterior-chain frequency**: a 3-day novice plan hit hamstrings 1×/week;
  reinforce the "every muscle ~2×/week" rule for low-day splits.

Remaining queued (unchanged): bodyweight quick-log + trend sparkline; deload
checkbox + stall-history into the check-in payload; "numbers verified" badge.

## Prompt pass — SHIPPED 2026-07-19 (bench-gated, measured live)

The rules the bench caught being violated already existed — they weren't
salient enough, so the model treated the self-check as passive. Made them
active verifications (full + compact kept in parity, R&D cadence item 2):
banned-filler phrases now banned OUTRIGHT and re-scanned in self-check 9; the
diet section + self-check 4 now require ACTUALLY SUMMING the written sample day
and re-adjusting until within 5%; the split rules + self-check 2 require
verifying hamstrings/glutes/rear delts are each trained 2×/week.

**Live before → after (same intakes, production, non-deterministic single
sample):**
- `knee_acl_strength` **5/7 → 7/7 ✓** — both findings fixed: the banned
  "listen to your body" is gone, and the sample-day macros now reconcile
  (structural passes). Frozen as a checked-in CI regression anchor.
- `bmi37_novice_cut` — hamstring-2×/week frequency **still missed** in this
  sample (reinforced but not resolved; the bench keeps it visible), and the
  bench surfaced a genuine new finding: protein 180 g ≈ 2.57 g/goal-kg, above
  the prompt's own 2.2 g/goal-kg ceiling for BMI≥30. Both carried to the next
  pass; fixture not checked in.

**Bench refinement found along the way:** `no_exercise_matching` matched "run"
inside "Crunch" — added word boundaries to the exercise-match assertions (+1
pytest guard). Offline anchors now demo 4/4 + home-DB 7/7 + current-lifts 6/6 +
knee 7/7 = 24/24. pytest 91/91.

**Still open for the next prompt pass:** hamstring/posterior-chain 2× frequency
on 3-day splits; goal-weight protein ceiling for BMI≥30. The bench will prove
the fix (or its absence) next run.
