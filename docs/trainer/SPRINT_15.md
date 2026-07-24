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

## Outcome
_(open — awaiting the two Sprint 15 studies, then Producer picks the build)_
