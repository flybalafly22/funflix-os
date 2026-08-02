# Sprint 37 — Interactive exercise swap + hardened deload-cadence parse

**Why:** the plan already names one substitution per exercise, but it was static
text. A real session needs it actionable ("the squat rack's taken → log goblet
squats"). Plus the deload-cadence parser was brittle (SIMULATION) — it only caught
"every N weeks" and silently defaulted everything else to 6.

## What shipped (`templates/trainer.html`, client-only)
### Interactive swap (Log form)
- `swapMap()` / `effName(day, ex)` / `setSwap()` persist a per-(day, exercise)
  choice in `trainerSwaps`.
- Each exercise with a `substitution` gets a "⇄ swap: <sub>" button; swapped, it
  shows "↩ back to <original>". The Log form renders under the effective name,
  logs under it, and — importantly — the swapped movement carries its **own**
  history and next-session target (dumbbell press ≠ barbell bench). Persists until
  swapped back.

### Hardened deload cadence
- `deloadCadence()` now tries several phrasings — "every N weeks", "every 4th
  week", "after N weeks", a bare "4–8 weeks", and a last-resort "N weeks" — instead
  of only the first, so the periodization banner and deload card read the plan's
  real cadence rather than defaulting to 6.

## Gates
- `qa/qa_swap_cadence.py` **ALL OK** (offline): swap shows the sub, persists, logs
  the set under the sub name, reverts; cadence parses 5 / "4th" / "after 7" / and
  defaults to 6 when no number is given.
- pytest **142** (client-only). site_qa **32/32**. `qa_next_target.py` +
  `qa_block_phase.py` regressions **ALL OK** (both touch the same code paths).
  Screenshot reviewed — swapped lift shows its own "Last" + target.

## Outcome (closed)
Substitutions are now a live tool, and the deload-cadence parse is robust — closing
the SIMULATION brittle-regex item. Next: Sprint 38 (Producer review + luxury sweep).
