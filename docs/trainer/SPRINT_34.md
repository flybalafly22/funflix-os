# Sprint 34 — Periodization block banner (REFINERS R2)

**Why (adherence + coach literacy):** the plan promises periodization (accumulate,
then deload) but the loop never showed *where you are* in it. The best apps (RP,
Juggernaut) keep the mesocycle visible. This adds a one-line orientation to the
What's-Next card, entirely from data already on device.

## What shipped (`templates/trainer.html`, client-only)
- `deloadCadence()` — the plan's deload cadence (weeks), parsed once and shared by
  the deload card and this banner (so Sprint 37 can harden the parse in one place).
  Refactored `deloadInfo()` to use it.
- `blockPhase()` — mesocycle position: the accumulation block resets at the last
  deload (`DL_KEY`), so week-in-block is measured from there (consistent with the
  deload card's own clock); the block *number* is calendar-approximate (only the
  last deload is stored). Phase flips to **deload** when a deload is actually due
  (`deloadInfo`/`fatigueDeload`) or the block reaches its last week.
- `blockLine()` + a `.nx-block` line in the What's-Next card:
  "Block 2 · accumulation, week 2 of 6 — 4 to deload · week 8 of ~13" or
  "Block 1 · deload week — hold volume, then rebuild" (accent-styled on deload).

## Gates
- `qa/qa_block_phase.py` **ALL OK** (offline): 2 weeks in → block 1 / week 3 of 6;
  7 weeks in with a deload marked ~1 wk ago → block 2 / week 2 accumulation; a
  block's final week → deload. Correctly reflects the deload-clock interaction
  (an overdue, never-marked deload honestly reads as "deload week").
- pytest **142** (client-only). site_qa **32/32**. Screenshot reviewed.

## Outcome (closed)
The mesocycle is now visible at a glance, and the deload-cadence parse lives in one
shared helper. Next: Sprint 35 (feed the deload clock + stall history into the
check-in payload).
