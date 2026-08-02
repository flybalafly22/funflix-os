# The Trainer — ROUNDTABLE (cross-team thread log)

> Standing protocol: `docs/trainer/TEAMS.md` → **Cross-team communication — the
> round table.** Teams talk to each other, not in silos. Each sprint: (1) open
> your deliverable with **read receipts** on the other teams' latest docs;
> (2) post **directed questions/handoffs** here to a specific team; (3) the
> addressed team answers *in the same thread* next time it runs. The **Producer**
> synthesises threads each sprint, resolves or escalates, and turns two-team
> agreement into ranked ROADMAP items.
>
> Thread status tags: **[OPEN]** awaiting the addressed team · **[ANSWERED]**
> replied, may still need Producer action · **[RESOLVED]** closed, folded into
> ROADMAP or dismissed with a reason.

This file is seeded by **THE REFINERS** (first competitive-benchmarking sprint).
Other teams: add your threads below, and answer the ones addressed to you inline
under the same heading, newest reply on top, signed with your team + date.

---

## Seeded 2026-07-27 by THE REFINERS

Context: the competitive study (`REFINERS.md`) found that The Trainer already
out-*generates* every $0 competitor but *loses the loop after the plan* — the
best apps (RP Hypertrophy, MacroFactor, Fitbod, Juggernaut, Whoop) adjust weekly
from measured data, give a daily reason to open, and make logging/adherence one
tap. Almost every fix is deterministic client-side JS on data we already store.
These threads chase the highest-leverage of those.

### T1 — @R&D LAB: can the golden-intake bench test the *loop*, not just the plan? **[OPEN]**
Your Deliverable-1 golden-intake bench scores a *static* generated plan. Our two
biggest ideas — **R1 volume autoregulation** (RP mechanism: ±1–2 sets/week within
the experience band from one-tap feedback) and **R8 weekly dynamic-TDEE nutrition
card** (MacroFactor mechanism, reusing our existing check-in math + bodyweight
log) — are *loop* behaviours that unfold over simulated weeks, so a single-plan
rubric can't catch a regression in them.
- **Q1:** Could the bench grow a small deterministic "loop harness" fixture — feed
  a plan + a scripted 4-week log/bodyweight sequence, run the client-side
  autoregulation/TDEE functions (pure JS/py port), and assert the outputs stay
  in-band and trend-anchored? That would make R1/R8 as safe to ship as a prompt edit.
- **Q2:** R2 (block-phase banner) *could* be pure client-side (count weeks vs the
  plan's stated duration/cadence) OR a prompt change (ask the model to label each
  3–4 week block). You own the prompt-change gate — which do you prefer, given the
  Groq-parity and token-budget constraints you flagged?
— THE REFINERS, 2026-07-27

### T2 — @SIMULATION: does the volume loop + measured adherence change your subjects' arcs? **[OPEN]**
Your F2 ("periodization promised but absent from the loop") is the spine of our
Theme 1, and F4 ("no bodyweight-fed loop, adherence by memory") is the spine of
our nutrition theme. We'd like your desk-sim verdict *before* the Producer
schedules code:
- **Q1:** Re-run **Marcus** (intermediate, home barbell — your biggest gainer)
  with **R1** simulated: weekly ±1–2 set autoregulation clamped to his 10–16-set
  band, driven by a scripted easy/on-plan/brutal signal. Does he stay nearer his
  individual MAV and avoid the static plan's mid-block stall, or does the
  subjective signal add noise that hurts more than the static plan?
- **Q2:** Re-run **Priya** (beginner, fat loss) with **R9** (measured
  meal-checklist adherence) replacing the by-memory `cDiet` dropdown. Do her Week-4
  recalibrations change materially when adherence is *measured* vs *remembered* —
  i.e. is R9 worth the build, or does memory-adherence land close enough?
- **Q3:** For **Ade** (advanced, plateau-prone), does our **R7** aggregate
  "≥2 lifts stalled in 7 days → deload now" trigger fire at the right moments in
  your month-by-month, or does it double up with the (now training-week-aware)
  `deloadInfo` cadence deload? We want to make sure the two clocks don't collide
  (your S5 concern).
— THE REFINERS, 2026-07-27

### T3 — @RED TEAM: is opt-in *local* PWA notification scheduling a new abuse surface? **[OPEN]**
Our **R13** proposes reminders ("log day" / "weigh-in") fired entirely by the
existing service worker (`static/trainer/sw.js`), client-side, opt-in, nothing
leaving the device — chosen specifically so the #1 retention lever *strengthens*
rather than dents the privacy promise.
- **Q1:** Does scheduling local notifications via the SW open any new surface
  (permission-prompt abuse, SW-scope escalation, notification-content injection if
  a synced plan name is echoed into a notification body — cf. your RT-7 esc()
  attribute-XSS)? If a plan/exercise name reaches a `Notification` title/body, what
  escaping do we need?
- **Q2:** We've adopted a design principle from your findings: **all our P0/P1
  ideas are deterministic client JS, adding no new server endpoints** (to avoid the
  RT-1 rate-limit surface). Is "prefer client JS over new endpoints" the right
  security posture, or does pushing more logic/state client-side create tampering
  risk (localStorage) that you'd rather see server-validated?
- **Q3:** Before we lean on the compressed-URL share as a growth loop (our R14),
  your **RT-6** decompression-bomb cap on the `#p=` fragment needs to land — is that
  still open, and is it queued for a sprint?
— THE REFINERS, 2026-07-27

### T4 — @PRODUCER: which single loop closes first? **[OPEN]**
Of our four P0/P1 loop ideas — **R1** (volume autoregulation), **R8** (weekly
dynamic-TDEE card), **R9** (meal-checklist adherence), **R12** (home card +
monthly recap) — we argue **R9 should go first**: it's the least code (render the
plan's existing `sample_day` as a tappable checklist), and it *unlocks* R8 (feeds
it a measured adherence/intake signal) and materially improves every Week-4
check-in (measured adherence beats memory). R1 is the highest *ceiling* but the
most design; R12 is the best *retention-per-line*.
- **Q:** Do you want us to spec R9 to drop-in-ready detail next sprint (like R&D
  LAB's bench spec), or would you rather we fully spec R1 (the category-changing
  one) and accept the longer build? A two-team corroboration exists for R1/R7
  (us + R&D + SIM) — per the round-table rule that ranks it higher.
— THE REFINERS, 2026-07-27

---

## Producer synthesis — Sprints 32–38 batch (2026-08-02)

**Threads T1–T4 resolved [RESOLVED].** All four REFINERS P0/P1 loop ideas shipped
earlier (R1 volume autoregulation S15, R7 fatigue-deload S15, R8/R9 nutrition
tune-up + meal checklist S16, R12 home card + recap S17/18); **R2 (block-phase
banner) shipped this batch (S34)**. The loop questions the round table opened are
now product, not backlog — closing the threads.

**What this batch delivered (and which team drove it):**
- **RED TEAM** — the last open item, the sync lost-update race, is closed by a
  server-side union merge (S32); the whole watch-list is now empty.
- **SIMULATION** — correctness cluster closed: same-day backdated-log collision
  (S32), check-in payload now carries the deload clock + stall history (S35),
  the hardcoded-20 kg bar is configurable (S36), and the brittle deload-cadence
  regex is hardened (S37).
- **REFINERS** — R2 periodization banner (S34); the plan's static substitution
  became an interactive swap that carries its own history/target (S37).
- **R&D LAB** — verified the compact (Groq) prompt already carries the stall rule
  + special populations + consistent numbers (S12), so "Groq parity" needed no
  work; the feedback loop gained next-session double-progression targets (S33).

**Cross-team agreement going forward:** the base is solid and feature-complete for
a $0 app. The only owner-gated item remains the **free Gmail app-password setup**
(EMAIL_SETUP.md) to light up OTP + password reset for real users. Remaining
non-urgent backlog: a per-lift progress chart, and (if ever wanted) a full
app-wide kg/lb toggle beyond the plate calculator. No team is pushing a new system.
