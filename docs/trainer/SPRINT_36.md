# Sprint 36 — Configurable bar + unit in Coach Mode plate math

**Why (usability + SIMULATION):** Coach Mode's plate calculator and warm-up ramp
were hardcoded to a 20 kg Olympic bar with kg plates. That's wrong for a 15 kg
women's bar and useless in a lb gym — the SIMULATION "hardcoded 20 kg bar" item.
Now the lifter picks their bar and the math + unit follow.

## What shipped (`templates/trainer.html`, client-only)
- `BAR_CONFIGS` (20 kg / 15 kg / 45 lb / 35 lb) each with the right plate set and
  rounding step (2.5 kg / 5 lb); `barConfig()` reads the remembered choice
  (`trainerBar`).
- `plateMath()` / `rampFor()` now take the bar weight, plate set, unit, and step
  from the chosen config — a 45 lb bar breaks 135 lb into "45 per side", a 15 kg
  bar breaks 60 kg into "20 + 2.5 per side", the ramp reports the right unit.
- A "Your bar" selector + a dynamic unit label (`Working weight (kg/lb)`) in the
  Coach Mode plate card; the choice persists across sessions.

## Gates
- `qa/qa_bar_plate.py` **ALL OK** (offline, drives real Coach Mode): 20 kg bar
  100 → "25 + 15 per side" (kg ramp); 45 lb bar 135 → "45 per side" (lb ramp, unit
  label lb); 15 kg bar 60 → "20 + 2.5 per side"; choice persisted + remembered
  after reload. (Case-insensitive unit assert — the label is CSS-uppercased.)
- pytest **142** (client-only). site_qa **32/32** incl. all four coach-mode checks.
  Screenshot reviewed.

## Outcome (closed)
The plate math is correct for any common bar and unit, and the hardcoded-20 kg-bar
SIMULATION item is closed. Next: Sprint 37 (interactive exercise swap + hardening
the deload-cadence parse).
