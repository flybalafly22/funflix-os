# SIM_STUDY — a 12-month desk simulation of three Trainer clients

**Team:** SIMULATION · **Date:** July 2026 · **Status:** complete, findings ranked below

## Method (and its honest limits)

This is a **desk simulation, not a user study**. No paid API calls were made; no real
humans trained. We simulated what the app *would* do by executing its actual rules:

- **The coaching brain:** `data/trainer_system.txt` — BMR/TDEE math (Mifflin-St Jeor +
  step-based activity factor), calorie targets by goal, volume landmarks, double
  progression, the stall rule, and the WEEK-4 CHECK-IN recalibration rules
  (measured-trend TDEE, 7700 kcal/kg arithmetic, adherence gates at <70% diet /
  <75% sessions).
- **The canonical output:** `data/trainer_demo.json` (used to calibrate what a
  well-formed plan looks like numerically).
- **The server:** `/api/trainer` in `app.py` (lines 544–755) — what is actually sent to
  the model in plan mode vs check-in mode, validation, retries.
- **The client coach:** `templates/trainer.html` — Coach Mode readiness adjustments
  (`coAdjust`, line 1099), plate math and ramps (lines 1073–1092), stall watch
  (`stallWatch`, line 1044: 3 logged sessions with no kg/rep improvement → suggest 10%
  load reset), session logging, check-in autofill (`autofillCheckin`, line 1266).

Where the app's output depends on the LLM, we assumed the model **follows its system
prompt correctly** — a deliberately generous assumption, so every failure below is a
*design* failure, not a model-quality failure. Real deployments would add model
variance on top.

Physiology was simulated against textbook expectations: fat loss 0.5–1.0 %BW/week
early then slowing (adaptive thermogenesis, smaller body), ~1 kg water drop in week 1
of a deficit, glycogen/water rebound after diet breaks, novice strength +40–70%/year,
intermediate e1RM +10–15%/year, muscle gain ~0.25–0.4%BW/month intermediate,
detrained-returner "muscle memory" recomp. Adherence follows the evidence on decay:
high for 4–6 weeks, dipping at months 3–4, holidays, illness, travel.

Every simulated app action was cross-checked against the code paths above. Key lift
strength is tracked as **Epley e1RM** (load × (1 + reps/30)) — the same formula the
system prompt uses for starting loads (the app itself never computes e1RM from logs;
that gap is Finding 3).

---

## Subject A — "Priya", beginner, fat loss, desk job

**Profile:** 29F · 165 cm · 78.0 kg (BMI 28.7) · goal: fat loss · beginner (<1 yr) ·
commercial gym · 3 days/wk, 1 h · desk job, 4,500 steps/day · sleep 7–8 h · moderate
stress · non-veg · 3 meals/day · no injuries or allergies.

**What the app's rules produce at intake:** BMR (MSJ female) = 10×78 + 6.25×165 −
5×29 − 161 = **1,505 kcal**. Activity factor 1.3 (steps <5,000) + 3×0.025 = **1.375**
→ TDEE ≈ **2,070**. Fat loss −450 → **1,620 kcal**, protein ~150 g (upper range in a
deficit). Full body ×3, novice volume (8–10 sets/muscle), compounds 5–10 reps at 2–3
RIR, steps +3,000 → **7,500/day**, 2×25 min zone-2.

### Month by month

| Mo | Weight (kg, 7-d avg) | Key lifts (e1RM est.) | Adherence (sess/diet) | App actions & events |
|----|------|------|------|------|
| 1 | 78.0 → 75.4 | Goblet squat 14 kg, leg press 72, DB bench 2×9 kg | 95% / 90% | Plan built. Wk-4 check-in #1: −0.65 kg/wk (0.85%/wk) = in band; water discounted per prompt; **keep calories**. Correct. |
| 2 | 73.6 | Leg press 85, goblet 18 | 85% / 85% | Nothing — no logging reminder, no check-in nudge. Silent stretch. |
| 3 | 72.0 | Leg press 95, DB bench 2×11 | 85% / 80% | Check-in #2 (actual gap 7 wks; form forces "6" or "8"). Trend 0.55%/wk in band → keep. Fine. |
| 4 | 71.6 | flat | 50% / 60% | Work crunch + motivation dip. Check-in #3: **adherence gate fires** — app refuses to cut calories, simplifies to 3×45 min, same targets. Textbook-correct; a real coach would do the same. **Helped.** |
| 5 | 70.2 | Leg press 102 | 80% / 80% | Rebound. No touchpoint. |
| 6 | 69.3 | DB row stuck 3 sessions | 80% / 80% | Check-in #4: loss slowed, good adherence, calories already low (TDEE now ~1,900; BMR ~1,460) → app prefers **steps to 9,500** over a cut. Correct per prompt. Stall watch fires on DB row: "reduce 10% — if sleep and food are in order." **Food is deliberately not in order (she's in a deficit)** — expected deficit stall treated as a loading error. |
| 7 | 70.1 (+0.8) | — | 70% / 65% | 2-week vacation; regain is glycogen/water. Check-in #5: trend reads +0.2 kg/wk; the prompt only discounts water in "the first 1–2 weeks of a new plan," not post-travel rebound → **model cuts −150 → 1,470 kcal off a fake trend.** A real coach says "hold, it's water, washout in 10 days." **Failed.** |
| 8 | 68.0 | Leg press 108 | 85% / 85% | Washout confirms the cut was unnecessary; she's now unnecessarily hungry. |
| 9 | 67.0 | — | 85% / 85% | No touchpoint. |
| 10 | 66.2 | Goblet 24 kg, DB bench 2×15 | 85% / 80% | Check-in #6: on target; app holds the calorie floor near BMR and adds steps — the "never below BMR" guardrail works. **Helped.** |
| 11 | 65.6 | — | 75% / 75% | **Goal effectively reached (BMI 24.1). App is structurally silent** — no "transition to maintenance / reverse diet" trigger exists; check-in mode keeps optimizing the original goal. |
| 12 | 65.2 | ~+50% on all lifts vs intake | 70% / 70% | She coasts, still nominally "cutting" at 1,470 kcal after 12 months. A real coach would have moved her to maintenance + strength focus around month 10. |

**Year narrative.** Net −12.8 kg (−16.4%), lifts up ~50% — a genuinely good outcome,
and the app's core math deserves credit: the deficit was sized right, the adherence
gate at month 4 prevented the classic "cut harder when life gets hard" spiral, and the
BMR floor + steps-first logic at months 6/10 is exactly what evidence-based coaching
prescribes. The failures were all *situational awareness*: the vacation-window misread
(month 7), stall advice blind to the deficit (month 6), months of total silence
between user-initiated check-ins, and no off-ramp at goal weight. Also: the app told
her to track a 7-day weight average from day one and **gave her nowhere to record it**
— she kept weights in a notes app and typed two numbers into each check-in.

**Touchpoints:** 6 check-ins, ~115 logged sessions, 8 Ask-the-Trainer questions.
Moments a real coach would have intervened but the app stayed silent: weeks 6–10
(no contact), post-vacation week (proactive "expect water regain" message), month 10
onward (maintenance conversation, RED-S check given a year at ~1,500 kcal).

---

## Subject B — "Marcus", intermediate, hypertrophy/strength, home barbell

**Profile:** 34M · 181 cm · 84.0 kg · goal: muscle + strength · intermediate (3 yrs) ·
**home barbell setup** (rack, bench, bar, plates to 140 kg, no cables/machines, no
dumbbells) · 4 days/wk, 1.25 h · 7,000 steps · sleep 6–6.5 h (two young kids) ·
moderate stress · current lifts: squat 120×5, bench 90×5, deadlift 150×3, OHP 55×5.

**Intake e1RMs (Epley):** SQ **140**, BP **105**, DL **165**, OHP **64**.

**What the app's rules produce:** BMR 1,806 → AF 1.5 → TDEE ≈ 2,710 → intermediate
surplus +250 → **2,960 kcal**, protein 170 g. Upper/lower ×2, 10–16 sets/muscle — but
**sleep <6.5 h → volume starts at the bottom of the band** with the "sleep is the
cheapest performance enhancer" rationale (correct and well-designed). Barbell-only
selection from the start (barbell row instead of pulldown), concrete starting loads at
85–90% of rep-target from Epley — week 1 felt easy at RIR 3, exactly as intended.

### Month by month

| Mo | Weight | e1RM: SQ / BP / DL / OHP | Adherence | App actions & events |
|----|------|------|------|------|
| 1 | 84.4 | 141 / 106 / 165 / 64 | 95% | Wk-4 check-in #1: +0.1 kg/wk, just under the 0.12–0.19 band → **+100 → 3,060 kcal.** Correct per rules. |
| 2 | 85.0 | 144 / 108 / 168 / 65 | 90% | Coach Mode in constant use: plate math per side is genuinely valuable in a home gym; rest timers keep sessions honest. **Helped.** Ramp readout only appears on the *first* exercise of a session (`CO.idx === 0`) — his bench day ramps, but squat-second-on-lower-day never gets one. |
| 3 | 85.5 | 148 / 111 / 172 / 66 | 90% | Double progression working; he applies the add-2.5-kg rule himself from the PDF — Coach Mode shows last session's numbers as placeholders but **never says "all sets hit top of range — add load today."** |
| 4 | 85.9 | 148 / 111 / 174 / 66 | 85% | Bench flat 3 sessions (sleep-limited) → **stall watch fires**, suggests 87.5 → 80 kg rebuild. He takes it; rebuild works. **Helped.** |
| 5 | 86.3 | 150 / 113 / 176 / 67 | 85% | Check-in #2 (18 wks in; form caps at "8 weeks" → trend arithmetic uses the wrong denominator). Sleep flagged → volume held at bottom of band, sleep target given — correct. **But the revised plan is generated from 13 check-in fields only: the model doesn't know he trains in a home barbell gym.** Revised plan prescribes Lat Pulldown and Seated Cable Row; exercise names also shift ("Barbell Bench Press" → "Bench Press"), so **Coach Mode placeholders go blank and stall-watch history orphans.** He asks Ask-the-Trainer for swaps (it answers well — recovery path exists, but he had to find it). **Failed, then partially recovered.** |
| 6 | 86.6 | 152 / 114 / 178 / 68 | 85% | No deload yet — the PDF promised one every 4–8 weeks; nothing in the app schedules, reminds, or records one. |
| 7 | 87.0 | 154 / 114 / 180 / 68 | 80% | OHP stalls → same 10% reset advice. Second cycle of stall→reset with **zero escalation** (no rep-range change, no volume redistribution, no deload) — the check-in prompt's own "deload if 6+ weeks since the last one" rule is **unevaluable because nothing tracks deloads.** |
| 8 | 87.3 | 156 / 115 / 181 / 69 | 85% | Check-in #3: reports waist +2 cm → **−150 → 2,910 kcal.** Correct rule, and it only worked because he filled the *optional* waist field. |
| 9 | 87.4 | 156 / 115 / 181 / 69 | 75% | Accumulated fatigue; knee niggle on squats. He self-prescribes a deload week because the PDF mentioned it — the app never did. |
| 10 | 87.8 | 158 / 116 / 182 / 69 | 85% | Post-deload PRs — evidence the deload should have been programmed months earlier. |
| 11 | 87.9 | 159 / 117 / 183 / 70 | 85% | **localStorage log cap (200 sessions) reached ~here at 4×/wk — oldest sessions silently dropped.** Check-in autofill's "first → last" lift comparison now starts from a moved goalpost. |
| 12 | 88.2 | 160 / 117 / 184 / 70 | 60% | Flu + holidays, 2.5 weeks off. On return, Coach Mode shows pre-flu placeholders with **no detraining adjustment** (readiness "beat up" merely drops one isolation set); first session back was too heavy. The system prompt cuts loads 10–20% after a layoff *at plan time only* — mid-plan layoffs have no machinery. |

**Year narrative.** +4.2 kg scale (~2.5 kg muscle, ~1.7 kg fat), e1RM +11–14% across
the big four — a realistic, solid intermediate year, and the surplus/waist logic
managed body composition acceptably. The app's best moments were the intake (Epley
starting loads, sleep-modulated volume, barbell-native selection) and the plate
math/rest timers. Its worst moment was structural: **every check-in erased what the
app knew about him** — equipment, exercise names, progression context — because the
recalibration payload carries no prior state. The periodization the plan *describes*
(deloads, stall escalation) exists only as PDF prose; the interactive loop never
enforces or tracks any of it.

**Touchpoints:** 3 check-ins, ~190 logged sessions, ~15 Q&A exchanges.

---

## Subject C — "Dev", 56, returning from a long layoff, mild knee issue

**Profile:** 56M · 172 cm · 90.0 kg (BMI 30.4) · goal: general strength & health ·
trained in his 40s, ~8-year layoff · mild right-knee osteoarthritis (grumbles on
stairs) · commercial gym · 3 days/wk, 1 h · 5,500 steps · sleep 7 h · vegetarian ·
low stress.

**Intake behavior:** the knee mention correctly triggers the **questions triage**
("Has a physician cleared you for strength training: yes or no?", layoff length) —
one extra round-trip, then a well-adapted plan: recomp at ~maintenance (**2,500
kcal**, noted as ideal for detrained returners), protein on goal weight + top of
range for vegetarian (~145 g), and the 50+ machinery: **trap-bar over conventional
deadlift, box squat to parallel, leg press in pain-free range, 12-min warm-ups,
half-size progression steps**, layoff-discounted starting loads. This is the system
prompt at its best.

### Month by month

| Mo | Weight | Key lifts (e1RM est.) | Adherence | App actions & events |
|----|------|------|------|------|
| 1 | 89.2 | Leg press 95, trap bar 68, DB bench 2×14 | 90% | Questions round → plan. Wk-4 check-in #1: recomp trend (−0.2 kg/wk, waist −1 cm) → keep. Correct. |
| 2 | 88.6 | Leg press 125, trap bar 82 | 90% | Muscle-memory gains. Son sets up a Sync account + installs the PWA (nothing in the app prompted this — luck). |
| 3 | 88.2 | Leg press 138 | 85% | Knee flare (step target jumped 5,500→8,000 too fast for an OA knee; the prompt caps the jump at ~3,000 generically — no joint-aware step ramp). Check-in #2, pain reported → conservative mods + physio referral: correct. **But the revised plan is built without his date of birth: the 50+ rules cannot fire. Conventional deadlift and walking lunges reappear** — only the freshly-typed pain note kept deep knee flexion out. The app forgot he is 56 the moment he checked in. **Failed (safety-adjacent).** |
| 4 | 87.8 | — | 85% | Physio confirms management plan. He learns to re-type "I am 56, mild knee OA" into every check-in's extra box — a workaround no real client should need. |
| 5 | 87.3 | Leg press 150, trap bar 95 | 90% | Steady. |
| 6 | 87.0 | — | 90% | Near-miss: phone storage cleanup would have wiped plan + 60 logs; the month-2 sync account saved him. Counterfactual for the median user: **total data loss, restart from a blank form.** |
| 7 | 86.6 | Leg press 158 | 60% | Winter cold, 2 weeks reduced. Check-in #3: trend fine, keep; sessions "about half" correctly gated any target changes. **Helped.** |
| 8 | 86.5 | — | 85% | — |
| 9 | 86.1 | Leg press stalls | 85% | Returner gains spent. Stall watch → 10% reset on leg press; appropriate here. **Helped.** |
| 10 | 85.8 | Trap bar 102 | 85% | Check-in #4: keep. Nobody — app or prompt — raises balance work, power maintenance, or bone-density loading as he approaches 60; the 60+ rules trigger on age at *plan* time, and age is never re-sent, so **they can never activate for a continuing client.** |
| 11 | 85.6 | — | 80% | — |
| 12 | 85.4 | Leg press 172, trap bar 105, DB bench 2×22 | 85% | Year end: −4.6 kg scale, waist −6 cm (≈ +2 kg muscle / −6.5 kg fat — classic returner recomp), knee better than baseline thanks to hip/quad strength in pain-free ranges. |

**Year narrative.** The best subjective outcome of the three, and the intake plan was
excellent — triage, special-population adaptations, veg protein handling all correct.
But Dev is also the subject the check-in statelessness endangers most: a 56-year-old
with a joint condition whose recalibrated plans are written by a model that knows
neither fact unless he re-types them every time. His good year depended on two
accidents: a son who set up sync, and his own habit of re-declaring his age and knee
in free text.

**Touchpoints:** 1 question round, 4 check-ins, ~130 logged sessions, ~12 Q&A.

---

## Cross-subject scoreboard

| | Priya | Marcus | Dev |
|---|---|---|---|
| Outcome vs realistic best-case | ~85% | ~80% | ~90% |
| Weight change | −12.8 kg | +4.2 kg | −4.6 kg (recomp) |
| Strength change | ~+50% (novice) | +11–14% e1RM | ~+80% vs detrained |
| Mean session adherence | 78% | 84% | 85% |
| Check-ins in 12 months | 6 | 3 | 4 |
| Moments app clearly helped | 4 | 4 | 3 |
| Moments app failed / misled | 4 | 4 | 2 |
| Silent months (zero app-initiated contact) | 12 of 12 | 12 of 12 | 12 of 12 |

The last row is the quiet headline: **the app never initiates anything.** Every
touchpoint in 36 subject-months was user-initiated.

---

## FINDINGS (ranked by impact)

### F1. Check-ins are stateless: every recalibration forgets the client — [accuracy] [reliability]
**Moment:** Dev month 3 (revised plan loses "age 56" and the trap-bar/box-squat
machinery; conventional deadlift reappears next to a knee complaint); Marcus month 5
(revised plan prescribes cable machines he does not own; renamed exercises orphan his
log history and stall watch).
**Why it matters:** the check-in payload (`intake()` for checkin mode,
templates/trainer.html:792; `/api/trainer` app.py:575) contains only the 13 check-in
form fields. The previous plan JSON, DOB, height, equipment, injuries, allergies, diet
preference, and food preferences are never sent — the system prompt even instructs
the model to null them. So special-population rules (50+, knee mods, RED-S floors),
equipment fit, and allergen exclusion **cannot survive a check-in**, and exercise
renames break Coach Mode placeholders, `lastSetsFor`, stall watch, and autofill
(all exact-name matched). This is the single largest gap between "app" and "coach":
a coach's defining feature is memory.
**$0 fix:** attach the saved plan JSON to the check-in request exactly as
`/api/trainer/ask` already does (app.py:810), and persist the original intake in
localStorage alongside the plan, sending both with `mode: "checkin"`. Add one system-
prompt line: "Preserve the prior plan's exercise names, equipment constraints, and
all safety/special-population context unless the check-in data contradicts them."

### F2. The periodization the plan promises does not exist in the loop — [accuracy]
**Moment:** Marcus months 4–10: two stall→10%-reset cycles with zero escalation and
no deload all year until he self-prescribed one from the PDF prose; the check-in
rule "consider a deload if 6+ weeks since the last one" (trainer_system.txt:124) is
permanently unevaluable because nothing records deloads.
**Why it matters:** the plan text prescribes deloads every 4–8 weeks and a stall
hierarchy (sleep → reset → deload), but the interactive layer only implements the
middle step, repeated forever. Fatigue management — the thing intermediates actually
plateau on — is left to the user's memory of a PDF.
**$0 fix:** derive weeks-trained from the saved plan's timestamp + log density and
show a "deload week due — halve sets, −15–20% load" banner in the Log tab and Coach
Mode readiness screen; add a "this was a deload" checkbox on session save; include
weeks-since-deload and stall history in the check-in payload (the `qaLogDigest()`
structure at trainer.html is already 90% of this).

### F3. Progress is judged by kg-then-reps, not e1RM, and Coach Mode never issues progression targets — [accuracy]
**Moment:** Priya month 6 — a set of 62.5×5 registers as "better" than 60×8 in
`bestSet`/`stallWatch` (trainer.html:990,1055) though Epley e1RM *fell* 76→73 kg, so
rep-range drift masks stalls and fake-passes progress; Marcus all year — placeholders
show last session's numbers but the app never says "all sets hit the top of the range
last time: add 2.5 kg today," leaving double progression (the plan's core engine) to
the user. Also the warm-up ramp renders only for the session's first exercise
(`CO.idx === 0` guard, trainer.html:1262).
**$0 fix:** compute Epley e1RM per logged set (one line — the formula is already in
the system prompt) and use best-e1RM for stall detection and history display; on
entering an exercise in Coach Mode, compare last session's sets to the plan's
rep_range top and emit the add-load / rebuild-reps instruction; delete the `idx === 0`
guard so every barbell lift gets a ramp.

### F4. The loop is 100% user-initiated, has no bodyweight log, and the check-in form distorts long gaps — [user-friendliness] [accuracy]
**Moment:** Priya weeks 6–10 (four silent weeks between check-ins); her month-7
post-vacation check-in cut calories off a water-weight rebound the prompt only knows
to discount "in the first 1–2 weeks of a new plan"; Marcus month 5 — 18 weeks on the
plan but `cWeeks` caps at 8 (trainer.html:551), so trend = Δweight/8 overstates his
weekly rate ~2×; check-in lift autofill compares all-time first→last logs, not the
current plan window.
**Why it matters:** the app's own recalibration doctrine is "the measured trend is
ground truth" — yet it provides no place to measure (no weight log), no cadence
(no reminder when week 4 arrives), and a form that mis-measures the window. Garbage
window in, confident arithmetic out.
**$0 fix:** a local bodyweight log (one input + sparkline, localStorage, roadmap
already names it) whose 7-day averages prefill the check-in; compute weeks from
`savedPlan().at` into a free numeric field instead of the capped select; scope lift
autofill to logs newer than the current plan; a passive "Week 4 — check-in ready"
banner when `Date.now() − saved.at > 28 days`; add "any travel/illness in this
window?" to the check-in so the model can discount distorted trends.

### F5. A year of data lives on borrowed time: silent 200-log cap and localStorage-only default — [reliability]
**Moment:** Marcus month 11 — at 4 sessions/week the 200-session cap
(trainer.html:1034,1212) silently drops his oldest logs, moving the autofill
baseline; Dev month 6 — a routine phone storage cleanup would have erased the plan
and 60 sessions had his son not created a sync account four months earlier (nothing
in the product ever suggested it).
**Why it matters:** the app's long-term value *is* the log. A one-year user is
precisely the user most likely to hit the cap and most hurt by eviction — and
Safari's storage eviction policies make this a when, not an if, for non-installed
casual users.
**$0 fix:** raise the cap to 1,000 (logs are ~100 bytes/session), warn at 90%, keep
only the best set per exercise when trimming instead of whole sessions; after the
5th logged session, one-time nudge: "60 sessions from now this history is your
coach — back it up with a free sync account or the export button" (export is already
on the roadmap).

### F6. Stall advice ignores training context — [accuracy]
**Moment:** Priya month 6: stall watch prescribed a 10% reset on a lift stalling
*because she is in a month-5 deficit* — expected physiology, not a loading error.
The banner's caveat "if sleep and food are in order" cannot land, because for a
cutting client food is deliberately not in order.
**$0 fix:** stall watch already has the saved plan; branch the copy on goal — for
fat-loss plans: "holding strength in a deficit is winning; reset only if a lift
*drops* two sessions running."

### F7. No off-ramp at goal completion — [accuracy] [user-friendliness]
**Moment:** Priya months 11–12: goal weight reached; check-in mode structurally
optimizes the original goal forever, and the check-in form's goal dropdown ("the goal
you trained for") offers no sanctioned way to say "done — now what?" A real coach
runs a maintenance/reverse-diet transition here; the app leaves her at 1,470 kcal.
**$0 fix:** one system-prompt rule: "If the measured trend shows the goal is reached
(fat loss: healthy BMI/waist and client satisfaction; gain: target weight), the
revised plan should propose the transition (maintenance calories via the measured
TDEE, strength focus) in checkin_review.verdict" — plus a "Goal reached?" yes/no on
the check-in form.

### F8. Readiness and layoffs get token adjustments — [user-friendliness]
**Moment:** Marcus month 12: back after 2.5 weeks of flu, Coach Mode's "beat up"
readiness dropped one isolation set and left every load placeholder at pre-flu
numbers; the system prompt's 10–20% layoff discount exists only at plan generation.
**$0 fix:** in Coach Mode, if the last log for this day-type is >14 days old, banner:
"Long gap — take 10% off every placeholder and 2 extra RIR today; you'll be back in
two sessions" and pre-fill discounted placeholders.

### F9. No server-side schema validation of plans — [reliability]
**Moment:** none of the three years hit it (we assumed a compliant model), but the
only gate in `run_model_chain` (app.py:706) is JSON-parses + `type in ("questions",
"plan")`. A plan missing `workout_days` renders, silently hides the Log tab
(trainer.html:949), and disables the entire coaching loop with no error.
**$0 fix:** a 20-line server check for required top-level keys (`workout_days`
non-empty, `diet_plan` numbers present, macro arithmetic within 2%) before accepting
an attempt; a failed check retries, same as a parse failure — the retry scaffolding
already exists.

---

## Shortlist — top 5 changes for real-user outcomes

1. **Make check-ins stateful** (F1): send saved plan + stored original intake with
   every check-in; instruct the model to keep names/equipment/safety context. Fixes
   the largest accuracy, safety, and continuity break in one payload change.
2. **Put the plan's own periodization into the loop** (F2): deload-due banner,
   deload marking, stall escalation, weeks-trained in the check-in payload.
3. **e1RM-based progress + in-session progression targets** (F3): the app becomes a
   coach that tells you what to lift today, not a notebook with a timer.
4. **Bodyweight log + check-in cadence nudge + honest window math** (F4): the
   recalibration doctrine finally gets the measurements it claims to run on.
5. **Protect the year of data** (F5): bigger smarter log cap, eviction warning,
   sync/export nudge after session 5.

*Full simulation assumptions and code line references are inline above; everything is
reproducible from `data/trainer_system.txt`, `app.py`, and `templates/trainer.html`
at the commit this file lands on.*

---

# Sprint 15 re-run

**Team:** SIMULATION · **Date:** 2026-07-24 · **Status:** complete · **Code changed: none**
(this is analysis only; the only edit is this appended section).

## What changed since the first study, and how this re-run reads the code

Between the first study and now, Sprints 12–14 shipped fixes aimed squarely at the
defects ranked above. This re-run re-executes the same deterministic rules — but
against the **current** code — and assumes, as before, a **prompt-compliant model**,
so every remaining failure is a design failure, not a model-quality one. The features
now active, and the exact lines that implement them:

- **Stateful check-in (Sprint 12).** The client attaches `planDigest()`
  (`templates/trainer.html:1647` — weekly split, per-day exercise names + sets + rep
  ranges + any numeric load note, `profile_summary` incl. `age_years` and
  `experience_level`, diet targets, **and `safety_notes`**) and `qaLogDigest()`
  (`:1671` — last 10 sessions' best sets, `stallWatch()` output, plan age) to the
  check-in POST (`:860`). A computed elapsed-weeks field (`:823`) overrides the capped
  select. A disruption dropdown (`:817`, form at `:586`) feeds trend discounting. The
  server injects both digests verbatim under 20 KB (`app.py:744-752`) for Gemini and
  Groq. Prompt rules: PREVIOUS PLAN (keep split/names, carry loads forward, re-apply
  safety flags, list deviations), LOG-outranks-free-text, disruption discounting
  (`trainer_system.txt:131-143`).
- **Deload autopilot (Sprint 13).** `deloadInfo()` (`:1125`) parses the cadence from
  the plan's own deload text (clamped 4–8, default 6) and fires a card in the Log tab
  and Coach Mode when `sinceW >= cadence`; Coach Mode halves sets (`:1182`). Dismissal
  writes `DL_KEY` and resets the clock (`:1046`).
- **e1RM stall watch + escalation (Sprint 13).** `bestSet()`/`e1rm` (`:1020`) judge
  progress by Epley e1RM with a total-reps tiebreak; `stallWatch()` (`:1083`) flags a
  lift with no e1RM PR across the last 3 sessions and **escalates to the plan's deload
  language on a 4th flat session** (the `deep` branch, `:1104`).
- **Coach Mode cues (Sprint 13).** `coProgressCue()` (`:1211`) says "add 2.5/5 kg" when
  every set hit the top of the range last time, else "beat a rep"; `barbellish` ramps
  every barbell lift (`:1165`); readiness overrides RIR to 3 (`:1179`).
- **Server plan validator (Sprint 12).** `_validate_plan()` (`app.py:631`) gates
  shape, numeric sets, macro math ±3 %, sample-day ±7 %, markdown/newline, allergen
  scan — wired into both retry legs (`:839`, `:880`).
- **Data isolation (Sprint 14).** Owner-stamp + `deviceReset()` — closes cross-account
  bleed on shared browsers. It did **not** touch the 200-log cap or add any backup path.

## Verdict on the first study's findings F1–F9

| # | First-study finding | Status now | Code reason |
|---|---|---|---|
| F1 | Check-ins are stateless | **FIXED** | `planDigest()` carries split, exercise names+loads, `age_years`, `experience_level`, and `safety_notes`; prompt re-applies safety flags and keeps names verbatim. Residuals: `age_years` is **frozen at plan time** (no DOB in the digest, so a client who crosses a 50+/60+ boundary mid-journey can't newly trigger it); equipment survives only **implicitly** via exercise names, so a *forced swap* has no equipment context (→ S4). |
| F2 | Periodization not in the loop | **FIXED (loop) / PARTIAL (check-in)** | Deload autopilot + stall escalation are live and executed. Residuals: deload clock is calendar-only (S1), no aggregate "2 lifts stalled this week" trigger (S3), the two deload pathways don't coordinate (S5), and weeks-since-deload still isn't in the check-in payload. |
| F3 | Progress judged by kg not e1RM; no cues | **FIXED** | `bestSet`/`stallWatch` are e1RM-based; `coProgressCue` issues add-load/beat-a-rep; ramps on every barbell lift. Residuals: the cue is detraining-blind (S7) and the 3-session window ignores experience/time (S2). |
| F4 | User-initiated, no BW log, distorted window | **PARTIAL** | FIXED: computed elapsed-weeks kills the ÷8 doubling; disruption field added. STILL OPEN: no bodyweight log, no cadence nudge (loop is **still 100 % user-initiated** — grep finds no reminder banner), autofill still compares all-time first→last (`:1394`), and intermittency silently dilutes the trend (S6). |
| F5 | Data on borrowed time; 200-log cap | **STILL OPEN** | Cap is still 200 (`:1073`, `:1316`, **and the sync-merge path `:1469`**); no 90 % warning, no post-session-5 sync/export nudge. Sprint 14 shipped isolation, not durability (S11). |
| F6 | Stall advice ignores deficit context | **STILL OPEN** | `stallHTML` (`:1111`) has no goal branch; a lift merely *holding* in a deficit still reads "reduce 10 % if sleep and food are in order" (S8). |
| F7 | No off-ramp at goal completion | **STILL OPEN** | No "Goal reached?" field; no maintenance-transition rule in `trainer_system.txt` (S9). |
| F8 | Readiness/layoffs get token adjustments | **PARTIAL** | FIXED: readiness RIR-3 override + set drop + time-scaled coach adjustments. STILL OPEN: a >14-day mid-plan layoff still shows pre-gap placeholders and an add-load cue (S7). |
| F9 | No server-side schema validation | **FIXED** | `_validate_plan()` gates both retry legs. |

Net: **4 fully fixed (F1, F3, F9, and F2 in the loop), 2 partial (F4, F8), 3 still open
(F5, F6, F7).** The two biggest first-study defects — stateless check-ins and
periodization-in-prose-only — are the ones that genuinely closed.

## Subject A — "Priya" re-run (beginner, fat loss)

Only the months where a shipped feature changed the app's behavior are shown.

| Mo | First study | Sprint-15 behavior | Delta |
|----|------|------|------|
| 3 | Check-in forced "6" or "8" weeks (actual gap 7) | Computed field sends **7** (`:823`); trend uses the true denominator | Small accuracy win — correct rate, correct keep/cut call |
| 6 | Stall watch reset a lift that stalled *because she's in a deficit* | e1RM watch is smarter (rep gains at fixed weight no longer false-flag), **but** a genuinely held lift still flags "reduce 10 %" with the deficit-blind caveat (F6 open). The *check-in* advice is context-aware (prefers steps, sees the log) | PARTIAL — check-in good, Log-tab banner still deficit-blind |
| 7 | Post-vacation +0.8 kg water → model **cut −150 kcal off a fake trend** | She selects disruption **"Travel"**; prompt discounts the disrupted weeks → **calories held**, no unnecessary cut | **FIXED** — the single clearest improvement in her year |
| 11–12 | Goal reached; stuck cutting at ~1,470 kcal, no off-ramp | Unchanged — no goal-reached field or maintenance rule (F7 open) | STILL OPEN |

**Outcome vs first study.** Final weight essentially unchanged (**≈ −12.9 kg** vs −12.8;
she was already near the physiological best case), but the *risky moments* improved: the
month-7 water-rebound cut is gone, so months 7–9 run at the correct deficit instead of
an accidentally deeper one (avoids ~1–1.5 kg of over-fast loss and the associated hunger
/ RED-S drift; modeled adherence months 8–9 holds ~88 % vs 85 %). Outcome-vs-best-case
**~85 % → ~88 %**, gained almost entirely on process honesty, not on the scale. Residuals
that still cost her: no off-ramp (F7), deficit-blind Log-tab stall copy (F6), still no
bodyweight log and zero app-initiated contact (F4).

## Subject B — "Marcus" re-run (intermediate, home barbell) — the biggest gainer

| Mo | First study | Sprint-15 behavior | Delta |
|----|------|------|------|
| ~6 | No deload all year; he self-prescribed one in month 9 | `deloadInfo()` fires on schedule (~wk 6); Log tab + Coach Mode halve sets. His **first scheduled deload lands on time** | **FIXED** — fatigue managed, fewer downstream stalls |
| 4 / 7 | Stall → "reduce 10 %" forever, zero escalation | e1RM watch; a **4th flat session escalates to the deload** (`deep` branch). Double-progression rep gains no longer false-flag | **FIXED** |
| 5 | Check-in: `cWeeks` capped at 8 while 18 wks in → trend ÷8 **overstated his rate ~2×**; revised plan prescribed **cable machines he doesn't own**; renamed exercises **orphaned his logs** | Computed field sends **18** → +2.3 kg/18 wk = **+0.128 kg/wk** (in band → keep/+100) instead of the ÷8 artifact +0.29 kg/wk (over-band → spurious cut). `planDigest` carries his barbell exercise names; prompt keeps them (Sprint-12 live proof: 26/26 names kept) → **no cable machines, logs stay aligned, Coach placeholders keep working** | **FIXED** — the transformed month |
| 11 | 200-log cap silently drops oldest sessions at 4×/wk | Cap still 200 (unchanged), but the check-in now uses `qaLogDigest`'s **recent** 10 sessions + LOG-outranks-free-text, so recalibration is unaffected; only the all-time autofill text/history is still moved | STILL OPEN, **lower severity** |
| 12 | Flu, 2.5 wk off; first session back too heavy (pre-flu placeholders) | Readiness "beat up" now drops a set + forces RIR 3 — **but** `coProgressCue` still reads his pre-flu session and can say "add 2.5 kg today"; the >14-day discount doesn't exist | PARTIAL (F8) |

**Outcome vs first study.** The month-5 check-in alone flips a likely wrong calorie cut
into a correct hold, keeps his whole program intact, and preserves log continuity; the
scheduled deloads smooth the year. Modeled big-four e1RM **+13–16 %** (vs +11–14 % first
study), scale **+4.0 kg** with a cleaner muscle:fat split. Outcome-vs-best-case
**~80 % → ~90 %**. Residuals: the 200-cap (now low impact) and the flu-return add-load
cue (F8 / S7).

## Subject C — "Dev" re-run (56, returning, knee OA) — the safety win

| Mo | First study | Sprint-15 behavior | Delta |
|----|------|------|------|
| 3 | Pain-reported check-in **rebuilt without his DOB** → 50+ machinery lost; **conventional deadlift + walking lunges reappeared** next to a knee complaint; only his freshly-typed pain note kept deep knee flexion out | `planDigest` carries `profile.age_years = 56`, `experience_level`, **and `safety_notes`** (trap bar, box squat, leg-press pain-free range); prompt: re-apply flagged issues without restating, keep names → **trap bar and box squat preserved, conventional deadlift/lunges do NOT reappear**; he no longer has to re-type "I am 56, knee OA" | **FIXED (safety-adjacent)** — the app remembers |
| 10 | 60+ rules can never fire for a continuing client | Still can't fire from age alone — `age_years` is frozen from the original plan and there's no DOB to recompute. Dev is 56→57 this year so it doesn't bite, but the **bracket-crossing edge is real** for multi-year clients | STILL OPEN (edge, not yet due for Dev) |
| 6 | Near data-loss; saved only by his son's sync account | Sprint 14 added isolation, not durability; a non-synced user still loses everything to storage eviction. Dev synced, so fine | STILL OPEN (F5) |

**Outcome vs first study.** Scale/strength essentially unchanged (**−4.6 kg recomp**, the
best of the three both times) — but the **safety risk at every recalibration is removed**:
a knee-OA client no longer has deep-knee-flexion movements re-prescribed when he checks
in, and no longer depends on his own habit of re-declaring his condition. Outcome-vs-
best-case **~90 % → ~93 %**, the gain being safety and dignity rather than a bigger number.

## Updated cross-subject scoreboard (first study → Sprint 15)

| | Priya | Marcus | Dev |
|---|---|---|---|
| Outcome vs best-case | 85 % → **88 %** | 80 % → **90 %** | 90 % → **93 %** |
| Weight change | −12.8 → −12.9 kg | +4.2 kg | −4.6 kg |
| Strength change | ~+50 % | +11–14 % → **+13–16 % e1RM** | ~+80 % |
| Biggest fix that landed | disruption discount (mo 7) | stateful check-in + deload autopilot (mo 5–6) | safety context survives check-in (mo 3) |
| Silent months (app-initiated contact) | **12 of 12** | **12 of 12** | **12 of 12** |

The last row is unchanged and remains the quiet headline: **the app still never
initiates anything.** All 36 original subject-months (and all 24 new ones below) are
100 % user-initiated.

---

## New adversarial subject D — "Ade", advanced plateau-prone lifter

**Profile:** 31M · 178 cm · 88.0 kg · goal: strength (a little size) · advanced (~7 yr) ·
commercial gym · 4 days/wk upper/lower, 1.5 h · 9,000 steps · sleep 7 h · low–moderate
stress · non-veg · current lifts near ceiling: **squat 180×3, bench 130×3, deadlift
220×2, OHP 82×3**.

**Intake e1RMs (Epley):** SQ 180×1.10 = **198**, BP 130×1.10 = **143**, DL 220×1.067 =
**235**, OHP 82×1.10 = **90**.

**What the app produces:** BMR = 10×88 + 6.25×178 − 5×31 + 5 = **1,843**; AF 1.5 (9k
steps) + 0.10 = **1.6** → TDEE ≈ **2,950**; strength goal maintenance to +5 % →
**≈ 3,040 kcal**, protein ~160 g. Advanced volume 14–20 sets/muscle, primary lifts 3–6
at 80–90 %, Epley starting loads at ~85–90 %. Deload text reads "every 4 to 6 weeks"
→ `deloadInfo` parses **4** (first number, clamped). Plate math and ramps at 180–220 kg
are genuinely valuable.

### Month by month

| Mo | Key e1RM: SQ/BP/DL/OHP | App actions & events |
|----|------|------|
| 1 | 198 / 143 / 235 / 90 | Plan built. Coach Mode plate math + ramps land well at heavy loads. Check-in #1: +0.3 kg, strength goal → keep. Good. |
| 2 | 199 / 144 / 236 / 90 | First non-monotonic block: bench 130×4, then 130×4 (off day), then 130×5. Two flat sessions early trip nothing yet — but a squat run of 3 same-e1RM sessions (normal for advanced) **false-flags "reduce 10 %."** He ignores it. **Cry-wolf begins.** |
| 3 | 201 / 145 / 237 / 91 | Scheduled deload fires ~wk 4–5 (cadence 4); Coach Mode halves sets — **correct and on time. Helped.** A second spurious stall flag on OHP. He's learning to distrust the banner. |
| 4 | 201 / **147** / 238 / 91 | **Genuine** bench plateau (expected at advanced). 3 flat → "reduce 10 %" → rebuild to 130 → stalls again (4th flat) → **escalates to the deload**; post-deload he breaks to 132.5. **The escalation worked — the app's best moment for D.** |
| 5 | 202 / 148 / 239 / 92 | Check-in #2 (computed 20 wks, correct). Model reads the logged bench stall and **rotates** comp bench → a 3-week **"Paused Bench Press"** block — good coaching. But the rename **blanks Coach placeholders and resets that lift's stall/e1RM thread** (they're exact-name matched); the digest carried no `substitution`/equipment, so the swap is unguided. **New continuity break — on an intentional, correct change.** |
| 6 | 203 / 149 / 240 / 92 | Paused block does its job; comp bench returns 132.5→135. |
| 7 | 204 / 149 / **241** / 93 | Deadlift plateau; "reduce 10 %" → rebuild works once. |
| 8 | 204 / 149 / 241 / 93 | Check-in #3: waist +1.5 cm (lean-bulk creep, he filled the optional field) → −100–150 kcal. Correct. |
| 9 | **205** / 149 / 242 / 93 | Squat stalls hard: 3 flat → reduce → rebuild → 4th flat → **stall-escalation says deload.** He deloads — but he **calendar-deloaded 3 weeks earlier**, and `deloadInfo` will surface its own card again next week. **Two independent deload pathways, no coordination → risk of a double deload** that kills momentum. |
| 10 | 205 / 149 / 242 / 93 | He now spends real attention *managing the app's flags* rather than training. |
| 11 | 205 / 149 / 243 / 94 | **Squat and OHP stall in the same week.** The prompt's own "immediate deload when 2+ lifts stall" trigger exists — but it's **only evaluable at a check-in he isn't due for**; the loop's `deloadInfo` is calendar-only and `stallWatch` flags each lift independently. **The one trigger an advanced lifter needs most never fires in the loop.** |
| 12 | **205 / 149 / 243 / 93** | Year end. e1RM: SQ +3.5 %, BP +4.2 %, DL +3.4 %, OHP +3.3 %; BW 88→89.4. A realistic advanced year. |

**Year narrative.** The app genuinely helped at the two *real* plateaus (the 4th-flat
escalation broke both bench and squat) and the plate math/ramps are worth real money at
these loads. But the interactive layer is **tuned for a novice's progress cadence**: a
3-session no-PR window flags a lifter who is progressing exactly as an advanced lifter
must (non-monotonically), so the banner cries wolf ~monthly and he stops trusting it;
the correct answer to a stubborn plateau (exercise rotation) breaks his log continuity
the moment the model does it right; and the two deload pathways plus the missing
aggregate trigger mean fatigue management is either double-applied or not applied when it
matters. Outcome-vs-best-case **~78 %** — the e1RM numbers are near a good coach's, but
the noise cost him trust and ~2–3 productive weeks.

**Touchpoints:** 3 check-ins, ~200 logged sessions (brushes the cap), ~10 Q&A.

---

## New adversarial subject E — "Lin", highly intermittent traveler

**Profile:** 38F · 168 cm · 66.0 kg · goal: fat loss · ~2 yr on-and-off (perpetual
returner) · commercial + hotel gyms · *states* 4 days/wk (reality is bursty) · 1 h ·
management consultant, travels 2–3 wk/month · 8,000 steps (airports) · sleep ~6 h (jet
lag), variable · non-veg · no injuries.

**What the app produces:** BMR (F) = 10×66 + 6.25×168 − 5×38 − 161 = **1,359**; AF 1.5
(8k steps) + 0.10 = **1.6** → TDEE ≈ **2,170**; fat loss −450 → **1,720 kcal**, protein
~130 g. The plan assumes the 4 days/wk she typed.

### Month by month

| Mo | Weight | Sessions logged | App actions & events |
|----|------|------|------|
| 1 | 66.0 → 64.6 | 15 (home month) | Plan built. Coach Mode plate math shines in unfamiliar hotel gyms. Solid start. |
| 2 | 64.6 → 64.4 | 4 (travel) | Trains 4× all month. No check-in (too busy). Silent. |
| 3 | 64.4 → 63.4 | 12 (home) | Check-in #1 at real-wk ~10. Computed elapsed = **10 wks**; −2.6 kg/10 = −0.26 kg/wk. She reports sessions "About half," diet "50–70 %," disruption "Travel." **Adherence gate fires → keep calories, simplify.** The gate *rescues* the fact that the 10-wk denominator diluted her real on-plan rate. **Helped, by luck of the gate.** |
| 4 | 63.4 → 63.8 | 2 (3 wk abroad) | Travel eating; slight regain. Silent. |
| 5 | 63.8 → 62.6 | 13 (home) | On return she opens the Log tab → **DELOAD CARD fires** (`deloadInfo` sees plan age ~18 wk, never dismissed). She hasn't trained in weeks — **being told to deload after detraining is backwards.** And `coProgressCue` reads her 6-week-old session and says **"add 2.5 kg today"** → first session back too heavy, sore. **Failed (two ways) — both from keying off calendar plan-age, not training recency.** |
| 6 | 62.6 → (target) | 14 (good month) | Check-in #2 at real-wk ~22. −3.4 kg/**22** = **−0.15 kg/wk**. This month was clean so she reports "About 75 %" / "70–90 %" / disruption **"None"** → **gate does NOT fire.** Model reads −0.15 kg/wk as slow-loss-with-good-adherence → **subtracts 100–150 kcal (or adds steps).** But the −0.15 is a **dilution artifact** of dividing four on-off months by 22 continuous weeks; her actual on-plan weeks lost fine. The single-block disruption field **can't express the historical gaps.** **Failed — an unwarranted cut.** |
| 7 | 62.6 → 62.9 | 3 (travel) | The needless cut → hungry on the road → adherence craters. |
| 8 | 62.9 → 62.8 | 5 | — |
| 9 | 62.8 → 62.0 | 12 (home) | Rebuild. Stall watch compares her 3 most-recent bench sessions **spanning ~4 months** with no time-awareness; her post-gap return is below her pre-gap number → **false "deep stall" → "take the deload"** when she actually just detrained. |
| 10 | 62.0 → 61.6 | 8 | **Switches to a new work phone, no sync account.** `localStorage` plan + logs **gone.** Nothing ever nudged her to sync or export. **Re-onboards from a blank form** with approximate numbers. **Failed (reliability).** |
| 11 | 61.6 → 61.3 | 11 | Fresh plan; no memory of the prior year's logs. |
| 12 | 61.3 → 62.5 | 4 (holiday travel) | Year end **−3.5 kg**. |

**Year narrative.** A *continuous* Lin on this exact plan would lose ~6–8 kg; her
intermittency plus the app's continuous-training assumptions cost roughly half the
result. The app's **adherence gate is her best friend** (month 3) — but the
**calendar-based deload** (month 5), the **trend dilution → over-cut** (month 6), the
**detrained "add load" cue** (month 5), the **time-blind stall detector** (month 9), and
the **device-switch data loss** (month 10) each subtract. She is the subject who most
exposes that the whole loop silently assumes you train roughly every week. Outcome-vs-
best-case **~55–60 %**.

**Touchpoints:** 2 check-ins (then a re-onboard), ~90 logged sessions (never near the
cap), ~6 Q&A.

---

## FINDINGS (ranked by impact)

### S1. Deload autopilot keys off calendar plan-age, not training recency — [accuracy] [user-friendliness]
**Moment:** Lin month 5 — a deload card after a ~10-week no-training gap ("it's been
14 weeks of hard training"), and an add-load cue, both because `deloadInfo` (`:1135`) and
`coProgressCue` read plan age / the last stored session with no gap check. Ade months
9 & 11 — the calendar clock collides with real fatigue state.
**Why it matters:** the two hardest real cases — the returner and the intermittent user —
are exactly where a *calendar* deload is worst; halving sets on someone who just
detrained is backwards, and it's the single most common real event (coming back from a
break).
**$0 fix:** compute `lastSessionAt` from the logs and base `sinceW` on
`Math.max(sp.at, doneAt, lastSessionAt)`; if there is no session in >14 days, replace
the deload card with a "welcome back — ramp for 1–2 sessions, don't deload" card. Both
values already exist in `loadLogs()` and `savedPlan()`.

### S2. Stall Watch's 3-session window ignores experience and time — [accuracy] [user-friendliness]
**Moment:** Ade months 2–3 & 10 — ~monthly false "reduce 10 %" flags because 3 sessions
without an e1RM PR is *normal* advanced progress, so the banner cries wolf and he stops
trusting it. Lin month 9 — a false "deep stall" from comparing sessions ~4 months apart.
**Why it matters:** the stall banner is the app's main piece of *interactive* coaching;
once it cries wolf, the user tunes out the true stalls too. The window is hard-coded at
3 (`stallWatch`, `:1096,1100`) with no read of `experience_level` (which is in
`savedPlan().plan.profile_summary`) and no read of session dates.
**$0 fix:** scale the window by experience — novice 3, intermediate 4, advanced 5–6
sessions — and ignore any two sessions >21 days apart when judging "consecutive." Both
inputs are already loaded.

### S3. No aggregate "2+ lifts stalled this week → deload now" trigger in the loop — [accuracy]
**Moment:** Ade month 11 — squat and OHP stall in the same week; the prompt's own
immediate-deload trigger (`trainer_system.txt:307-309`) is only evaluable at a check-in
he isn't due for, and `deloadInfo` is calendar-only.
**Why it matters:** the aggregate stall is the trigger advanced plateau lifters need
most, and it lives only in PDF prose — the exact shape of the original F2.
**$0 fix:** `stallWatch()` already returns the list; if ≥2 distinct lifts flag within
the last 7 days of logs, surface the existing `deloadHTML` card immediately, independent
of the calendar.

### S4. Exercise rotation breaks log/Coach continuity — the Sprint-12 fix covers KEPT names, not INTENTIONALLY CHANGED ones — [reliability] [accuracy]
**Moment:** Ade month 5 — the model correctly rotates comp bench → "Paused Bench Press";
the rename blanks Coach placeholders and resets that lift's e1RM/stall thread because
`lastSetsFor`/`stallWatch`/autofill are exact-name matched, and the digest carried no
`substitution`/equipment to guide the swap.
**Why it matters:** Sprint 12 solved continuity for exercises the model *keeps*; a
*correct* rotation is now the thing that breaks it — penalizing good coaching.
**$0 fix:** have the check-in emit a machine-readable `renamed_from` inside
`training_changes` (or a small `checkin_review.exercise_renames` map); the client aliases
old-name history to the new name in the three exact-match lookups. Also add
`training_environment`/`equipment_notes` (or each exercise's `substitution`) to
`planDigest` so rotations stay in-kit.

### S5. The two deload pathways don't share a clock — [reliability]
**Moment:** Ade month 9 — a stall-escalation deload followed a week later by an
independent calendar deload card, risking a double deload that stalls momentum.
**Why it matters:** over-deloading an advanced lifter is as costly as never deloading.
**$0 fix:** whenever stall-escalation advises a deload (the `deep` branch) or the user
dismisses any deload, write `DL_KEY = Date.now()`; `deloadInfo` already keys off
`DL_KEY`, so one shared timestamp coordinates both automatically.

### S6. The computed-elapsed-weeks field assumes continuous training; intermittency dilutes the trend — [accuracy]
**Moment:** Lin month 6 — −3.4 kg over 22 *calendar* weeks reads −0.15 kg/wk and triggers
an unwarranted −100–150 kcal cut, though her on-plan weeks lost fine; the single-block
disruption dropdown can't express four months of on-off.
**Why it matters:** the recalibration doctrine is "the measured trend is ground truth" —
but the trend is measured per *calendar* week (`:823`, labelled "trust over the select"),
so a busy/travel user (a large real segment) gets systematically over-cut.
**$0 fix:** count distinct weeks that contain a logged session in the plan window
(trivial from `loadLogs()` dates) and send **both** numbers — "22 calendar weeks, 9 with
logged training"; add one prompt line: anchor the trend on active weeks when they are
materially fewer than calendar weeks.

### S7. Coach Mode still tells a detrained / long-gap lifter to ADD load — [accuracy]
**Moment:** Lin month 5 and Marcus month 12 (flu) — `coProgressCue` (`:1211`) reads the
last *stored* session, however old, and says "add 2.5 kg today"; the >14-day discount
from the first study's F8 was never built.
**Why it matters:** the most common real event — returning after a break — is where
adding load is most likely to injure or discourage.
**$0 fix:** in `coProgressCue`/`coAdjust`, if the newest log for the exercise is >14 days
old, suppress the add-load cue, prefill placeholders at −10 % and +1 RIR, and show
"long gap — rebuild for 1–2 sessions before adding load."

### S8. Fat-loss stall copy is still deficit-blind (F6 still open) — [accuracy]
**Moment:** Priya month 6 and Lin (any cut) — a lift merely *holding* in a deficit reads
"reduce 10 % if sleep and food are in order," but in a cut food is deliberately not in
order, so the caveat can't land.
**$0 fix:** `stallWatch`/`stallHTML` already have `savedPlan()`; branch the copy on goal
— for fat-loss plans: "holding strength in a deficit is winning; reset only if a lift
*drops* two sessions running."

### S9. Still no off-ramp at goal completion (F7 still open) — [accuracy] [user-friendliness]
**Moment:** Priya months 11–12 — goal reached, still cutting at ~1,470 kcal; no
"Goal reached?" field and no maintenance-transition rule.
**$0 fix:** the first study's one prompt rule (propose the maintenance/reverse-diet
transition in `checkin_review.verdict` when the trend shows the goal is met) plus a
"Goal reached? yes/no" on the check-in form.

### S10. Loop is still 100 % user-initiated; no bodyweight log, no cadence nudge, no re-onboarding prompt (F4 residual) — [user-friendliness]
**Moment:** all five subjects — 60/60 subject-months with zero app-initiated contact;
Lin returns after a gap to a 3-month-old plan with no "recalibrate?" prompt.
**$0 fix:** a passive "Week 4 — check-in ready" banner when
`Date.now() − saved.at > 28 days`, and a "your plan is N months old — recalibrate?"
variant when the newest log is far newer than the plan is old; add a local bodyweight
input + sparkline whose 7-day average prefills the check-in.

### S11. 200-log cap and device-switch data loss unchanged; Sprint 14 fixed isolation, not durability (F5 still open) — [reliability]
**Moment:** Marcus month 11 (cap eviction at 4×/wk — note the sync-merge path caps at
200 too, `:1469`); Lin month 10 (new work phone, no sync account → total loss).
**$0 fix:** raise the cap to 1,000 (logs are ~100 B/session), warn at 90 %, trim to the
best set per exercise rather than whole sessions, and add a one-time post-session-5 nudge
to create a free sync account or use the export button.

---

## Shortlist — top 5 changes for Sprint 15+ (ranked by real-outcome leverage)

1. **Make deloads training-aware, not calendar-aware** (S1 + S3 + S5). Key the clock off
   the last *logged* session; add a >14-day "welcome back — ramp, don't deload" branch;
   fire an immediate deload when ≥2 lifts stall within 7 days; and coordinate both deload
   pathways on one shared `DL_KEY` timestamp. Fixes the worst failures for the two hardest
   users (returner, intermittent) *and* gives advanced lifters the trigger they need.
2. **Make Stall Watch experience- and time-aware, and deficit-aware** (S2 + S8). Scale the
   window by `experience_level`, ignore >21-day gaps, and branch the copy on goal. Kills
   the cry-wolf that erodes trust in the app's main interactive coaching for advanced,
   intermittent, and cutting users alike.
3. **Handle the returning / detrained user everywhere** (S7 + the return half of S1). A
   single >14-day-gap check that suppresses add-load cues, discounts placeholders, and
   swaps the deload card for a rebuild card — the most common real event, currently
   mishandled in three places.
4. **Send active-weeks + historical-gap context so the trend survives intermittency**
   (S6 + S4's digest additions). Compute active training weeks and send both numbers;
   add equipment/`renamed_from` to the digest so rotations stay in-kit and keep their
   log lineage. Stops the systematic over-cutting of the busy/travel segment.
5. **Close the three first-study residuals that still bite real users** (S9 off-ramp +
   S10 cadence nudge / bodyweight log + S11 durability). The goal off-ramp, a passive
   check-in cadence banner, a bodyweight log, and a bigger cap + post-session-5 backup
   nudge — the difference between a plan generator and a coach who stays with you.

*All findings are grounded in the current `templates/trainer.html`, `app.py`, and
`data/trainer_system.txt`; every remaining failure assumes a prompt-compliant model, so
each is a design gap, not a model-quality one. Re-runs and new subjects follow the same
desk-simulation method and physiological baselines documented at the top of this file.*

---

## End-to-end sweep (Sprint 15)

**Team:** SIMULATION · **Date:** 2026-07-26 · **Status:** complete · **Code changed: none**
(read-only sweep; the only edit is this appended section).

### Method & a note on churn

This is a code-path audit, not a subject simulation: every user-facing flow (intake →
follow-up → plan → PDF; the server model chain and `_validate_plan`; the stateful
check-in; Coach Mode; the logger + Stall Watch + Deload autopilot; accounts / sync /
isolation; share / PWA / hash links) was traced against the actual source. The app was
booted locally (`python3 app.py`, port 5000) and the keyless paths exercised
(`POST /api/trainer {"demo":1}` → a full plan; `/api/auth/me`, `/api/sync` degrade
correctly with no `DATABASE_URL`). Account-only paths were reasoned from code.

**Important:** during this sweep `templates/trainer.html` and `app.py` were being edited
concurrently (the file grew ~2091 → ~2250 lines mid-read; a **bodyweight log + `weights`
sync blob** was wired end-to-end — client `loadWeights/saveWeights/weightTrendPerWeek/
renderBw/pushWeights` and server `/api/sync` kind `"weights"` cap 200 KB + `/api/export`).
That closes the long-standing "no bodyweight log" gap (old F4/S10). Because line numbers
shifted under me, findings below cite **function names + approximate current line**; anchor
on the function name if the line has moved. Every discrepancy was re-confirmed against the
*current* file at the moment of writing.

### What the current code has ALREADY fixed (do not re-report)

The Sprint-13/14 code on disk is newer than this doc's earlier Sprint-15 section assumed.
Verified fixed in the live source: **S1/S7 detrained-user handling** — `deloadInfo()`
returns null when the last logged session is >14 days old (welcome-back, no deload), and
`coProgressCue()` emits a "start ~10% below, 2–3 RIR, rebuild" cue instead of "add load"
on a >14-day gap; **S2 (partial)** — `stallWatch()` widens the window to 4 for
advanced/elite and treats sessions >21 days apart as non-contiguous (a layoff is no longer
a stall); **F4 window math** — the computed elapsed-weeks field is live; **bodyweight log**
— now present. New discrepancies below are all confirmed still-open or newly introduced.

---

### FINDINGS (ranked by impact)

#### E1. Allergen defence-in-depth is absent in check-in mode and never covers supplements — [data] (safety)
**Flow:** (a) Week-4 check-in → revised plan. (b) Any plan's Supplements section.
**Where:** `_validate_plan()` allergen scan, `app.py:695-708` — `alg = str((intake or {}).get("allergies",""))` and `food = {k:v for k,v in dp.items() ...}` (scans `diet_plan` only).
**Why it's wrong:** The check-in intake object (`intake()`, checkin branch, `templates/trainer.html:~846`) has **no `allergies` key** (only the plan intake at `:~876` does), and `planDigest()` never carries allergies. So on a check-in, `alg` is empty → the allergen scan is **skipped entirely**, and the model is only told allergens implicitly (if they happen to sit in `safety_notes`). A revised diet that reintroduces a client's allergen ships unchecked. Separately, even in plan mode the scan only walks `diet_plan`; the top-level `supplements[]` array is never scanned — so a **fish**-allergic client's omega-3 "fatty fish / fish oil", or a **dairy/whey** slip for a milk allergy, passes the gate. This is the one class of error where "better a flawed plan than an error page" is the wrong call.
**$0 fix:** carry `allergies` (and `diet_preference`) in `planDigest()` and re-inject them as the `intake` passed to `_validate_plan()` in the check-in path; extend the scan's `hay` to include `data.get("supplements")` and `supplements_excluded_note`. Both are a few lines against existing helpers (`_plan_strings`).

#### E2. Viewing the sample program seeds it as the user's "saved plan" — and it can sync into a real account — [data] [user-friendliness]
**Flow:** Welcome → "See a sample program" (or `?sample`, `?demo=1`, the peek link) → later "Create account".
**Where:** demo seed in `submit()`, `templates/trainer.html:945-948` (`else if (!savedPlan()) { localStorage.setItem(PLAN_KEY, {at, plan: data}); refreshRestore(); }`) + guest-adopt in `pullMerge()`, `:~1644` (`else if (localAt && (!d.plan || ...)) pushPlan()`).
**Why it's wrong:** The stated invariant (comment at `:944`) is "demo-sourced plans must never … reach sync." But the seed writes the demo into `PLAN_KEY` with the **same shape as a real plan and no `demo` marker**. For a fresh visitor this immediately lights up **Restore last plan**, the **Log** tab, **Coach Mode**, and check-in autofill — all pointing at Rohan's sample (24M intermediate). Worse, if that visitor then registers into an empty account, the guest-adopt path calls `pushPlan()` and the **sample program is uploaded as their real plan**, directly violating the "never pushed" promise.
**$0 fix:** tag the seed `{demo:true, at, plan}`; have `savedPlan()`/`pushPlan()`/`refreshRestore()` treat a `demo` plan as "no real plan" (so Restore/Log/Coach stay hidden and it never syncs), or seed a separate `PLAN_DEMO_KEY` that only feeds the on-screen render.

#### E3. Guest data adopts UP into an empty account on a shared browser — cross-account bleed — [data]
**Flow:** Person A builds/uses a plan as a guest (never signs in) on a shared browser → Person B signs into (or registers) an account that has no plan yet.
**Where:** `OS_ACCT.on` handler `:~1660` (`if (owner && owner !== st.user) deviceReset()`) + `pullMerge({adoptGuest: !owner})` → `:~1644` `pushPlan()`.
**Why it's wrong:** Device isolation only fires when a **different owner** was previously stamped. A guest never stamps `trainerOwner`, so `owner` is null, `deviceReset()` is skipped, and `adoptGuest` is true. If B's account is empty, the fallthrough `pushPlan()` **uploads A's guest plan (and merges A's logs) into B's account.** The isolation guard protects only accounts that *already* hold data. On any shared/kiosk browser a guest's program silently becomes the next empty-account signer's program.
**$0 fix:** stamp `trainerOwner = "guest"` (or a random guest id) whenever guest data is first written; then a real sign-in always sees a mismatching owner and `deviceReset()`s before pulling, so guest data is only ever adopted by the very session that created it (or gate adopt on "this browser registered in the last N minutes").

#### E4. The Week-4 check-in tab is never gated — a no-plan check-in becomes a stateless from-scratch plan — [user-friendliness] [accuracy]
**Flow:** New visitor (or anyone with no saved plan) clicks **Week-4 check-in** and fills it in.
**Where:** `#tabCheckin` has no `display:none` and `refreshRestore()` toggles only `#tabLog`; `submit()` checkin branch guards `planDigest()`/`qaLogDigest()` with `if (dg)`/`if (ld)`.
**Why it's wrong:** With no saved plan, `planDigest()`/`qaLogDigest()` return null, `prevForDiff` is null, and the "recalibration" is sent with only the 14 form fields and an empty computed-weeks field — i.e. the exact stateless behavior the stateful check-in was built to kill, but now **mislabeled as a recalibration** with no diff and no continuity. The autofill also silently no-ops.
**$0 fix:** gate `#tabCheckin` on `savedPlan()` exactly like `#tabLog` in `refreshRestore()`; if a user reaches it with no plan, show "Build or restore a plan first — the check-in recalibrates an existing program."

#### E5. A stall-escalation deload logged by hand is counted as a *deeper stall*; the two deload pathways share no clock — [reliability] [accuracy]
**Flow:** Stall Watch (Log tab or Coach summary) says "take the deload," the user deloads and logs it via the **manual Log form** (not Coach Mode).
**Where:** only Coach Mode tags `sess.deload = true` (`coFinish()`, `:~1492`); the manual `logForm` submit has **no deload checkbox** and never sets `.deload`. `stallWatch()` skips `s.deload` sessions (`:~1233`); `deloadInfo()` keys its clock off `DL_KEY`, which only the "I've done my deload ✓" card writes.
**Why it's wrong:** The escalated deload's deliberately reduced loads land as an untagged session → `stallWatch()` reads them as a further e1RM drop → it re-flags the lift, often as the deeper (`s.deep`) stall, telling the user to deload *again*. And because the stall-escalation path never writes `DL_KEY`, a calendar `deloadInfo()` card can still fire a week later → **risk of a double deload** (exactly Subject D month 9). The advice and the detector actively contradict each other.
**$0 fix:** add a "this was a deload week" checkbox to the manual Log form (set `sess.deload`); and whenever the `s.deep` escalation is shown *or* any deload is logged/dismissed, write `DL_KEY = Date.now()` so `stallWatch` and `deloadInfo` read one shared timestamp.

#### E6. Fat-loss stall copy is still deficit-blind — [accuracy]
**Flow:** Any cutting client whose lift merely *holds* for 3 sessions.
**Where:** `stallHTML()`, `:~1259-1269` — the non-deep branch always emits "reduce 10% … and rebuild — if sleep and food are in order," with no goal branch (`stallWatch()`/`savedPlan()` already expose the goal).
**Why it's wrong:** In a deficit, food is *deliberately* not "in order," so the caveat can never land; holding strength while cutting is a **win**, not a loading error, yet the banner prescribes a reset. (Subjects A & E.)
**$0 fix:** branch the copy on `savedPlan().plan.profile_summary.goal`: for fat-loss/recomp, "holding strength in a deficit is winning — only reset if a lift *drops* two sessions running."

#### E7. Periodization triggers still live only in prose: the check-in payload omits deload history, and the loop has no aggregate stall trigger — [accuracy]
**Flow:** Advanced/intermediate lifter; check-in and multi-lift plateaus.
**Where:** `qaLogDigest()` sends `sessions`, `stalls`, `plan_age_days`, `bodyweight` — but **no weeks-since-deload / deload timestamp**; nothing computes an aggregate "≥2 lifts stalled in 7 days → deload now" in the loop (`stallWatch()` returns the list but no caller checks `list.length >= 2`).
**Why it's wrong:** `trainer_system.txt:124-126, 322-326` gives the model two real rules — "deload if 6+ weeks since the last one" and "immediate deload when 2+ lifts stall" — but the check-in can't evaluate the first (it never learns when the last deload was) and the interactive loop never fires the second (the one advanced plateau-lifters need most; Subject D month 11). `deloadInfo` is calendar/train-week only.
**$0 fix:** add `weeks_since_deload` (from `DL_KEY`) and `lifts_stalled_this_week` to `qaLogDigest()`; in `renderLgHist()`, if `stallWatch()` returns ≥2 distinct lifts flagged within the last 7 log-days, surface the existing `deloadHTML` card immediately, independent of the calendar.

#### E8. `age_years` is frozen at plan time and blanked after the first check-in; no original intake is persisted — [accuracy] (safety-adjacent)
**Flow:** Any multi-check-in client, especially 50+/60+ or joint-condition (Subject C).
**Where:** `planDigest()` sends `profile: p.profile_summary` from the *saved plan only*; `trainer_system.txt:144-149` instructs the model to **null** profile fields not re-collected at check-in (height, DOB → hence `age_years` becomes null in the revised plan). No `INTAKE_KEY` is ever written (grep: none).
**Why it's wrong:** Because the digest reads the *last* plan's `profile_summary`, and check-in mode nulls DOB/age, `age_years` degrades to null after the first check-in — so the special-population rules (50+/60+ joint-friendly defaults, power/balance work) can't reliably re-fire for a continuing client, and a client who *crosses* a 50+/60+ boundary mid-journey never triggers them at all. The client's original DOB/height/allergies/equipment exist nowhere durable.
**$0 fix:** persist the original intake once (`localStorage INTAKE_KEY`) and include DOB (or a stable `age_years`), height, allergies and equipment in `planDigest()`; add one prompt line: "carry age/DOB, height, allergies and equipment forward from the digest — do not null them at check-in."

#### E9. Soft-serve can ship an allergen- or macro-failing plan as the last resort — [reliability] [data]
**Flow:** Every Gemini attempt + Groq fail their quality gate but one parsed plan-shaped.
**Where:** `run_model_chain()` keeps `soft["text"] = soft["text"] or text` on a `_validate_plan` failure (`app.py:903`); `groq_fallback()`/`generate()` finally emit `soft["text"]` (`:828, 867`).
**Why it's wrong:** The retained "soft" plan may have failed on `allergen_in_diet`, `macro_math`, or `missing_macros` — and it is then served silently as though valid. For allergen or broken-macro failures specifically, an error page is safer than a wrong plan.
**$0 fix:** don't retain a soft plan whose fail-set includes `allergen_in_diet`/`missing_macros`/`macro_math`; for those, fall through to the friendly error instead of serving the bad payload.

#### E10. Durability & silent sync failures: 200-log cap, `weights` cap, and only 401 is handled on push — [reliability]
**Flow:** ~4×/week for a year; or a large log/weights blob.
**Where:** `logs.slice(0, 200)` in `logForm` submit, `coFinish()`, and the `pullMerge` union (three sites); `pushLogs()/pushPlan()/pushWeights()` handle only `r.status === 401`.
**Why it's wrong:** The cap silently evicts the oldest sessions (moving the all-time-first autofill/adopt baseline), and any non-401 sync failure — notably a **413** when logs exceed 800 KB or weights exceed the new 200 KB cap — is swallowed, so the user believes they are backed up when they are not. No 90% warning, no post-session-5 sync/export nudge exists.
**$0 fix:** raise the log cap to ~1000 and trim to best-set-per-exercise before dropping whole sessions; surface a toast on any non-2xx sync PUT; one-time nudge after the 5th logged session to create a free account or use Export.

#### E11. Lower-severity but real
- **[accuracy] `?demo` in the URL turns a check-in into the static sample.** `trainer_api()` checks `payload.get("demo")` *before* `mode` (`app.py:721`), and the client sets `body.demo` from the URL param for any submit (`:907`). A user on `/trainer?demo=1` who runs a check-in gets Rohan's demo plan back, not a recalibration. Gate `demo` off `mode !== "checkin"` client-side.
- **[data] Same-day backdated logs collide on sync.** The union key is `s.at + '|' + s.day` and a backdated entry's `at` is deterministic noon-of-date (`logForm` submit); two sessions of the same day-type backdated to the same date dedupe to one on the next `pullMerge`. Include an index or entry-hash in the merge key.
- **[accuracy] New bodyweight log anchors `cWeightStart` to the all-time-first weigh-in.** `autofillCheckin()` prefills `cWeightStart` from `loadWeights()[0].kg` (`:~1568`) — the earliest entry ever, not the weight at the current plan's start — so a continuing client's trend divides whole-history weight change by current-block weeks (inflated rate). And `qaLogDigest().bodyweight.measured_trend_kg_per_week` (a 28-day window) can disagree with the form-derived trend, sending the model two conflicting numbers. Anchor `cWeightStart` to the weigh-in nearest `savedPlan().at`.
- **[accuracy] Deload cadence parsing is brittle.** `deloadInfo()`'s regex `/every\s+(\d+)\s*(?:to|-|–|or)?\s*\d*\s*weeks?/i` does **not** match "every 6th week" (the demo's own wording) → falls back to the default 6; "every 4th to 6th week" also misses. Usually harmless (default is sane) but the parse rarely reads the plan's real number. Match `(\d+)(?:st|nd|rd|th)?` and `week` too.
- **[accuracy] Plate math assumes a 20 kg bar** (`BAR_KG = 20`), wrong for 15 kg women's bars, 45 lb (20.4 kg) bars, or fixed/EZ bars — no way to set bar weight in Coach Mode.

### Top 8 to fix for a solid base

1. **E1 — Allergen safety net in check-in mode + over supplements.** Carry `allergies` in `planDigest`, pass it to `_validate_plan` on check-ins, and scan `supplements[]`. Silent, safety-adjacent, cheap.
2. **E2 — Stop the sample program masquerading as a real saved plan / syncing up.** Tag the demo seed and exclude it from Restore/Log/Coach/`pushPlan`.
3. **E3 — Close the guest→empty-account bleed.** Stamp guest data with an owner so a real sign-in resets before pulling; only the creating session adopts guest data.
4. **E5 — Coordinate the two deload pathways and let manual deloads be tagged.** One shared `DL_KEY`; a "deload week" checkbox on the Log form. Stops the deload→deeper-stall→double-deload loop.
5. **E4 — Gate the check-in tab on a saved plan.** A recalibration with nothing to recalibrate is a UX trap and a stateless regression.
6. **E7 — Put the periodization triggers into the loop and the payload.** `weeks_since_deload` + `lifts_stalled_this_week` in the digest; an aggregate ≥2-lift deload card.
7. **E8 — Persist the original intake; keep age/allergies/equipment across check-ins.** Special-population and continuity rules depend on facts that currently evaporate after check-in 1.
8. **E6 — Make the fat-loss stall copy deficit-aware.** One goal branch in `stallHTML` removes a recurring wrong-and-discouraging banner for every cutting client.

*Grounded in the current `templates/trainer.html`, `app.py`, `data/trainer_system.txt` and
`static/os.js` (and `static/trainer/sw.js`, `manifest.json`) as read on 2026-07-26 while
those files were under active concurrent edit; findings assume a prompt-compliant model, so
each is a design/logic gap, not a model-quality one. Line numbers are approximate — anchor on
the named functions.*
