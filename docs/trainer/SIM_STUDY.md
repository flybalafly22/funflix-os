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
