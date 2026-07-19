# Sprint 12 — The Trainer Remembers

**Source:** both Sprint-11 research teams independently ranked the same defect
#1 — check-ins are stateless. R&D LAB wrote the exact fixes (RND_LAB.md
findings 1-4); SIMULATION showed the damage (knee-safe machinery lost at
recalibration, cable machines prescribed to a home-barbell lifter, orphaned
logs). This sprint ships their prescriptions.

## Scope & acceptance criteria

1. **Stateful check-in.** Client attaches planDigest() (split, days/exercises
   with loads, diet targets, safety notes, plan age) + qaLogDigest() (already
   built for Q&A) to check-in submissions; a computed elapsed-weeks field
   corrects the capped select; a disruption (travel/illness) field feeds
   trend discounting. Server injects both digests (20KB guards) into the
   prompt for Gemini AND Groq. Prompt: PREVIOUS PLAN rule (keep split/names,
   carry loads forward, re-apply safety flags, list deviations), LOG-outranks-
   free-text rule, disruption discounting.
   *Accept: digests reach the model verbatim (unit test); one real live
   check-in demonstrably keeps the previous plan's exercises and loads.*
2. **Plan validator.** _validate_plan() — day/exercise shape, numeric sets,
   macro arithmetic ±3%, sample-day totals ±7%, markdown/newline scan,
   allergen scan (plural-stemmed) — wired into both retry legs; plan-shaped-
   but-flawed output retries and is soft-served only when the whole chain
   exhausts (never an error page). Failure names logged for the Lab.
   *Accept: demo passes the gate; broken plans retry; exhaustion soft-serves.*
3. **Prompt consistency + Groq parity.** Muscle-gain-rate contradiction
   reconciled to one experience-scaled table referenced by both plan and
   check-in mode; compact prompt gets the Lab's parity patch (stall rule,
   novice linear progression, special populations, check-in bands, caffeine
   half-life, stateful check-in rules).
   *Accept: no contradicting numbers between the two prompts or modes.*

## Outcome
_(open)_
