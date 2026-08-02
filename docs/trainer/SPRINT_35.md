# Sprint 35 — Check-in payload enrichment (SIMULATION)

**Why:** the check-in prompt already knows the *rules* ("deload if 6+ weeks since
the last; a stalled lift → 10% reset, check sleep first") but the recalibration
payload never carried the *data* to apply them — the model had to guess whether a
deload was due or which lifts were stuck. Now it's measured, straight from the
on-device logs and deload clock.

## What shipped (`templates/trainer.html`, client-only)
Three computed fields added to the check-in `intake()` payload:
- **`weeks since last deload (computed)`** — from `blockPhase()` (the deload-clock
  anchor), so the "deload if 6+ weeks" rule has a real number.
- **`deload currently due (computed)`** — `yes`/`no` from `deloadInfo()` /
  `fatigueDeload()` (the same triggers the Log tab uses), so the model and the app
  agree.
- **`lifts stalled 2+ sessions by e1RM (computed)`** — the `stallWatch()` list
  (with `(deepening)` when a stall is escalating), so a "reset that lift 10%"
  suggestion targets the lift that's actually stuck, not a guess.

## Gates
- `qa/qa_checkin_state.py` **ALL OK** (offline, intercepts the check-in POST):
  seeds a plan 7 weeks in + 6 flat weekly Bench sessions → asserts all three
  fields present, weeks-since-deload ≥ 6, deload due = yes, Bench listed as stalled.
- `qa/qa_checkin_safety.py` still **ALL OK** (S28 payload intact). pytest **142**
  (client-only). site_qa **32/32**.

## Outcome (closed)
The recalibration now reads the deload clock and stall history instead of guessing
— closing the SIMULATION "weeks-since-deload / stall history not in the check-in
payload" gap. Next: Sprint 36 (kg/lb units + configurable bar).
