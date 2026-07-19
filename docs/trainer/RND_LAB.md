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
