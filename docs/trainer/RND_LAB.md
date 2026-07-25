# R&D LAB — output quality, system improvement, new ideas

**Charter.** The R&D Lab is The Trainer's standing quality function: it studies what
the app actually generates (plans, nutrition targets, Q&A answers, check-in
recalibrations), finds where the output is weaker than the evidence allows, and
proposes concrete, $0 fixes. It owns the system prompts as the #1 quality lever,
keeps the Groq fallback from being second-class, audits the hardcoded coaching
heuristics against exercise science, and brings genuinely new quality ideas each
sprint. Constraints inherited from MANAGER.md: $0 budget (free tiers only), the
live PC+mobile website is the product, and the privacy promise (nothing leaves the
device without an account) is never weakened.

This document is a study only — no code was changed. Findings cite file:line as of
commit e07fa14.

---

## Findings, ranked by impact on output quality

### 1. The Week-4 check-in never sees the plan the client actually ran

**What's wrong.** The check-in submits only the 13 check-in form fields
(`templates/trainer.html:792-806`); the server forwards them verbatim
(`app.py:575-584`). The saved plan JSON — split, exercise list, per-lift loads,
prior injuries from the original intake, height, DOB — is never attached. The
prompt even institutionalizes the blindness: "fields that were not re-collected
... are set to JSON null — never guessed" (`data/trainer_system.txt:129-134`).
So the "recalibration" is really a fresh plan generated from a weight trend and a
free-text lifts box. The model cannot "keep what is working"
(`trainer_system.txt:127-128`) because it does not know what the client was doing.
The client also loses the original safety context: injuries reported at intake
vanish at check-in unless retyped into the pain box.

**Fix.** Client side: attach a compact digest of the saved plan to the check-in
payload (split_name, per-day exercise names with sets x rep_range and any starting
loads, calorie/macro targets, profile height/DOB/steps, flagged_issues), plus the
existing `qaLogDigest()` (`trainer.html:1478-1495`) which already summarizes the
last 10 sessions and stalls — it is currently used only by Ask-the-Trainer.
Server side: append it under a labelled block, same pattern as the Q&A route
(`app.py:810-813`). Prompt side, add to CHECK-IN MODE (`trainer_system.txt`,
after line 127), exact text:

> When a PREVIOUS PLAN digest is attached, treat it as the program the client
> actually ran: keep its split and exercise selection unless the measured data
> demands a change, carry each exercise's last logged load forward as its new
> starting load, and list every deviation from the previous program explicitly in
> checkin_review.training_changes. Re-apply every flagged issue and injury from
> the previous plan's safety notes without requiring the client to restate them.
> When a TRAINING LOG digest is attached, its numbers outrank the free-text lifts
> field.

**User-visible improvement.** Check-ins become continuous coaching instead of a
plan lottery: same program evolving, real loads carried forward, injuries never
silently forgotten, and the plan diff view (Sprint 3) shows meaningful deltas
instead of a wholesale reshuffle.

### 2. The server-side "validation" accepts almost any plan-shaped object

**What's wrong.** The vaunted validation gate is two checks: the text parses as
JSON and `data.get("type") in ("questions", "plan")` — identical for Gemini
(`app.py:706`) and Groq (`app.py:670`). Everything else slips through: missing
`workout_days`, zero exercises, macros that do not reconcile (protein x4 + carbs
x4 + fat x9 nowhere near the calorie target), a listed allergen in the sample
day, markdown/newlines inside strings (breaks the PDF contract at
`trainer_system.txt:41-45`), `"sets": "3-4"` as a string, a 5-field skeleton from
a token-starved Groq run. The retry machinery exists and is good — it just never
fires on low-quality-but-parseable output.

**Fix.** A pure-Python `_validate_plan(data, intake)` (~60 lines, $0) run before
`q.put(("end", text))` in both paths, treating failure like "unusable output" so
the existing chain retries. Minimum checks, in order of value:
- required top-level keys of Schema B present; `workout_days` non-empty and every
  day has >= 3 exercises each with numeric `sets` and `rest_seconds`;
- macro reconciliation: |p*4 + c*4 + f*9 − calorie_target| <= 3% of target;
- sample_day_totals within 7% of targets (tolerances slightly looser than the
  prompt's own 2%/5% so borderline-honest plans are not rejected);
- no `\n` and no markdown tokens (`**`, `##`, backticks) inside any string;
- allergen scan: no word from the intake's `allergies` field appears in
  `sample_day` foods;
- `type == "questions"` objects: 1-4 questions each with `question` text.
On the final attempt, degrade gracefully: serve the plan but log which checks
failed (a counter, no user content) so the Lab can see failure rates.

**User-visible improvement.** The worst outputs users currently see — skeleton
plans, arithmetic that a calculator refutes, an allergen in the meal plan —
become retries instead of deliveries. This is the single cheapest quality floor
raise available.

### 3. The full prompt contradicts itself on the muscle-gain rate — plan and check-in disagree by design

**What's wrong.** Section 4 says expected gain is "roughly 0.25 to 0.5 percent of
body weight per month for intermediates" (`trainer_system.txt:162-163`) — for an
82 kg client that is 0.2-0.4 kg/month (~0.05-0.1 kg/week). Check-in mode says a
trend of "0.12 to 0.19 kg per week is on target" (`trainer_system.txt:114-115`) —
that is 0.5-0.8 kg/month, roughly double, with no experience scaling. A client
gaining exactly what their plan promised can be told at check-in that they are
under-gaining and get a surplus increase they do not need (fat gain), or
vice-versa. The demo plan quietly sides with the check-in numbers ("0.5 to 0.75
kg of scale weight per month", `trainer_demo.json:23`), contradicting section 4.

**Fix.** Make one table and reference it from both places. Replace
`trainer_system.txt:162-163` expected-gain sentence with:

> Expected scale-weight gain per month: novice 0.6 to 1.0 percent of body weight,
> intermediate 0.4 to 0.6 percent, advanced 0.2 to 0.4 percent. These same bands,
> divided by 4.33, are the on-target weekly trend at check-in.

and replace the check-in band at `trainer_system.txt:114-117` with:

> Muscle gain: compare the measured weekly trend against the expected-gain band
> for the client's experience level (section 4, divided by 4.33 for weeks). Inside
> the band: keep calories, progress volume by 1 to 2 sets per week on one priority
> muscle. Above it with a rising waist: subtract 100 to 200 kcal. Below it for 2
> or more weeks with good adherence: add 100 to 150 kcal.

**User-visible improvement.** The plan's promise and the check-in's verdict stop
disagreeing; surplus adjustments track the right target for the person's level.

### 4. Groq-fallback plans are structurally second-class (see parity section below)

**What's wrong.** The compact prompt (`data/trainer_system_compact.txt`, 96 lines
vs 634) drops whole quality subsystems, and two numbers actively contradict the
full prompt. On top of the prompt gap, Groq gets `max_tokens: 6000` with an
instruction to stay "under about 5000 tokens" (`app.py:655`,
`trainer_system_compact.txt:5`) vs Gemini's 32768 + 8192 thinking budget
(`app.py:604-607`), and no thinking at all — so arithmetic errors are more likely
exactly on the leg with the least oversight, and finding 2's validator is the
only net. Concrete losses for a Groq user (each present in the full prompt,
absent in compact):
- all special populations: 50+/60+ programming, BMI 35+ novices, 16-17 minors,
  women's RED-S floor and iron note, night-shift meal anchoring
  (`trainer_system.txt:420-449`);
- the stall rule (10 percent reset) — yet the UI's Stall Watch card tells every
  user "Your plan's protocol: reduce 10%" (`trainer.html:1065-1068`), attributing
  a protocol a Groq plan never contained;
- the surplus table disagrees: compact says muscle gain "+200 to +400 (novice
  higher)" (`trainer_system_compact.txt:17`), full says novice +300 to +500,
  intermediate +200 to +300, advanced +100 to +200 (`trainer_system.txt:162-163`);
- recovery modulation loses the sub-5.5 h rule and the concrete sleep target;
- quality_vs_quantity has schema slots but zero content guidance (junk-volume
  stance, 0-3 RIR rationale);
- check-in loses the goal-rate bands, water-weight discount, session-adherence
  gate (75 percent), and sleep-first-on-stalls rule;
- caffeine loses the half-life/sleep reasoning (keeps only the cap);
- triage loses the non-trigger list ("do NOT ask about polish"), so Groq is more
  likely to waste the user's one request on questions.

**Fix.** The parity section below rewrites the compact prompt line-for-line; the
whole addition is ~330 tokens, trivially affordable inside Groq's 12k TPM.

**User-visible improvement.** The emergency plan a user gets during a Gemini
outage stops being a visibly dumber coach — same rules, same numbers, terser
prose.

### 5. The demo plan hides the app's best tricks and flunks its own volume rule

**What's wrong.** `data/trainer_demo.json` is genuinely strong — but it is the
first plan most visitors ever see, and it never shows the most differentiating
feature: concrete starting loads from `current_lifts` (Epley-anchored "start
around 57.5 kg" notes, `trainer_system.txt:266-277`). Demo-Rohan reported no
lifts, so every `tempo_or_notes` is generic cueing. It also has no
`checkin_review`, so the check-in feature is invisible pre-signup. And its
`volume_analysis` claims "All muscles sit inside the 10 to 16 set intermediate
band" while listing calves 8, abs 6, and hamstrings 9 direct sets in the same
sentence (`trainer_demo.json:361`) — the flagship sample contradicts the rule it
cites.

**Fix (content edit, no code).** (a) Add to `assumptions` that Rohan reported
bench 70 kg x 8, squat 90 kg x 6, deadlift 110 kg x 5, and put concrete starting
loads in the four main lifts' `tempo_or_notes` (e.g. bench: "Start around 62.5 kg
— about 85 percent of what your reported 70 kg x 8 implies via Epley; week one
should feel like RIR 3."). (b) Rewrite the volume sentence honestly: "Chest,
back, delts, quads and hamstrings sit inside the 10 to 16 set intermediate band
once indirect work is counted; calves (8) and abs (6) are deliberately held below
band because they are secondary to the goal and the time budget." (c) Optionally
ship a second demo (`?demo=cut`) showing a female fat-loss intake — the current
single demo markets to exactly one demographic.

**User-visible improvement.** The showcase plan demonstrates starting loads,
honest volume accounting, and (with the second demo) that the studio handles more
than young men bulking — directly improves first-visit conversion quality.

### 6. Exercise-science gaps in the full prompt

Each item: the gap, then the exact text to add to `data/trainer_system.txt`.

**a. Novices are denied linear progression.** Double progression is prescribed
universally (`trainer_system.txt:279-283`), but a true novice on barbell
compounds progresses fastest adding load every session. Add after line 283:

> True novices (under about 6 months): on the primary barbell compounds, add load
> every session while all prescribed reps are completed at RIR 2 or better — 2.5
> kg upper body, 5 kg lower body per session. Switch that lift to double
> progression after its second stall. Isolation work uses double progression from
> day one.

**b. Deloads have a cadence but no trigger.** Only "every 4 to 8 weeks"
(`trainer_system.txt:285-288`). Add:

> Also trigger an immediate deload, regardless of the calendar, when 2 or more
> lifts stall in the same week despite adequate sleep and food, or when the
> client reports persistently elevated soreness plus falling motivation for 2
> consecutive weeks. Name these triggers in progressive_overload.deload.

**c. Long fat-loss phases get no diet breaks.** Section 4 sets the deficit but
nothing bounds phase length. Add to section 7:

> If the fat-loss phase will exceed 8 weeks, schedule a 1-week diet break at
> estimated maintenance every 6 to 8 weeks, and explain it plainly: the break
> aids adherence and training quality; it is not metabolic magic. Put the break
> weeks in duration_and_paths.review_points.

**d. No fiber or fruit/vegetable floor.** The diet section is macro-complete but
micronutrient-silent. Add to section 7 (hydration paragraph area):

> Fiber: target about 14 g per 1000 kcal (state the gram number). Include 400 to
> 800 g of fruit and vegetables across the sample day; they are part of the plan,
> not garnish.

**e. RIR is prescribed but never taught.** The plan says "RIR 1-2" everywhere but
never defines how a user calibrates it — the single most common novice failure
(stopping 5+ reps short while believing they are near failure). Add to section 5
(effort paragraph, line 249-251):

> In quality_vs_quantity.practical_rules, include one rule teaching RIR
> calibration: about once every 2 weeks, take the LAST set of one isolation
> exercise to technical failure to recalibrate what RIR 1 to 2 actually feels
> like; bar speed slowing sharply on the last rep is the tell.

**f. Warm-up ramps only exist for the first lift.** The warmup field covers
session start, but later heavy compounds (e.g. deadlifts fourth in Lower B,
`trainer_demo.json:275-284`) get no ramp guidance. Add to section 5:

> For any compound loaded above about 80 percent of its first-exercise load that
> appears mid-session, prescribe an abbreviated ramp in tempo_or_notes (one or
> two singles or triples at 60 and 80 percent before the work sets).

**User-visible improvement (a-f).** Faster novice progress, fewer grinding
plateaus before a deload arrives, more sustainable long cuts, plans that teach
the skill (honest RIR) the whole progression model depends on.

### 7. Coach Mode heuristics: mostly defensible, three real gaps

The Sprint-5 heuristics audit (`templates/trainer.html`):
- **Plate math** (1073-1084): correct greedy algorithm, honest closest-load note.
  Defensible. Gap: hardcoded 20 kg bar; home-barbell users often have 15 kg bars.
  A one-tap bar-weight toggle (20/15/10) is a 5-line fix.
- **Epley ramp** (1085-1090): bar x10, 40/60/80 percent — textbook. Gap: shown
  only for exercise index 0 (`trainer.html:1262`), so deadlifts placed fourth get
  no ramp; show it for every `barbellish` exercise.
- **Stall Watch** (1044-1062): the 3-session no-improvement window matches the
  plan's "2 consecutive sessions" rule (3 data points = 2 failed transitions) and
  the 10 percent reset rounds sanely. **False-positive bug:** it compares only the
  single best set. Under double progression a lifter adding reps on sets 2-4 at
  the same top weight is progressing exactly as prescribed, yet gets flagged as
  stalled. Fix: compare (best kg, TOTAL reps across sets at that kg) instead of
  (best kg, best-set reps).
- **Readiness compression** (1099-1120): trimming isolation before compounds and
  protecting compound rest is exactly the plan's philosophy. Gap: the "leave 3
  RIR on everything" adjustment is a banner only — the per-exercise target line
  still renders the plan's original `rpe_or_rir` (`trainer.html:1134`). On a
  rough-recovery day the number in front of the user contradicts the banner.
  Fix: override the displayed RIR to "RIR 3 (today)" when sleepBad or sore.
- **What's missing entirely: deload awareness.** The plan prescribes deload weeks
  (demo: weeks 6 and 12, `trainer_demo.json:343`) and `plan_age_days` is already
  computed (`trainer.html:1493`), but no surface ever announces a deload week and
  Coach Mode will happily run full volume through one. See new idea 3.

### 8. Ask-the-Trainer has no fallback chain

Plan generation earned a 5-leg resilience chain; the Q&A endpoint is one
`gemini-2.5-flash` attempt (`app.py:822-827`) that surfaces "briefly overloaded —
ask again" on any 503. One flash-lite retry (same pattern, ~10 lines) makes the
chat as reliable as the plans. Also worth testing: `thinking_budget=512`
(`app.py:816`) is thin for the arithmetic-quoting answers the system prompt
demands; try 1024 and compare on the eval bench (new idea 1) before shipping.

---

## Compact-prompt parity (make Groq plans first-class)

Current compact prompt: ~1.1k tokens. The additions below total roughly 330
tokens; with the user intake (~300) and 6000 output cap, the request stays far
inside Groq's ~12k TPM. Cuts first, then the exact insertions.

**Cuts (frees ~60 tokens, no quality cost):**
- Line 5 "Total output must stay under about 5000 tokens." → "Stay under 5000
  output tokens." (the cap is enforced by max_tokens anyway).
- Schema block: delete the parenthetical arities "(1-4)", "(all 7)", "(2-3)" only
  where the rule already appears in prose above; keep field names untouched.

**Fix the contradiction (edit in place, line 17):**
- Replace `muscle gain +200 to +400 (novice higher)` with
  `muscle gain: novice +300-500, intermediate +200-300, advanced +100-200`.

**Insert after the TRAINING paragraph (line 32):**

> Stall rule: no load or rep improvement on a lift for 2 consecutive sessions
> with sleep and food in order = reduce that lift 10 percent and rebuild. True
> novices: linear loading on barbell compounds (add 2.5/5 kg per session) until
> the second stall, then double progression. quality_vs_quantity stance: growth
> lives in sets at 0-3 RIR; sets stopped 5+ reps short are junk volume — give 4
> practical rules with numbers.

**Insert as a new paragraph after DIET (line 42):**

> SPECIAL POPULATIONS (compound as needed): age 50+ joint-friendly variants,
> half-size load jumps, protein at top of range; 60+ add light power work
> (fast concentric, well short of failure) and balance/carries. BMI 35+ novices:
> walking is the cardio, machine and seated variants lead, no jumping, protein on
> goal weight, expect fast water-weight loss in weeks 1-2 and say so. Age 16-17:
> technique before load, RIR 2 floor, no failure training, no cutting diets,
> supervision recommended. Female clients on low intake + high activity: warn
> about under-fuelling (RED-S), hold the calorie floor, physician referral if
> cycle changes are mentioned; do not program around the cycle. Night shift:
> anchor all meal timing to wake time, not clock time. Sleep under 5.5 h:
> volume 10-15 percent below the bottom of the band; sleep is intervention one.

**Insert into CHECK-IN MODE (after line 60):**

> On-target weekly trend: muscle gain = experience-level monthly band / 4.33
> (novice 0.6-1.0, intermediate 0.4-0.6, advanced 0.2-0.4 percent of body weight
> per month); fat loss = 0.5-1.0 percent of body weight per week. First 1-2 weeks
> of a new plan are water weight — discount them. Under 75 percent of sessions
> completed = simplify, do not change targets. Lifts stalled but weight on track:
> check sleep first, then the 10 percent reset, then a deload if 6+ weeks since
> the last. List what is working in keep_doing.

**Insert one sentence into SUPPLEMENTS (line 46, after the caffeine entry):**

> caffeine half-life is about 5 h — for evening sessions say sleep outranks any
> pre-workout.

**Also (server, one line):** when the check-in plan digest from finding 1 ships,
send it to Groq too — parity is payload as well as prompt.

---

## New quality ideas (do not exist yet), ranked

1. **Golden-intake eval bench.** `qa/trainer_bench.py`: ~10 fixed synthetic
   intakes covering the special populations and edge cases (58-year-old novice,
   BMI 37 beginner, 17-year-old, vegetarian evening trainer with 5 h sleep,
   night-shift fat loss, home-dumbbells-only, check-in with bad adherence...),
   each run once through the real API and scored by a deterministic rubric
   (validator checks from finding 2 + volume-band tally + session-time budget +
   allergen scan + banned-phrase grep + population-specific assertions, e.g.
   "no jumping" for BMI 37). Run only when the prompt or model chain changes.
   *Feasibility: ~10 Gemini free-tier calls per run, pure-Python scoring — $0;
   this is the tool that makes every other prompt change safe to ship.*
2. **Deterministic plan linter + "numbers verified" badge.** Server recomputes
   BMR, TDEE, macro reconciliation and per-muscle set tallies from the intake and
   the returned plan; plan renders with a small "arithmetic independently
   verified" badge when everything reconciles (and the mismatch is fixed via
   retry when it does not — finding 2's validator is the enforcement half).
   *Feasibility: pure Python + one template badge — $0, and it is a trust feature
   no competitor at this price point has.*
3. **Deload autopilot.** `plan_age_days` already exists client-side; parse the
   plan's deload cadence (or default 6 weeks), show a "Deload week — halve sets,
   -15-20 percent load, resist adding work" card in the Log tab during the
   scheduled week, and have Coach Mode auto-halve sets with the banner.
   *Feasibility: fully deterministic client JS on existing data — $0, no API.*
4. **Bodyweight quick-log + trend-fed check-in.** A one-field daily weight input
   on the Log tab (localStorage, synced like logs); the app computes the 7-day
   average and sparkline, and the check-in autofills "weight now" from measured
   data instead of memory. Extends the roadmap's trend-fed check-in with the
   missing data source.
   *Feasibility: localStorage + existing sync blob + inline SVG sparkline — $0.*
5. **Session-RPE fatigue gauge.** One tap at Coach Mode finish ("easy / as
   planned / brutal"); three "brutal" sessions inside 10 days combined with a
   Stall Watch hit triggers the plan's own early-deload advice (finding 6b makes
   the prompt agree). *Feasibility: one button + ~20 lines of deterministic JS.*
6. **Self-authored form-cue library.** Static JSON of ~40 canonical exercises
   (the names the prompt's movement patterns generate) with 3 technique cues + 2
   common faults each, self-written like the Sprint-4 pictograms; Coach Mode and
   the plan document show them. *Feasibility: content-only, no API, no licensing
   risk — $0; raises perceived coaching quality on every plan regardless of
   model.*
7. **Second demo persona (`?demo=cut`).** A female fat-loss demo plan (finding
   5c) served from a second static JSON, demo-exempt from rate limits like the
   first. *Feasibility: one JSON file + a query-param branch — $0.*

---

## R&D cadence (what this team checks every sprint)

1. **Prompt-change gate:** any edit to `trainer_system.txt`,
   `trainer_system_compact.txt`, or `TRAINER_QA_SYSTEM` runs the golden-intake
   bench (idea 1) before merge; score deltas go in the sprint doc.
2. **Parity audit:** after any full-prompt edit, diff the rule inventory against
   the compact prompt and patch the gap in the same commit — drift is how Groq
   became second-class.
3. **Heuristic-vs-prompt drift check:** grep the UI's hardcoded coaching numbers
   (stall window, 10 percent reset, RIR banners, plate/bar constants, deload
   cadence) against the prompt's current numbers; they must tell the same story.
4. **Demo freshness:** re-read `trainer_demo.json` against the current prompt's
   self-check list (section 11) — the showcase must pass the same bar as live
   output.
5. **One special-population probe:** each sprint, one real-API plan for a
   rotating edge persona, eyeballed against the population rules (one call,
   within the "one targeted request, not loops" quota rule).
6. **Failure-rate glance:** review the validator's failure counters (finding 2)
   for which checks fire and on which leg (Gemini vs Groq); rising Groq failures
   mean the compact prompt or token cap needs another pass.
7. **Idea intake:** close each sprint by adding at least one new $0 quality idea
   to this file's ranked list, and promote the top unbuilt one to ROADMAP.md when
   it beats what is queued.

---

## Sprint 15 study

Second study. Three of the first study's findings shipped (Sprints 12–14:
stateful check-in, `_validate_plan`, muscle-gain-rate reconciliation + Groq
parity, deload autopilot / e1RM stall watch / Coach cues, data isolation). This
study re-reads the surfaces those sprints created, finds where they still misfire,
and specs the tool that makes every future prompt change safe. Study only, no code
changed. Findings cite file:line as of commit 37ec26d. Constraints unchanged:
$0 (free tiers), the live PC+mobile site is the product, the privacy promise holds.

---

### Deliverable 1 — The golden-intake eval bench (drop-in-ready spec)

**Purpose.** Today a prompt edit ships on the strength of one hand-eyeballed live
plan (R&D cadence item 5). The bench turns that into a deterministic, repeatable
score across ~10 fixed populations, so any change to `trainer_system.txt`,
`trainer_system_compact.txt`, `TRAINER_QA_SYSTEM`, the model chain, or
`_validate_plan` is gated by a number, not a vibe. It is the enabling tool for
every other idea in this file — nothing else here is safe to ship without it.

#### File layout

```
qa/
  trainer_bench.py          # runner + rubric + assertion registry (~300 lines, stdlib only)
  bench_intakes.json        # the 10 fixed intakes + their assertions (below)
  bench_fixtures/           # captured plan JSON, one per intake id (checked in)
    bmi37_novice_cut.json
    ...
  bench_report.json         # machine output (written each run)
```

`trainer_bench.py` imports the real gate so the bench and production can never
drift: `from app import _validate_plan, _plan_strings`. Two small static tables
live inside the runner (no new dependency, no data file):
- `EXERCISE_MUSCLE` — ~40 canonical movement names (the ones the prompt's movement
  patterns actually generate; reuse the form-cue library list from idea 6 of the
  first study) → `{primary: [...], secondary: [...]}`. An unmapped exercise name
  logs `unmapped_exercise` (a warning, never a failure) and is added to the map in
  the same PR — the map is grown, not guessed.
- `BANNED_PHRASES` — `["eat healthy", "listen to your body", "stay consistent",
  "train hard", "be consistent", "trust the process"]` (from `trainer_system.txt`
  TONE, 476-478), plus the markdown/emoji scan already in `_validate_plan`.

#### How it runs

**Offline (default — `python qa/trainer_bench.py`, $0, no key, CI-safe).** Scores
two plan sources against the full rubric: (a) `data/trainer_demo.json` (as
demo-Rohan's intake), and (b) every `qa/bench_fixtures/*.json` captured on a prior
live run and checked in. This is the regression net for the *rubric code itself*
and for the demo and last-known-good live plans; it never touches the network.
Exits nonzero if the demo or any fixture regresses. Wire it into
`.github/workflows/ci.yml` right after `pytest` (one line: `python qa/trainer_bench.py`).

**Live (`BENCH_LIVE=1 python qa/trainer_bench.py --server http://127.0.0.1:5057`).**
For each of the 10 intakes, POST once to a running server's `/api/trainer`
(so the whole production path runs — full/compact prompt, retry chain,
`_validate_plan`, soft-serve). ≤10 calls total, one per intake, no loops — well
inside the Gemini free tier. On a `type:"questions"` response, re-POST once with
that intake's canned `followup_answers` (each intake ships them) so triage resolves
to a plan. Each returned plan is written to `qa/bench_fixtures/<id>.json` (so it
becomes next run's offline fixture) and scored. The live path is gated behind the
env flag so CI never spends the key; the R&D "prompt-change gate" (cadence item 1)
runs it locally before merge and pastes the score delta into the sprint doc.

#### The deterministic rubric (pure Python, per plan)

Every check returns `(name, pass: bool, detail: str)`. Score = checks passed / run.

| Check | What it does |
|---|---|
| `structural` | `_validate_plan(plan, intake) == []` — reuses the shipped gate verbatim (shape, macro math ±3%, sample-day ±7%, markdown/newline, sample-day allergen). |
| `volume_band` | Tally direct hard sets per muscle from `workout_days` via `EXERCISE_MUSCLE` (primary = full set count, secondary = 0.5); assert every **primary** muscle sits inside the intake's `meta.band` (novice 8–12, intermediate 10–16, advanced 14–20). Secondary muscles may sit below band. Emits the per-muscle tally in `detail`. |
| `session_time` | Per day: `8 + 4.5*compound_sets + 2.5*isolation_sets` minutes (the prompt's own upper bounds, 226-227; compound = `rest_seconds >= 105`) must be ≤ `hours per session`×60 × 1.15 tolerance. |
| `allergen_scan` | Word-boundary regex `\b(word)s?\b` for each intake allergen over **all** plan strings (`_plan_strings(plan)`), not just `sample_day`. Floor len ≥ 3 so egg/soy/nut/fish are caught (see Audit finding 1). |
| `banned_phrase` | Grep every plan string for `BANNED_PHRASES` and for emoji / markdown / `\n`. A banned phrase passes only if a digit or unit appears within 40 chars (a numbered rule is allowed). |
| `population` | Runs each assertion in the intake's `assertions[]` through the registry below. Each assertion is one row in the score. |

#### Population-assertion registry (each a pure `(plan, intake, arg) -> (bool, detail)`)

- `no_exercise_matching:<regex>` — no exercise name (incl. warm-ups & substitutions) matches.
- `some_exercise_matching:<regex>` — at least one exercise matches.
- `protein_on_goal_weight` — `protein_g / meta.goal_weight_kg` in 1.6–2.4, **and** `protein_g` is below what current bodyweight×2.4 would give (proves goal-, not scale-weight anchoring; the BMI≥30 rule).
- `no_calorie_deficit` — `calorie_target_kcal >= 0.98 × maintenance_est` (maintenance from the plan's own `profile_summary` if present, else Mifflin×activity). For minors and RED-S floors.
- `calorie_floor:<kcal>` — `calorie_target_kcal >= arg`.
- `rir_no_failure` — no `rpe_or_rir`/notes string contains `RIR 0`, `RIR 1`, `to failure`, `AMRAP`, `1RM` (minors: RIR-2 floor).
- `string_present:<regex>` — regex found in any plan string (water-weight caveat, RED-S/under-fuel, physician/clearance, "not medical advice", supervision, "simplify"/"not the problem yet").
- `frequency_min:<N>` — every primary muscle trained ≥ N distinct days/week (no bro split).
- `starting_loads_present` — for each lift named in intake `current lifts`, the matching exercise's `tempo_or_notes` contains a kg number.
- `meals_anchored_to_wake` — sample-day meal-timing strings reference wake time (`\bwake|after waking|on rising`), not clock time (night shift).
- `equipment_denied:<regex>` — no exercise name matches the banned-equipment regex (home-dumbbell plan must not contain `machine|cable|smith|leg press|lat pulldown|hack squat`).
- `checkin_review_present` — check-in intakes: `plan["checkin_review"]` exists and is the first key emitted (best-effort: the fixture is captured as raw text, so assert it appears before `"workout_days"` in the byte stream).
- `targets_unchanged_vs_prev:<pct>` — check-in: `|new_kcal − prev_kcal| <= pct% × prev_kcal` (the adherence gate: don't move targets when adherence is low).

#### The 10 fixed intakes (`qa/bench_intakes.json`)

Real intake keys (human-readable, exactly as `intake()` emits them at
`trainer.html:828-844`). `meta` and `assertions` are bench-only, never sent to the
model. Abbreviated below; ship the full field set (all 23 keys) per intake.

1. **`bmi37_novice_cut`** — BMI 37 beginner, fat loss.
   `{"gender assigned at birth":"female","date of birth":"1991-04-02","height":"165 cm","weight":"101 kg","training experience":"brand new, never lifted","goal":"lose fat","days per week":"3","hours per session":"1","training environment":"commercial gym","sleep hours per night":"6","stress level":"moderate"}`
   `meta:{band:"novice", goal_weight_kg:70}`.
   Assertions: `no_exercise_matching:jump|plyo|box jump|run|sprint|skater|bound|burpee`; `some_exercise_matching:machine|seated|leg press|chest[- ]supported`; `protein_on_goal_weight`; `string_present:water.*(week|first two)`; `frequency_min:2`.

2. **`novice_58m_gain`** — 58 y/o male novice, muscle gain.
   `weight 78 kg, height 175 cm, experience "beginner", goal "build muscle", days 3, hours 1.25`. `meta:{band:"novice", goal_weight_kg:78}`.
   Assertions: `some_exercise_matching:trap bar|machine|dumbbell`; `no_exercise_matching:jump|plyo|max.*deadlift`; `string_present:physician|clearance`; `protein_on_goal_weight`.

3. **`minor_17_gain`** — 17 y/o (DOB makes age 17 vs current_date), muscle gain.
   `weight 62 kg, height 172 cm, experience "about 1 year", goal "build muscle", days 4`. `meta:{band:"intermediate"}`.
   Assertions: `rir_no_failure`; `no_calorie_deficit`; `string_present:supervis`; `structural`.

4. **`vegetarian_evening_lowsleep`** — vegetarian, trains 8–9 pm, 5 h sleep, high stress, muscle gain.
   `weight 70 kg, "diet preference":"vegetarian", "gym timings":"8 to 9 pm", "sleep hours per night":"5", "stress level":"high", days 4`. `meta:{band:"intermediate"}`.
   Assertions: `no_exercise_matching:...` (n/a); `string_present:(chicken|beef|pork|salmon|tuna|shrimp|fish)` **must be false** → encode as `no_exercise_matching` variant `no_string:` (add to registry) OR reuse `allergen_scan` seeded from diet; `string_present:sleep.*(first|intervention|priority)`; volume at/below bottom of band → assert `volume_band` with band tightened to `novice`-floor (sleep <5.5 → 10–15% below bottom); `string_present:caffeine`.

5. **`nightshift_cut`** — night-shift nurse, fat loss.
   `weight 88 kg, "gym timings":"3 am after shift", "extra info":"night shift nurse, sleeps 9am–4pm", goal "lose fat", days 4`. `meta:{band:"intermediate"}`.
   Assertions: `meals_anchored_to_wake`; `no_calorie_deficit` **inverted** (deficit expected) → assert `calorie_floor` only + trust structural for the arithmetic; `structural`.

6. **`home_db_only_gain`** — home, adjustable dumbbells ≤30 kg, no bench, intermediate.
   `"training environment":"home","equipment notes":"adjustable dumbbells up to 30 kg, no bench, no rack", experience "2 years", goal "build muscle", days 4`. `meta:{band:"intermediate"}`.
   Assertions: `equipment_denied:machine|cable|smith|leg press|lat pulldown|hack squat|barbell`; `some_exercise_matching:dumbbell|goblet|floor press`; `frequency_min:2`.

7. **`female_reds_floor`** — female, low intake + high activity, wants more fat loss.
   `weight 55 kg, height 168 cm (BMI ~19.5), "extra info":"currently eating ~1200 kcal, 15,000 steps daily, lifting 5x", goal "lose more fat"`. `meta:{band:"intermediate"}`.
   Assertions: `string_present:RED-?S|under-?fuel|energy availability`; `calorie_floor:1400`; `string_present:ferritin|iron`; `no_calorie_deficit` (hold the floor).

8. **`knee_acl_strength`** — prior ACL recon, occasional patellar pain, strength.
   `weight 82 kg, "injury history":"left ACL reconstruction 2019, occasional patellar pain on deep knee flexion", goal "get stronger"`. `meta:{band:"intermediate", goal_weight_kg:82}`.
   Assertions: `no_exercise_matching:jump|plyo|deep lunge|sprint|pistol`; `string_present:not medical advice|outside (my|our)`; `string_present:(hip|posterior|hamstring|glute)`; `structural`.

9. **`current_lifts_hypertrophy`** — lifts provided, intermediate, 5 days.
   `"current lifts":"bench 80 kg x 5, back squat 120 kg x 5, deadlift 150 kg x 3", experience "2 years", goal "build muscle", days 5`. `meta:{band:"intermediate"}`.
   Assertions: `starting_loads_present`; `frequency_min:2`; `session_time`; `volume_band`.

10. **`checkin_low_adherence`** — check-in, bad adherence.
    `mode:"checkin"`, intake goal "build muscle"; check-in data via intake keys: `"diet adherence":"about 50%","sessions completed per week":"2 of 4","weight then":"82 kg","weight now":"82.3 kg","weeks":"4"`; attach `prev_plan` (a planDigest of the demo) and `log_digest` (a qaLogDigest with 2 sparse sessions).
    Assertions: `checkin_review_present`; `targets_unchanged_vs_prev:4`; `string_present:simplif|not the problem yet|reduce friction`; `structural`.

(An optional 11th, `allergen_stress`: allergies "peanuts, shellfish, eggs", goal
muscle gain — sole job is to exercise `allergen_scan` across swaps/snacks/supplements,
i.e. the whole plan, catching the short-allergen miss from Audit finding 1.)

#### Scoreboard output

`qa/bench_report.json`:
```json
{ "generated":"2026-07-24T…","mode":"offline|live","model_chain":["gemini-2.5-flash",…],
  "intakes":[
    {"id":"bmi37_novice_cut","plan_source":"fixture|live","score":8,"max":9,"pass":false,
     "checks":[
       {"name":"structural","pass":true,"detail":""},
       {"name":"volume_band","pass":true,"detail":"chest 11, back 12, quads 10, hams 8(sec)"},
       {"name":"pop:no_exercise_matching","pass":false,"detail":"matched 'Box jump 3x10'"}]}],
  "totals":{"intakes":10,"passed":8,"checks_run":74,"checks_passed":71} }
```
Plus a stdout table — one row per intake (`id  8/9  ✗ pop:no_jumping`) and a totals
line. Nonzero exit if any intake falls below its bar (default: all checks pass; an
optional per-intake `min_score` allows a known soft failure to be tolerated with a
tracked reason). Producer implements in one sprint: `bench_intakes.json` + the
registry + the two static tables + the runner, no further design needed.

---

### Deliverable 2 — Quality audit of the surfaces shipped since the first study

Ranked by impact. Each ships the exact fix.

#### A1 — The validator's allergen scan misses the most common allergens and only reads the sample day  *(safety, highest)*

`app.py:683-690`. Two defects in the shipped gate:
1. `words = [w.rstrip("s") for w in … if len(w) >= 4 …]` — the `len ≥ 4` floor
   silently drops **egg(s)→egg(3), soy(3), nut(s)→nut(3), fish(4 but…)**. The four
   most common food allergens after peanut are exactly the short ones, and they are
   never checked. A client who typed `eggs` gets no allergen enforcement at all.
2. `hay = json.dumps(dp["sample_day"])` — only the sample day is scanned. An
   allergen in `diet_plan.food_swaps`, a snack note, the supplement rationale, or a
   meal-timing string sails through, even though the prompt's own self-check (rule 6,
   `trainer_system.txt:642`) promises "no listed allergen appears **anywhere**."

**Fix** (`app.py`, replace 685-690):
```python
words = [w for w in re.split(r"[^a-z]+", alg)
         if len(w) >= 3 and w not in ("none","nothing","known","food","mild","severe","and","any")]
if words and isinstance(dp, dict):
    hay = " ".join(_plan_strings(dp)).lower()
    if any(re.search(r"\b" + re.escape(w) + r"s?\b", hay) for w in words):
        fails.append("allergen_in_diet")
```
The word-boundary match (`\bnut s?\b`) lets the floor drop to 3 safely — it no
longer false-hits `coconut`/`minute` — and scanning `_plan_strings(dp)` covers the
whole diet block. Ship with a bench fixture (`allergen_stress`) that would fail today.

#### A2 — Deload sessions poison the stall watch and the progression cue  *(false coaching, high)*

Coach Mode already knows a session is a deload (`CO.deload`, `trainer.html:1180`)
but `coFinish()` saves the log entry with no marker (`trainer.html:1315`:
`logs.unshift({ at, day, entries })`). A deload week is *designed* to lower e1RM
(halved sets, −15–20% load). So the very next `stallWatch()` (`trainer.html:1083`)
reads the deload session as a non-improvement and can false-flag a stall the week
after a planned backoff — and `coProgressCue()` (`trainer.html:1211`) reads the
deloaded reps and, if they hit top-of-range at the light load, tells the user
"add 2.5 kg today and rebuild" off a weight that was deliberately reduced.

**Fix** (three edits, all deterministic, $0):
- `trainer.html:1315` — `logs.unshift({ at:Date.now(), day:CO.day.day_label||'', entries, deload:CO.deload });`
  and the manual logger `trainer.html:1072` — `logs.unshift({ at, day, entries, deload:!!deloadInfo() });`
- `stallWatch()` `trainer.html:1084` — skip deload sessions:
  `const logs = loadLogs().filter(s => !s.deload).slice().sort(…);`
- `coProgressCue()` / `lastSetsFor()` `trainer.html:1201-1207` — skip deload sessions
  when reading "last time": `for (const s of logs) { if (s.deload) continue; … }`.
- `qaLogDigest()` `trainer.html:1685` inherits the fix through `stallWatch()`; also
  drop deload sessions from `sessions` so the check-in model isn't shown a backoff
  week as if it were a work week.

#### A3 — Deload autopilot fires on calendar time, not accumulated training  *(misfire, high)*

`trainer.html:1135`: `sinceW = floor((Date.now() − max(sp.at, doneAt)) / 604800000)`.
This is wall-clock weeks since the plan was saved (or last deload), regardless of
whether the client trained. A user who saved a plan, traveled two weeks, then
trained four, is shown a deload card at "6 weeks" on four weeks of real fatigue.
A deload answers accumulated stress; calendar weeks with no logged sessions are not
stress. The logs to fix this are already in hand (`loadLogs()`).

**Fix** (`trainer.html:1125-1136`): count distinct ISO-weeks that contain ≥1 logged
session since the anchor, and require the client to have actually trained:
```js
const anchor = Math.max(sp.at, doneAt);
const trainedWeeks = new Set(
  loadLogs().filter(s => s.at >= anchor && !s.deload)
            .map(s => Math.floor(s.at / 604800000))).size;
return trainedWeeks >= cadence ? { cadence, sinceW: trainedWeeks } : null;
```
Keep a fallback: if the client logs nothing (Coach-Mode-only or non-loggers), fall
back to the calendar count so the feature still triggers — `const weeks =
trainedWeeks || calendarWeeks;`. This makes the card mean "you've done N hard
weeks," which is what the copy already claims.

#### A4 — Deload cadence parse grabs the earliest end of any range  *(misfire, medium)*

`trainer.html:1131-1132`: the regex `every (\d+) … weeks` captures **only the first
number**, so a plan that says "deload every 4 to 8 weeks" yields `cadence = 4` —
the *advanced* end — for everyone, firing the card up to 4 weeks early and
contradicting the prompt's "novices toward 8, advanced toward 4–6"
(`trainer_system.txt:304-306`). The plan writes the range low-first; the parser
should read the range, not its floor.

**Fix** (`trainer.html:1131-1132`): capture both bounds and take the upper (or the
rounded midpoint), still clamped 4–8:
```js
const m = String(txt).match(/every\s+(\d+)\s*(?:to|-|–|or)\s*(\d+)?\s*weeks?/i);
const lo = m && +m[1], hi = m && (+m[2] || +m[1]);
const cadence = Math.min(8, Math.max(4, hi || 6));
```

#### A5 — The progression cue advises a load jump off a single logged set  *(over-eager, medium)*

`trainer.html:1217-1221`: `counted = prev.filter(has-reps)`; `allTop =
counted.every(reps >= top)`. If the client logged only one set last time (quit
early, or logged a single top set), `counted.length === 1`, and one set at the top
of the range triggers "add 2.5/5 kg today." Double progression earns a load jump
only when the *prescribed* set count all cleared the top — one set is noise.

**Fix** (`trainer.html:1218`, after building `counted`): require at least two
counted sets, and ideally the majority of the prescribed sets:
```js
if (counted.length < 2) return coBeatCue(counted);   // "beat a rep", never "add load"
```
(`coBeatCue` = the existing else-branch, factored out.)

#### A6 — Check-in water-weight discount is unnumbered filler that violates the prompt's own rule  *(prompt, medium)*

`trainer_system.txt:108-109`: "First 1 to 2 weeks of a new plan shift water weight;
if the window includes them, discount **accordingly** and say so." The prompt's own
TONE rule bans exactly this: "Every prescription gets a number" (`:476-478`).
"Discount accordingly" at the single most trend-distorting moment gives the model no
method, so it improvises inconsistently.

**Fix** (`trainer_system.txt:108-109`, replace the sentence):
> If the measured window includes the first 1 to 2 weeks of a new plan, the first
> 0.5 to 1.5 kg of change is water and glycogen, not tissue: subtract it before
> dividing by weeks, or compute the trend from week 2 onward if you have enough
> data, and state which you did in checkin_review.measured_trend.

Mirror one clause into the compact prompt's check-in block (parity cadence item 2).

#### A7 — The check-in never tells the model when the last deload was, then asks it to reason about it  *(prompt+payload, medium)*

`trainer_system.txt:126`: "consider a deload if 6 or more weeks since the last one" —
but nothing in the check-in payload carries the deload clock. Sprint 13 stored it
client-side (`DL_KEY`, `trainer.html:1124`) and `deloadInfo()` knows if one is due,
yet `qaLogDigest()` (`trainer.html:1671-1688`) sends only `sessions`, `stalls`,
`plan_age_days`. The model guesses a fact the app already knows.

**Fix** (`trainer.html:1683-1687`, add to the returned object):
```js
last_deload_days_ago: (()=>{ let d=0; try{d=+localStorage.getItem(DL_KEY)||0;}catch(e){}
  return d ? Math.round((Date.now()-d)/86400000) : null; })(),
deload_due: !!deloadInfo(),
```
and one CHECK-IN MODE sentence (`trainer_system.txt`, after 126):
> When the training-log digest reports deload_due true or last_deload_days_ago
> above about 45, schedule the deload explicitly in progressive_overload.deload and
> say why in checkin_review.training_changes; when it was recent, do not.

**Lower-priority notes (log, don't necessarily ship this sprint):** the check-in
still has no measured 7-day-average weight source, so the trend rides two spot
weights (`trainer_system.txt:93-94`; the fix is idea "bodyweight quick-log", already
on the roadmap). And `coProgressCue`'s `rep_range` parse (`trainer.html:1215`)
silently returns nothing for ranges ending in a word ("12–15 per leg") — a missed
cue, not a wrong one; widen the regex to `(\d+)\s*(?:reps?|per|each|\/)?\s*$`.

---

### Deliverable 3 — New, bolder quality ideas (beyond the first list), ranked

1. **Cross-model numeric consensus badge.** For the arithmetic-critical fields only
   (BMR, TDEE, macro reconciliation, per-muscle set tally), fire the *already-present*
   Groq leg as a tiny compute-only second opinion — a ~200-token "here are the
   client's stats and the plan's numbers; recompute and return JSON" prompt, not a
   whole plan — and render a "two independent models agree on the numbers" badge when
   they reconcile within 5%, or trigger a retry/flag when they diverge. No trainer at
   $0 shows model-vs-model agreement on its math.
   *Feasibility: one short Groq call (free 12k TPM already provisioned) + pure-Python
   compare + one badge — $0.*
2. **Longitudinal calibration ledger ("the studio grades itself").** The plan states
   a predicted rate (e.g. "0.6–1.0%/mo"); bodyweight logs give the measured rate.
   Store predicted-vs-actual per plan (localStorage, synced) and surface "our last
   call landed within X% of measured" — a self-auditing accuracy score that compounds
   into a moat over months. Directly measures the thing the whole product claims.
   *Feasibility: arithmetic + localStorage + one inline line — $0, no API.*
3. **Deterministic exercise-substitution graph.** Static JSON mapping each canonical
   movement → equipment-conditioned substitutes + contraindication tags (knee /
   shoulder / low-back / no-jumping). Powers three things with zero API: instant safe
   swaps when a check-in or a Coach-Mode "this hurts" tap reports a new issue; the
   client validator's fix-in-place (idea 7); and a structured injury→swap already
   applied in the check-in payload.
   *Feasibility: content graph (self-authored, CC0) + client lookup — $0.*
4. **Live-canary bench diff (model-drift alarm).** Once the bench (Deliverable 1)
   exists, run its 10 intakes weekly against the **live** endpoint via a scheduled
   GH Action and alert on score regressions — catches Google silently changing a
   flash model's behavior under a frozen prompt, which no static test can see.
   *Feasibility: reuses the bench + one cron workflow + the free-tier key — $0.*
5. **Readiness-adjusted "earned volume" autoregulation with an audit trail.** Extend
   Coach Mode's readiness compression into a rolling weekly fatigue score fed by a
   one-tap session-RPE (easy/as-planned/brutal); nudge next week's set targets up or
   down **within the plan's band**, deterministic and plan-bounded, and log it so the
   check-in can show "you autoregulated down two weeks running → a real recovery
   deficit, not laziness." Turns readiness from a per-session banner into a tracked
   trend the recalibration can act on.
   *Feasibility: one button + rolling score + band-clamped set math — $0.*
6. **Defense-in-depth client diet linter.** Deterministic client-side scan of the
   rendered `sample_day` against the intake's allergies + diet preference; anything
   the server validator missed is flagged inline with a one-tap swap from the
   substitution graph (idea 3). Backstops Audit finding A1 in the browser.
   *Feasibility: client scan + the graph — $0.*
7. **Evidence-provenance tags.** Each landmark prescription (volume band, protein
   g/kg, deficit rate, deload cadence) carries a short self-authored citation tag
   ("10+ sets/muscle/wk — Schoenfeld 2017 meta") appended deterministically by
   matching the plan's numbers to a curated `evidence_map.json`. Shows receipts no
   $0 competitor shows; also doubles as a drift check (a number with no matching tag
   is a number outside the evidence base).
   *Feasibility: static JSON + template append — $0.*

---

### Top 5 to act on (across all three deliverables)

1. **Ship the golden-intake bench (Deliverable 1)** — the gate that makes every
   other change on this list safe; nothing else should merge a prompt edit without it.
2. **Audit A1 — allergen scan** — a safety hole (egg/soy/nut/fish never enforced,
   only the sample day scanned); ~6-line fix, ship a failing bench fixture with it.
3. **Audit A2 — stop deload sessions poisoning the stall watch and progression cue**
   — the shipped Sprint-13 features actively mis-coach the week after a deload; three
   small deterministic edits.
4. **Audit A3 — deload on trained weeks, not calendar weeks** — the autopilot
   currently prescribes recovery for fatigue that wasn't accumulated.
5. **Idea 1 — cross-model numeric consensus badge** — turns the free Groq leg we
   already pay nothing for into a second opinion on the plan's math, a trust feature
   uniquely cheap for us to own.
