# Sprint 7 — One Memory

**Producer's theme:** close the internal seams so every surface consumes what
the others produce. The pieces exist; they don't all talk to each other yet.
One data-loss bug jumps the queue.

## Scope & acceptance criteria (from the Producer's review)

1. **Demo clobber bug (first)** — no demo-sourced plan ever overwrites an
   existing saved plan or reaches sync; a fresh visitor's demo may still seed
   local state (QA flows depend on it) but never pushes to Neon.
   *Accept: real plan saved → ?demo=1 submit → localStorage plan and sync
   untouched (site_qa).*
2. **Q&A knows the training log** — the client sends a compact digest (last
   ~10 sessions' best sets, stall list, plan age); the ask-prompt teaches
   from it. *Accept: seeded logs → "how is my bench progressing" answer
   quotes actual logged numbers; digest presence asserted in a unit test.*
3. **Check-in prefills what the studio knows** — name, goal, prescribed
   calories, weeks-on-plan (from the saved plan + its timestamp), plus the
   existing lifts autofill; typed text always wins. *Accept: saved plan →
   check-in tab opens filled; clean for no-plan visitors.*
4. **Shared plans can be kept** — "Save to this device" on shared-plan view
   (overwrite confirm if a plan exists) unlocking Log/Coach/Q&A/sync.
   *Accept: fresh context → shared link → save → reload → Restore pill +
   Log tab present.*
5. **Sync honesty** — when a newer server plan replaces the local one, the
   on-screen plan re-renders and says "Updated from your account"; lastPlan
   refreshes so Q&A/Share ground in the new version. *Accept: simulated
   two-device flow shows the notice and refreshed grounding.*
6. **(small) Auth honesty** — the account modal states there is no password
   reset yet.

Deliberately not picked (Producer): homepage conversion, Lighthouse,
multi-plan history — acquisition polish before internal consistency is
decoration. Queued in ROADMAP instead.

## Outcome — CLOSED 2026-07-18, all Producer scope shipped

- Demo clobber bug dead: with a real plan saved, ?demo=1 leaves local + sync
  untouched (site_qa asserts it); a fresh visitor's demo still seeds local
  state but never pushes to Neon. Sample plans label themselves.
- Q&A grounds in the log: client sends {sessions' best sets, stalls,
  plan_age_days}; digest verified riding in the system instruction (unit
  tests incl. 20KB size guard); prompt teaches from real numbers and tells
  log-less users the honest thing.
- Check-in opens pre-filled: name, goal (matched to select), prescribed
  kcal, nearest weeks-on-plan — typed text always wins; clean when no plan.
- Shared plans keepable: "Save to this device" (overwrite confirm) unlocks
  Restore/Log/Coach/sync; verified in a fresh mobile context.
- Sync honesty: newer account plan re-renders on screen with "Updated from
  your account · date", lastPlan refreshed so Q&A/Share ground correctly.
- Account modal now states there is no password reset yet.
- QA: 55 pytest, 29 site_qa checks, no mobile overflow, zero console errors.
