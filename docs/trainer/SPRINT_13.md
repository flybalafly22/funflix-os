# Sprint 13 — Deload Autopilot & Honest Progress

**Source:** SIMULATION finding #2/#3 cluster + R&D LAB idea 3 and finding 7.
Marcus went a whole simulated year without a deload while Stall Watch chanted
"reduce 10%" forever; double-progression lifters get flagged as stalled while
progressing exactly as prescribed; Coach Mode never says "add 2.5 kg today";
mid-session heavy compounds get no warm-up ramp; rough-recovery days show a
banner saying "RIR 3" next to a target line still reading "RIR 1-2".
All fixes are deterministic client JS on existing data — $0, no API calls.

## Scope & acceptance criteria

1. **Deload autopilot.** Derive the deload cadence from the plan (parse
   progressive_overload.deload / duration_and_paths for a week number, default
   6) and plan age; during a due week show a deload card (Log tab + Coach
   Mode) and have Coach Mode prescribe halved sets with a -15-20% load note.
   A "done" dismissal (localStorage) resets the clock.
   *Accept: aged saved plan triggers the card and halved coach sets;
   dismissing resets; young plans show nothing.*
2. **Stall Watch judged by e1RM.** Sessions compare by best Epley e1RM across
   sets (with total-reps-at-top-weight as tiebreak), so rep progress at a
   fixed top weight counts as progress. After 2 consecutive stall flags on
   the same lift, escalate the advice from "reduce 10%" to the plan's own
   deload language.
   *Accept: the double-progression false-positive case no longer flags;
   a true stall still does.*
3. **Coach Mode progression cues.** When the last logged session for the
   exercise hit the top of its rep range on all sets, the coach says
   "add 2.5 kg (upper) / 5 kg (lower) today"; otherwise "beat a rep".
   Warm-up ramps render for every barbell-pattern exercise, not just the
   first. Readiness adjustment overrides the displayed RIR ("RIR 3 today").
   *Accept: browser-scripted session shows the cue, a mid-session ramp, and
   the overridden RIR under a bad-readiness answer.*
4. **Prompt agreement.** Add R&D 6b deload triggers to the full prompt so
   plan text and UI tell the same story (compact prompt already carries the
   cadence rule).
5. **Luxury + both viewports** — standing mandate.

## Outcome — CLOSED 2026-07-19, all scope shipped

- Deload autopilot live: cadence parsed from the plan's own deload text
  (clamped 4-8, default 6), clock runs from plan age or last dismissal;
  due week shows the acid-green deload card in the Log tab and Coach Mode
  halves sets with a banner ("this week is what makes next month's PRs
  possible"); "I've done my deload ✓" resets the clock.
- Stall Watch is now honest: sessions compared by best Epley e1RM with
  total-reps tiebreak — the double-progression false positive (reps up at
  fixed weight) no longer flags; true stalls still do; a 4th flat session
  escalates from "reduce 10%" to the plan's deload language.
- Coach Mode coaches: progression cue per exercise ("top of range on every
  set last time — add 2.5/5 kg today" or "beat a rep"), warm-up ramps on
  every barbell lift instead of only the first, and rough-recovery days
  override the displayed effort target to "RIR 3 (today)" so the number
  agrees with the banner. All deterministic client JS, $0.
- Prompt: R&D 6b deload triggers added (2+ lifts stalling in a week, or
  soreness + falling motivation → immediate deload) so plan text and UI
  tell one story.
- QA: 14-check scripted browser pass (false-positive case, true stall,
  escalation, aged/young plan, dismissal reset, halved sets, RIR override,
  mid-session ramp, add-load cue), pytest 77/77, site_qa 29/29.
  Landmine logged: innerText applies CSS text-transform — assert
  case-insensitively on uppercased UI.
