# Sprint 33 — Next-session targets (double-progression, on the Log form)

**Why (feedback loop):** the Log form already shows *what you did last time*
(Strong mechanic) but not *what to do this time*. A real coach turns that into a
number. This computes the double-progression target per exercise from the last
session, so "beat last week" stops being a guess.

## What shipped (`templates/trainer.html`, client-only)
- `nextTarget(ex, last)` + helpers `parseRepRange` / `isLowerBody`:
  - **Hit the top of the rep range on every working set** → add load and reset to
    the bottom: "Hit the top everywhere last time — add 2.5 kg: aim 62.5 kg × 5+."
    Lower-body lifts step +5 kg, everything else +2.5 kg.
  - **Below the top** → hold the load, chase +1 rep toward the top: "Same 40 kg —
    aim 8+ on every set (toward 10), then add load."
  - **Bodyweight move at the top** → "add a set or push past 12 reps."
  - No prior session for that lift → no target (nothing to progress from).
- Rendered as a `.lg-target` accent line under the existing "Last · …" line; reads
  the most recent **non-deload** session (`lastEntryFor` already skips deloads).

## Gates
- `qa/qa_next_target.py` **ALL OK** (offline: seeds a plan + prior session, asserts
  the four cue types — upper +2.5, lower +5, bodyweight add-set, sub-top +1-rep —
  and that no target shows without history).
- pytest **142** (unchanged; client-only). site_qa **32/32**. 390px screenshot
  reviewed — clean, premium.

## Outcome (closed)
The Log form now coaches the next session, not just records the last one. Next:
Sprint 34 (periodization block banner).
