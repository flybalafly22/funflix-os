# THE REFINERS — competitive benchmarking & craft ledger

> Standing team charter: `docs/trainer/TEAMS.md` → **THE REFINERS — competitive
> benchmarking & craft.** Every sprint this team studies the best training /
> fitness / nutrition apps in the world, asks WHY each made its design choices
> (what problem it solves, what it trades away, where that app itself falls
> short), then compares against The Trainer to surface concrete, $0 improvement
> opportunities. Findings feed `ROADMAP.md` via the Producer.
>
> **Ground rules honoured:** no application code was modified by this team
> (read-only on `app.py` / `templates/trainer.html` / `data/trainer_system.txt`
> while the Producer edits them concurrently). No competitor UI, branding, copy,
> icon, or asset was copied — we learn the MECHANISM, re-derive it from first
> principles, and every borrowed idea is verified $0 and privacy-preserving.
> This file + `ROUNDTABLE.md` are the only artifacts.
>
> **Method:** desk study of each app's onboarding, plan generation, in-workout
> logging UX, progression/autoregulation model, deload handling, nutrition
> tooling, check-in cadence, retention loops, offline, and monetisation — read
> against The Trainer's actual implementation (`templates/trainer.html`,
> `data/trainer_system.txt`, `app.py`) at commit `3ff8b77`. Line numbers are
> approximate (files under concurrent edit); anchor on the named functions.

Apps studied this sprint: **Strong, Hevy, JEFIT, Boostcamp** (logging &
libraries); **RP Hypertrophy, Juggernaut AI, Fitbod, Freeletics** (programming &
autoregulation); **MacroFactor, Cronometer, MyFitnessPal, RP Diet** (nutrition);
**Whoop, Zero, Apple Fitness, Caliber, Future** (retention, coaching, wearables).

Impact key: **P0** = changes the product's category (notebook → coach) ·
**P1** = large retention/accuracy win · **P2** = craft/polish · **DIFFER** =
a place we should deliberately NOT copy them.

---

## The one-sentence competitive read

The Trainer already out-*generates* every $0 competitor (no one else writes a
full evidence-graded, macro-reconciled, special-population-aware plan for free
and offline). Where the best apps beat it is not the plan — it is the **loop
after** the plan: they adjust *weekly from measured data*, they give a *daily
reason to open the app*, and they make *logging and adherence one tap*. Almost
every gap below is "The Trainer has the science and the data but not the loop
that uses them," and almost every fix is deterministic client-side JS on data
we already store — i.e. genuinely $0.

---

## Theme 1 — Progression & autoregulation: the plan knows MEV/MAV/MRV, the loop never uses them

### R1 [P0] — RP Hypertrophy's per-week volume autoregulation vs our static-until-week-4 volume
- **App + choice:** The **RP Hypertrophy** app operationalises Renaissance
  Periodization's volume-landmark model (MEV → MAV → MRV). After each session the
  user gives 2–3 one-tap signals per muscle (pump, soreness/disruption, joint
  ache, performance-vs-last), and the app *adds or removes 1–2 sets next week*,
  climbing from MEV toward MRV across a mesocycle, then auto-deloads at the top.
- **WHY:** formula-based static volume is wrong per-person and per-week; the only
  honest volume signal is the athlete's own recovery response. Moving 1–2 sets/wk
  keeps everyone near their individual MAV without a coach. It is the single
  best-in-class hypertrophy engine at any price.
- **Trades away:** hypertrophy-only, demands diligent per-set feedback, paywalled,
  and can over-index on subjective pump/soreness (noisy signals).
- **Where RP itself falls short:** the feedback burden is high; many users
  under-report and the algorithm drifts. No nutrition. No true strength/powerlifting mode.
- **vs The Trainer:** The Trainer's prompt uses the *identical science* — explicit
  weekly hard-set bands by experience (`trainer_system.txt:224-229`, novice 8-12 /
  int 10-16 / adv 14-20) and recovery modulation from sleep/stress
  (`:231-240`). **But the running loop never moves volume.** The plan is generated
  once and volume is fixed until the manual Week-4 check-in. This is corroborated
  independently by SIMULATION F2 ("the periodization the plan promises does not
  exist in the loop") and by R&D LAB Deliverable-3 idea 5. **We LOSE here** — not
  on knowledge, on the loop.
- **$0 improvement (highest impact on the whole product):** a deterministic,
  plan-bounded volume autoregulator. At Coach Mode finish (`coFinish`,
  `trainer.html:1508`) or on the Log tab, collect one tap per trained muscle
  (easy / on-plan / brutal). Roll a per-muscle fatigue score; when a muscle reads
  "easy" for a week with performance up, suggest +1 set next week — *clamped to
  the top of that experience band from the plan*; when "brutal" with performance
  down, suggest −1 set. All arithmetic, no API, band-clamped so it can never
  contradict the plan's science. Log the nudges so the check-in can say "you
  autoregulated down two weeks running — a real recovery deficit." **This is the
  change that turns The Trainer from a plan generator into a coach.**

### R2 [P1] — Juggernaut AI / RP block phases vs our prose-only periodization
- **App + choice:** **Juggernaut AI** sequences real blocks — accumulation →
  intensification → realization → deload — tied to an RPE/velocity autoregulated
  progression and an e1RM model, and it *tells you which phase you are in*.
- **WHY:** phase potentiation (build volume, then intensity, then peak, then
  recover) is the textbook driver of long-run strength; naming the phase gives the
  user a narrative and a reason each block feels different.
- **Trades away:** powerlifting-centric, paid, rigid to a meet date.
- **Where it falls short:** opaque ("why did it give me this?"), no nutrition,
  overkill for a general-fitness user.
- **vs The Trainer:** our `duration_and_paths` prescribes a 3–4 month run with
  review checkpoints and "next paths," and the deload cadence is parsed and
  scheduled (`deloadInfo`, `trainer.html:1306`). But there is no *phase* the user
  can see progressing — SIM F2 again. **We LOSE on felt structure, tie on science.**
- **$0 improvement:** a client-side "phase banner" on the plan/Log view that
  counts weeks-into-plan against the plan's own duration and deload cadence
  ("Week 5 of 12 · building volume · deload in 1 week"). Zero API — it reads
  fields the plan already contains. Optionally ask the model (in the existing
  single call) to label each 3–4 week block so the banner narrates.

### R3 [P1] — Fitbod's muscle-recovery heat-map vs our invisible recovery state
- **App + choice:** **Fitbod** builds each session from a per-muscle "freshness"
  model — muscles trained recently are down-weighted, fresh muscles get today's
  volume — surfaced as a body heat-map.
- **WHY:** it removes the daily "what should I train?" decision and spreads volume
  by recovery, not by a fixed split. The heat-map is also a *daily reason to open
  the app* (see Theme 6).
- **Trades away:** long-run periodization coherence (sessions can feel random),
  subscription, weak nutrition, no strength focus.
- **Where it falls short:** the recovery model is a black box and can nag you off
  a program you were deliberately running.
- **vs The Trainer:** Coach Mode has *readiness compression* (`coReady` panel,
  `trainer.html:684`) — a lite, per-session version — but no cross-session
  recovery state and no visualisation. **We tie on the session, lose on the map.**
- **$0 improvement:** compute per-muscle "days since trained + last volume" from
  `loadLogs()` and render a small recovery gauge on the Log/home view (self-drawn,
  like the bodyweight sparkline `bwSparkline`, `trainer.html:1108`). Feeds R1's
  autoregulator and Theme 6's home card. We deliberately DON'T let it override the
  plan's split (that is Fitbod's failure mode) — it *informs*, not dictates.

---

## Theme 2 — In-workout logging UX: our Coach Mode is class-competitive; the plain Log tab is a step behind

### R4 [P1] — Strong's inline "previous performance" vs our prescription-only Log form
- **App + choice:** **Strong** (the logging gold standard) ghosts *last time's
  exact kg × reps* into every set field, auto-starts the rest timer on set
  completion, and offers a plate calculator and warm-up calculator.
- **WHY:** progressive overload IS "beat last time"; showing last time inline
  makes the target obvious with zero recall, and sub-second logging between sets
  is what keeps people logging at all.
- **Trades away:** it is *only* a notebook — no programming, no nutrition, no
  coaching.
- **Where it falls short:** users must design and progress their own program; no
  autoregulation, no deload logic.
- **vs The Trainer:** Coach Mode already shows last sets (`lastSetsFor`,
  `trainer.html:1384`), progression cues (`coProgressCue`, `:1405`), rest timers,
  plate math (`plateMath`, `:1331`) and ramps — genuinely competitive with Strong
  *inside Coach Mode*. **But the plain "Log a session" tab (`renderLgList`,
  `:1159`) shows only the prescription** (`sets × rep_range · RIR`), not last
  time's numbers. A user who logs from the simple tab flies blind on their own
  progress.
- **$0 improvement:** port `lastSetsFor`/`fmtSet` into `renderLgList` — ghost the
  last logged kg×reps as each set input's placeholder. ~10 lines reusing existing
  functions; makes the fast path as smart as Coach Mode.

### R5 [P2] — Hevy's mid-workout exercise swap vs our fixed session list
- **App + choice:** **Hevy** lets you swap or reorder an exercise mid-workout
  (machine taken, joint cranky) without leaving the session.
- **WHY:** the gym is not the plan; a taken squat rack shouldn't end the workout.
- **Trades away:** swap freedom can erode program fidelity if abused.
- **vs The Trainer:** Coach Mode marches the prescribed list; a "this hurts / it's
  taken" tap has nowhere to go. **We lose a real-gym affordance.**
- **$0 improvement:** a deterministic substitution graph (self-authored CC0 JSON,
  each canonical movement → equipment- and injury-conditioned swaps) drives a
  one-tap "swap" in Coach Mode and the Log form. This is exactly R&D LAB
  Deliverable-3 idea 3 — we **corroborate and second it** from the competitive
  side; the same graph also backstops the diet linter (Theme 4).

### R6 [DIFFER] — JEFIT / MFP giant licensed exercise+video DB — deliberately don't
- **App + choice:** **JEFIT** and MyFitnessPal ship thousands of exercises with
  stock animations/videos.
- **WHY:** breadth signals authority and covers every niche movement.
- **Trades away:** UX bloat, ad load, and (for us) **licensing cost + risk** — the
  whole reason CLAUDE.md mandates CC0-only.
- **Decision:** DIFFER. Keep The Trainer's self-authored pictograms (Sprint 4) and
  extend the self-written form-cue library (R&D LAB idea 6) instead of licensing a
  DB. Cleaner, $0, on-brand. Our edge is *coaching quality per exercise*, not
  exercise *count*.

---

## Theme 3 — Deloads: the trigger is improving but is still cadence-based, not fatigue-based

### R7 [P1] — RP / Juggernaut fatigue-triggered deloads vs our (now training-week) cadence deload
- **App + choice:** best-in-class deloads fire on *accumulated fatigue markers* —
  a performance drop across lifts, rising joint pain, tanking motivation, or the
  end of a planned meso — not on a wall-clock week count.
- **WHY:** fatigue is earned by training, not by calendar time; a traveller who
  missed two weeks needs a ramp, not a deload, and a hard-charging advanced lifter
  may need one early.
- **Trades away:** marker-based triggers need feedback the app can trust.
- **vs The Trainer:** the loop has moved in the right direction — `deloadInfo`
  (`trainer.html:1306`) now counts `trainedWeeksSince` (training weeks, not
  calendar) and suppresses the deload after a >14-day break (`:1309-1312`), which
  is genuinely good and ahead of Fitbod's nagging. **But it still keys off the
  plan's fixed cadence, not measured fatigue** (a performance drop or an aggregate
  "≥2 lifts stalled this week"). This is exactly the cluster SIMULATION S1/S3/S5
  and R&D LAB A2/A3 have open. **We tie the naive competitors, lose to RP/JN's
  marker model.**
- **$0 improvement:** add an aggregate trigger — if `stallWatch` (`:1249`) flags
  ≥2 lifts in a 7-day window, surface "deload now" regardless of cadence; and feed
  the session-RPE from R1 so three "brutal" sessions inside 10 days can pull the
  deload forward. Reuses the e1RM stall machinery already shipped. Corroborates
  two teams — rank it high (a two-team finding per the round-table rule).

---

## Theme 4 — Nutrition: The Trainer already owns MacroFactor's hard half and never runs it

### R8 [P0] — MacroFactor's dynamic-TDEE + adherence-neutral coaching vs our once-a-month manual recalibration
- **App + choice:** **MacroFactor** is the best nutrition coach at any price. Its
  mechanism: you log food and weigh in; a statistical model back-calculates your
  *real expenditure* from the intake-vs-weight-trend (not a formula), then
  auto-adjusts your macro targets *weekly* toward your chosen rate — and it is
  aggressively **adherence-neutral** (it never scolds a bad week; it just
  re-estimates).
- **WHY:** formula TDEE (Mifflin) is wrong for nearly everyone; the *only* truth
  is your own trend. Weekly adjustment keeps drift small. Shame-free tone is a
  deliberate retention decision — guilt makes people delete diet apps.
- **Trades away:** requires food logging (real friction), paid, and needs ~2 weeks
  of data before the estimate stabilises.
- **Where it falls short:** the food-logging burden is the whole ballgame; miss it
  and the model is blind.
- **vs The Trainer:** **The Trainer already implements the mathematically hard
  half.** The Week-4 check-in computes real TDEE from the measured trend
  (7700 kcal/kg → ~1100 kcal/day per kg/wk error, `trainer_system.txt:106-119`),
  anchors the new target on the trend not the formula, discounts water weight, and
  *gates on adherence by simplifying rather than re-cutting* (`:110-113`) — which
  is a strong, MacroFactor-grade instinct. And we already have the bodyweight log
  (`loadWeights`/`weightTrendPerWeek`, `trainer.html:1058/1083`). **What's missing
  is only the cadence and one input:** we run this once a month, by hand, from
  memory-based adherence. **We are one small feature from beating the $0 field on
  the single most valuable nutrition mechanism.**
- **$0 improvement:** a passive weekly "expenditure check" between check-ins.
  With the bodyweight trend we already store *plus* one lightweight "typical daily
  calories" input (or the meal-checklist adherence from R9), compute an updated
  TDEE estimate and a ±100–150 kcal nudge — exactly the correction rule the prompt
  already states (`trainer_system.txt:174-175`) — as a client-side card. No API.
  Adopt MacroFactor's adherence-neutral phrasing explicitly in the copy. This is a
  differentiator because *we already own the recalibration math and the weight
  data* — the moat is nearly built.

### R9 [P1] — RP Diet's meal-checklist adherence vs our by-memory adherence self-report
- **App + choice:** the **RP Diet** app gives a meal-by-meal card list with
  portions and *check boxes* — you don't count calories, you check off meals.
- **WHY:** adherence comes from structure and low decision-cost, not arithmetic;
  checking a box is near-zero friction and yields an objective adherence signal.
- **Trades away:** rigid; no ad-hoc meals; assumes you eat the prescribed foods.
- **vs The Trainer:** our plan already contains exactly this data — `meal_schedule`
  + a summed, allergen-safe `sample_day` built from the client's *familiar* foods
  (`trainer_system.txt:369-392`). But it lives static in the PDF; the app never
  turns it into an interactive daily checklist, and the check-in's "diet
  adherence" is a single by-memory dropdown (`cDiet`, `trainer.html:602`). SIM F4
  flags that the recalibration doctrine never gets the measurement it claims to run
  on. **We have the content; we lose the interaction.**
- **$0 improvement:** render `sample_day`/`meal_schedule` as a tappable daily
  "meals hit" checklist on the Log tab (localStorage, synced like logs); the
  fraction checked over the block becomes a *measured* adherence % that autofills
  the check-in (`autofillCheckin`, `:1575`) and feeds R8's weekly nudge — killing
  "adherence by memory." Reuses plan data the model already produces.

### R10 [DIFFER] — MyFitnessPal / Cronometer food databases + barcode — deliberately don't
- **App + choice:** MFP's barcode + crowd-sourced food DB and Cronometer's
  verified 84-nutrient DB make calorie/micronutrient logging fast and precise.
- **WHY:** the network-effect food DB is MFP's whole moat; micronutrient accuracy
  is Cronometer's.
- **Trades away:** MFP's DB is full of junk duplicate entries and now paywalls
  barcode scanning behind ads; both demand daily food logging (high churn driver).
- **Decision:** DIFFER. A food DB is out of scope, not $0 to maintain, and a
  privacy liability. The Trainer's structure-based adherence (R9) captures ~80% of
  the coaching value of food logging at ~5% of the friction, and the dynamic-TDEE
  loop (R8) makes exact calorie counts unnecessary — the trend corrects the
  estimate. This is a *feature*, not a gap: we coach outcomes, not data entry.

---

## Theme 5 — Check-in cadence: decouple nutrition (weekly, passive) from training (monthly)

### R11 [P1] — MacroFactor/RP weekly recalibration vs our single 4-week gate
- **App + choice:** the best nutrition coaches recalibrate **weekly**; RP's
  training app deloads/adjusts on a meso rhythm; Whoop issues a weekly report.
- **WHY:** tighter loops catch drift early and make the user *feel coached* every
  week, not once a month.
- **Trades away:** weekly asks more of the user; too-frequent training changes
  violate the "don't program-hop" principle.
- **vs The Trainer:** our single Week-4 tab (`tabCheckin`, `trainer.html:441`)
  conflates two different clocks. Four weeks is *correct* for training (adaptation
  needs a consistent stimulus — `trainer_system.txt:436-438`) but *too slow* for
  nutrition, where a weight trend is readable in ~2 weeks. **We're right on
  training, slow on nutrition.**
- **$0 improvement:** decouple. Keep the full recalibration at 4 weeks, but add a
  *passive weekly nutrition card* (R8) driven purely by the bodyweight trend — no
  form, no API, just "trend says ~−0.3%/wk, on target, hold calories." Plus a
  gentle cadence-nudge banner (SIM F4/S10) when a check-in is due. This gives a
  weekly touch without inviting program-hopping.

---

## Theme 6 — Retention: The Trainer has no reason to open between sessions, and no reminders

### R12 [P1] — Whoop/Apple daily score + monthly report vs our no-daily-hook, no-recap
- **App + choice:** **Whoop** gives a daily recovery/strain number and a
  weekly/monthly narrative "performance assessment"; **Apple Fitness** rings turn
  daily activity into a goal you close.
- **WHY:** a number that changes daily is a reason to open the app (habit), and a
  periodic narrative report converts raw logs into felt progress and insight
  (retention + word-of-mouth).
- **Trades away:** Whoop needs a $30/mo band; rings need a watch.
- **vs The Trainer:** between sessions there is *nothing* — no home card, no
  streak, no recap. We store rich logs and bodyweight but never reflect them back
  daily. **We lose the habit loop entirely.**
- **$0 improvement (two parts, both pure client JS on data we own):**
  (a) a home "what's next" card — "Next: Upper A · last trained 3 days ago ·
  deload in 2 wks · 3 of 4 sessions this week" — the adherence pulse already in
  ROADMAP; (b) a self-generated **monthly recap** from logs (PRs by e1RM, total
  volume, session consistency, weight trend) — this doubles as R&D LAB
  Deliverable-3 idea 2's calibration ledger ("we predicted 0.6–1.0%/mo, you
  measured 0.7% — our call landed within X%"), a self-auditing accuracy score no
  $0 competitor shows.

### R13 [P1] — Strong/MacroFactor/Zero reminders vs our silent PWA
- **App + choice:** every retention leader sends reminders — "workout day,"
  "time to weigh in," fasting/streak nudges (**Zero**).
- **WHY:** the reminder is the single highest-leverage retention mechanism; most
  churn is simply forgetting.
- **Trades away:** notifications annoy and require opt-in; a naive implementation
  needs a server + push infra (cost) and would dent the privacy promise.
- **vs The Trainer:** we are an installed PWA that sends *zero* notifications
  (confirmed — no `Notification`/push code in `trainer.html`).
- **$0 improvement:** **local** scheduled notifications via the existing service
  worker (`static/trainer/sw.js`) — "log day" / "weigh-in" — fired entirely
  client-side, opt-in, no server, no data leaving the device. This is the rare
  case where we can take the #1 retention lever *and* strengthen the privacy story
  (competitors' reminders route through their servers; ours wouldn't). Flag the
  browser-support caveat (iOS PWA notification limits) honestly.

### R14 [DIFFER] — Hevy/Strava social feed — deliberately don't (but borrow the share)
- **App + choice:** **Hevy** bolted a social feed + followers onto a Strong-style
  logger; Strava's feed is its entire moat.
- **WHY:** social accountability and comparison drive logging and virality.
- **Trades away:** a social graph is a privacy surface, a moderation burden, and
  directly contradicts "nothing leaves your device."
- **Decision:** DIFFER on the feed. But we already have the *good* half — the
  compressed-URL share (`compressToB64`, `trainer.html:1784`) and native share
  sheet let a user share a plan without a social graph. Keep that; skip the feed.
  (RED TEAM RT-6 notes the share fragment needs a decompression-bomb cap — worth
  fixing before we lean on sharing as a growth loop.)

---

## Theme 7 — Offline & data ownership: The Trainer already WINS; make the win visible

### R15 [P1] — Cloud-only, account-required competitors vs our offline / no-account / export-erase
- **App + choice:** nearly every competitor (MFP, Strong, Hevy, MacroFactor,
  Fitbod, RP, Freeletics, Caliber, Future) is cloud-first, account-required, and
  owns your data on their servers.
- **WHY:** accounts enable sync, lock-in, and subscription billing — the business
  model *needs* your data on their infrastructure.
- **Trades away:** no true offline, no privacy, and your training history is
  hostage to their servers and pricing.
- **Where they fall short:** you cannot use them on a plane without signing in;
  you cannot get your data out cleanly; deleting your account is a maze.
- **vs The Trainer:** we **beat all of them structurally** — installable offline
  PWA with saved plan + logs, no forced account ("nothing leaves your device"
  default), opt-in Neon sync, and `/api/export` + password-confirmed
  `/api/auth/delete`. This is a moat a subscription business *cannot* copy without
  breaking its own model. **We WIN — but we barely say so.**
- **$0 improvement:** make it a visible selling point on the first-run welcome
  (`#welcome`, `trainer.html:427`) and homepage card — one line: "Works offline.
  No account needed. Your data never leaves this device unless you ask it to.
  Export or erase everything in one tap." Positioning, not code — the cheapest
  high-impact change on this list.

---

## Theme 8 — Onboarding & monetisation

### R16 [P2] — Fitbod/Freeletics fast onboarding + our sample-peek is good; tighten the intake
- **App + choice:** **Fitbod**/**Freeletics** front-load a slick, low-field
  onboarding (goal, equipment, experience) and show value in under a minute;
  Boostcamp shows a full program instantly with zero questions.
- **WHY:** every extra field before first value costs conversion; show the product
  working, then ask for detail.
- **vs The Trainer:** we already do the right thing — a first-run welcome with a
  10-second sample-program peek (`welcomePeek`, `trainer.html:435`; `peekBtn`,
  `:563`) and a 3-step stepper (You / Training / Fuel, `:451-453`) rather than one
  20-field wall. **We tie the best here.** The residual gap: the peek is one
  generic male-hypertrophy demo; a fat-loss visitor doesn't see themselves.
- **$0 improvement:** a second demo persona (`?demo=cut`, a female fat-loss plan
  from a static JSON) — R&D LAB idea 7, which we **corroborate** — and deep-link
  the homepage Trainer card into the peek, not the blank form (already in ROADMAP).

### R17 [P1] — Boostcamp's proven-program library vs our generative-only, and as a reliability fallback
- **App + choice:** **Boostcamp** hosts famous *proven* programs (5/3/1, GZCLP,
  PPL, nSuns…) for free with a clean logger — no generation at all.
- **WHY:** many lifters trust a battle-tested template over an AI's fresh output,
  it is instant, and it costs zero compute.
- **Trades away:** no personalisation, no nutrition, no injury handling.
- **vs The Trainer:** we are *generative-only*. A user who just wants "give me a
  solid 4-day upper/lower" waits on a model call that can fail (the whole
  Gemini→Groq resilience stack exists because generation is fragile). **We lose
  instant-start and trust-in-known-programs; we win personalisation.**
- **$0 improvement (hybrid):** a tiny self-authored library of 3–4 canonical,
  CC0 templates (full-body 3×, upper/lower 4×, PPL 6×) rendered by the *existing*
  `renderPlan` from a static JSON. Two payoffs: (1) an instant onboarding path for
  users who don't want the full intake, and (2) a **deterministic last-resort
  fallback** when the entire model chain fails — strictly better than today's
  soft-serve skeleton (RED TEAM/SIM E9). We keep generation as the premium path.

### R18 [DIFFER] — Everyone monetises; we stay $0, and that is a weapon — just don't hobble the free tier
- **App + choice:** MFP/MacroFactor/Strong-Pro/Hevy-Pro/RP/Fitbod all subscribe
  ($40–120/yr); Future charges ~$150/mo for a human coach.
- **WHY:** recurring coaching value = recurring revenue; the free tier is a funnel.
- **Trades away:** the free tier is deliberately hobbled (Hevy caps routines, MFP
  paywalls barcode, Strong caps custom exercises) to force upgrades.
- **Decision:** DIFFER — $0 is an owner constraint *and* a positioning weapon
  (pairs with R15). The one lesson to *heed*: don't accidentally hobble our own
  free tier. The silent **200-log cap** (SIM F5/S11/E10) is the one place we do —
  a real user hits it in ~a year and silently loses history. Raise/trim smartly
  with a warning + a sync/export nudge after session 5. A "free forever, no
  ceiling" story only holds if there's no hidden ceiling.

---

## Top 10 — what would most improve The Trainer (ranked by impact ÷ cost)

1. **R1 — Volume autoregulation loop** (RP mechanism). The plan already knows
   MEV/MAV/MRV; make the loop move ±1–2 sets/week within the band from one-tap
   feedback. Turns a plan generator into a coach. *Corroborated by SIM F2 + R&D D3-5.*
2. **R8 — Weekly dynamic-TDEE nutrition card** (MacroFactor mechanism). We already
   own the recalibration math and the bodyweight log; add the weekly cadence + one
   input and we beat the $0 field on the most valuable nutrition feature.
3. **R9 — Interactive meal-checklist adherence** (RP Diet mechanism). Turn the
   plan's own `sample_day` into a tappable daily checklist → *measured* adherence
   that feeds R8 and the check-in. Kills adherence-by-memory. *SIM F4.*
4. **R4 — Inline "previous performance" on the Log form** (Strong mechanism).
   Port Coach Mode's `lastSetsFor` into `renderLgList`; ~10 lines, big daily payoff.
5. **R12 — Daily "what's next" home card + monthly recap** (Whoop/Apple mechanism).
   The missing between-session habit loop; recap doubles as the self-grading
   calibration ledger. *R&D D3-2.*
6. **R7 — Fatigue-triggered (aggregate-stall) deload** (RP/Juggernaut mechanism).
   Add "≥2 lifts stalled this week → deload now" to the already-improved
   training-week deload. *Corroborated by SIM S1/S3 + R&D A2/A3 — two-team, rank high.*
7. **R13 — Opt-in local PWA reminders** (Strong/Zero mechanism). The #1 retention
   lever, done client-side so it *strengthens* the privacy promise instead of
   denting it.
8. **R17 — Curated template library + deterministic fallback** (Boostcamp
   mechanism). Instant-start onboarding path AND a real last-resort plan when the
   model chain fails. *Backstops SIM/RED E9.*
9. **R15 — Make the offline/no-account/export moat visible** (anti-competitor
   positioning). One line of copy on the welcome + homepage; the cheapest
   high-impact win, and uncopyable by a subscription business.
10. **R2 + R3 — Phase banner + muscle-recovery gauge** (Juggernaut/Fitbod
    mechanism). Cheap felt-structure and recovery visibility that also feed R1's
    autoregulator.

*Deliberate DIFFERs (recorded so they aren't re-chased as gaps): R6 licensed
exercise-video DB, R10 food-database/barcode calorie counting, R14 social feed,
R18 paid tiers. Each trades away privacy, $0, or scope for value we already reach
another way.*

---

## Cross-team read receipts

Read this sprint: `RND_LAB.md`, `SIM_STUDY.md`, `REDTEAM.md`, `ROADMAP.md`,
`TEAMS.md`.

**With R&D LAB — strong overlap, we corroborate from the market side.**
- Their **New-quality idea 5 (session-RPE fatigue gauge)** and **Deliverable-3
  idea 5 (earned-volume autoregulation)** are the *internal-science* version of
  our **R1** (RP's per-week volume model) and **R7** (fatigue-triggered deload).
  We agree hard and add the competitive proof that this is the mechanism the
  best-in-class app is actually built on. **Two-team finding — should rank top of
  ROADMAP.**
- Their **Deliverable-3 idea 2 (longitudinal calibration ledger)** is our **R12**
  monthly recap; their **idea 3 (substitution graph)** is our **R5** swap and
  **R10/diet-linter** backstop; their **idea 6 (form-cue library)** is why we
  DIFFER on R6. We second all three.
- We DEFER to their **Deliverable-1 golden-intake bench** as the gate: any prompt
  change our nutrition/periodization ideas imply (e.g. asking the model to label
  block phases for R2, or a `?demo=cut` persona R16) must ship behind that bench.
- Agreement on **A1 allergen scan** and **A6 water-weight filler** — safety/quality
  holes we don't duplicate; they're theirs to close.

**With SIMULATION — near-total agreement; we explain WHY the market solved these.**
- Their **F2 (periodization promised but absent from the loop)** is the spine of
  our Theme 1 — RP/Juggernaut/Fitbod exist to close exactly that gap. **F1
  stateful check-in** (shipped Sprint 12) is the precondition for our R8/R11
  weekly loop; we build on it, not around it.
- Their **F4/S10 (no bodyweight-fed loop, no cadence nudge, 100% user-initiated)**
  is our Theme 5 (R11) + Theme 6 (R12/R13). Their **F5/S11/E10 (200-log cap,
  durability)** is our R18 "don't hobble the free tier."
- Their **S1/S3/S5 deload cluster** = our R7. We note (and credit) that the code
  has *already* moved: `deloadInfo` now uses `trainedWeeksSince` + a >14-day
  return exemption (`trainer.html:1306-1312`), so the calendar-vs-training half of
  S1 is partly addressed — the residual is the *aggregate-stall / fatigue-marker*
  trigger, which we and they both still want.
- Their **F7/S9 (no goal off-ramp)** pairs with our R2 phase/duration narrative —
  a plan that names its end should also name what comes after (the prompt's
  `next_paths` exists but the loop never surfaces "you're done, choose a path").

**With RED TEAM — we depend on two of their fixes before shipping growth loops.**
- **RT-6 (share-fragment decompression bomb)** must be capped before we lean on
  the compressed-URL share as a growth loop (our R14 keep-the-share decision).
- **RT-1 (rate-limit XFF bypass)** matters for R17/R8 if any new idea adds an API
  path; anything we propose that calls the model must sit behind a limiter that
  actually holds. We add no new endpoints this sprint (all our P0/P1 ideas are
  client-side), which sidesteps their surface — worth stating as a design
  principle: *prefer deterministic client JS over new server endpoints.*
- We agree their `SAFE`/watch-list items (IDOR, CSRF, session secret) are out of
  our lane; no overlap to chase.

---

## Roundtable questions posted this sprint

Full threads seeded in `ROUNDTABLE.md`. Summary of what we asked:
- **@R&D LAB** — can the golden-intake bench add a *coaching-loop* assertion
  (not just a static-plan check), so R1's volume autoregulation and R8's weekly
  nutrition card are testable? And should R2's block-phase labelling be a prompt
  change (bench-gated) or stay pure client-side?
- **@SIMULATION** — re-run subjects with R1 (weekly ±1–2 set autoregulation) and
  R9 (measured adherence) simulated: does the volume loop keep Marcus in-band
  better than the static plan, and does measured adherence change Priya's
  recalibrations vs by-memory?
- **@RED TEAM** — is opt-in *local* PWA notification scheduling (R13) a new abuse
  surface, and is our "prefer client JS over new endpoints" principle the right
  security posture for these ideas?
- **@PRODUCER** — of R1 / R8 / R9 / R12, which single loop closes first? We argue
  R9 (meal checklist) unlocks both R8 and better check-ins for the least code.
