# The Voice merge: The Trainer becomes FUNFLIX's front door (2026-09-24)

Owner ask: merge the Voice prototype (the private Artifact) into FUNFLIX, with The
Trainer as the flagship and the new idea taking over, while every existing
technicality and every piece of the Trainer's research stays intact, and the whole
system adapts.

Branch: `voice-merge`. **Not deployed.** Shipping is one owner go-ahead away (see
"How to ship").

## The shape of it

| Surface | Before | After |
|---|---|---|
| `/` | `funflix.html`: an 8-app collection, Trainer as one card | `home.html`: the Voice landing. A coach hosts the page; five questions load a barbell; the answers hand off to the real app |
| `/trainer` | "Instrument No. VIII", paper and acid green, light only | Same engine, same features. Voice type, cobalt, a header that speaks per state, a dark mode for the whole app (Coach Mode included) |
| Shared chrome (`os.css` / `os.js`) | FUNFLIX wordmark, 9 inline links, translucent blurred bar | THE TRAINER by Funflix wordmark, one flagship link, an Apps menu, a solid bar, the theme switch on pages that opt in |
| Other apps | FUNFLIX look | Same apps, same interiors, the house tokens and header (Compute, Synthesis, The Press, The Study); the games keep their own worlds |

The rest of the house stays one tap away from every page: the home nav, the Apps
sheet, the footer, the Apps menu in the shared bar, and ⌘K.

## The handoff (landing to app)

1. The five answers (name, goal, experience, kit, days, the why) live only in the page
   until the visitor presses **Open your Trainer**.
2. That click writes `sessionStorage.trainerHandoff = {v:1, name, goal, exp, kit, days, why, at}`.
   sessionStorage is scoped to the tab and gone when it closes. Nothing goes to the server.
3. `/trainer` reads it (fresh for 6 h), maps each answer onto the real intake options,
   marks those fields "✓ kept", skips the welcome, and says: *Right, Maya. Four facts and
   I write it.* The only required facts left are the ones the energy maths needs:
   date of birth, sex, height and weight (Mifflin-St Jeor).
4. A **real** plan consumes the handoff (`clearHandoff()` in the non-demo branch). A
   sample never does. **Not you? Start blank** wipes it and the fields it filled.
5. The handoff never runs when the URL carries `?sample`, `?demo` or a fragment (shared
   plan, history), so a shared link is never overwritten by leftover answers.

Guardians notes: the landing writes nothing to localStorage except the theme choice.
The form's privacy line was corrected: the answers do go once to the AI model that
writes the plan (they are not stored on our server). The old line said nothing left
the device, which was not true.

## The research, kept and surfaced

The engine's rulebook (`data/trainer_system.txt`) is the source of truth, and the
landing now says only what the engine actually does:

| Landing fact | Engine rule | Source cited |
|---|---|---|
| Every muscle twice a week; 2-3 days full body, 4 upper/lower | Split selection, no bro splits | Schoenfeld, Ogborn & Krieger, 2016 |
| Protein plateaus near 1.6 g/kg, 2.2 upper end, higher when cutting | Diet construction | Morton et al., 2018, BJSM (49 trials) |
| Double progression: +2.5 kg upper, +5 kg lower | Progressive overload | the Trainer's log |
| Beginners gain about 0.6-1% of bodyweight a month | Calorie targets by goal | checked at the week-4 check-in |
| Fat loss is a 400-500 kcal deficit, 0.5-1%/wk | Calorie targets by goal | Mifflin-St Jeor, corrected every 2 weeks |
| Under 6.5 h sleep starts you at the bottom of the volume band; creatine 3-5 g is the strong-evidence supplement | Recovery modulation, supplement whitelist | ISSN position stand (Kreider et al., 2017) |

Corrections this forced on the prototype: protein was "your bodyweight in grams"
(1 g/kg in kilo terms, about 40% under the engine's floor); fat-loss sets were "rest
sixty seconds, keep the heart rate up" (the engine trains a cut hypertrophy-style
with 2-5 minute rests); five days drafted a push day (the engine writes
upper/lower/push/pull/legs); beginners were told 3-4 reps in reserve (engine: 2-3).
`tests/test_voice_merge.py` pins the landing and the rulebook together so they
cannot drift apart silently.

The Study (`/study`, supplement evidence) sits next to the Trainer in every menu,
and the landing's facts link to it for the raw evidence.

## The design system

- **Tokens** (`static/os.css`): paper `#F6F7FB`, card `#FFFFFF`, ink `#0B0F2E`,
  text `#2D314B`, cobalt `#2B3BFF`, periwinkle `#8C9BFF`, semantic warm/amber/danger
  kept separate from the accent. A full dark set under `:root[data-theme="dark"]`.
- **Opt-in dark:** a page gets the dark set and the switch by adding
  `<html data-themeable>` plus the bootstrap script (same `trainerTheme` key as
  home). Home and the Trainer opt in; the utility apps stay light for now.
- **Type:** Bricolage Grotesque (display), Geist (body), Geist Mono (labels, data),
  self-hosted variable fonts in `static/fonts/` (one file per family, OFL-1.1, cached
  a week). No Google Fonts request on the Voice pages. No synthesized italics.
- **Chrome:** solid bars only (the owner's "the bar is translucent" note); the
  translucent HUD and palette scrim are gone.
- **The PDF** is always ink on white, whatever the screen theme.
- **PWA:** new icon (the landing's weight plate, white on cobalt), manifest copy,
  service worker cache `trainer-v4` with the fonts precached for the gym.

## Copy

- No em-dashes on any surface the merge touched: home, the Trainer (UI, error
  messages, the plan renderer), the shared chrome, the four utility apps, the
  server's user-facing messages and emails, the service worker, the manifest, and
  CLAUDE.md. Both engine prompts carry an explicit "no em-dashes" rule (and their
  own em-dashes were re-punctuated, since the model imitates the prompt). The plan
  renderer re-punctuates any em-dash the model still slips in.
- Not yet done: the games' narrative text (Flyuserfly, Costa Vista, The Fly), about
  550 em-dashes in story copy and code. THE FLY runs its own overhaul process, so
  this is left for that track (tab titles were fixed).

## Verification

- pytest: 151/151 (9 new in `tests/test_voice_merge.py`).
- `qa/site_qa.py`: 32/32 (homepage, Trainer tabs, demo plan, share links, log,
  check-in autofill, sample privacy, Coach Mode, PWA).
- `qa/voice_qa.py`: 18/18 (the handoff end to end, storage discipline, Start blank).
- All 8 apps console-clean with no horizontal overflow at 1280 and 390.
- WCAG contrast: 0 failures on the Trainer, the sample plan, the account modal, the
  Apps sheet and 4 utility apps, light and dark. The home nav reads as 4 checker
  flags only because the checker cannot see the cobalt hero behind a transparent
  bar; the real ratio is 6.6:1.
- Full-motion first visit: intro veil, crush scrub, the traveling plate, the nav
  tucking away on scroll, no errors at 1440 and 390.

## How to ship

1. Owner go-ahead.
2. `git checkout main && git merge --no-ff voice-merge && git push` (Render deploys `main`).
3. `python3 scripts/verify_live.py --wait-for <sha>`, then open `/` and `/trainer` cold
   and signed out (Guardians rule), then signed in.
4. Optional, costs quota: one real `/api/trainer` plan to confirm the re-punctuated
   prompt still returns a valid plan (tests mock the model; the change is punctuation
   only).

Still pending (owner, free, unchanged): `GMAIL_USER` + `GMAIL_APP_PASSWORD` on
Render for real OTP email (`docs/trainer/EMAIL_SETUP.md`).
