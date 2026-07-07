# CLAUDE.md — Game Overhaul Worktree (READ FIRST)

> **This folder is a dedicated `git worktree` for THE FLY craft overhaul.**
> It is pinned to the branch **`overhaul/craft`** and must stay there.

## Branch rule — non-negotiable

- **Work ONLY on `overhaul/craft` in this worktree.** Never run `git checkout main`,
  `git switch`, or check out any other branch here.
- A **separate** working directory (`../calculator_web`) has another Claude session
  actively rebuilding the Funflix **website** on `main`. That is expected and is not a
  rogue process — it's the user, running both halves of the product in parallel.
- The two worktrees share one repo and one history but have **independent checkouts**.
  Switching branches in this folder is what used to drag the game work onto `main`
  mid-sprint. Do not do it.
- If you ever find this worktree is not on `overhaul/craft`: **stop, do not commit,
  and tell the user.** Do not "fix" it by switching branches or moving pointers.

## Same product, one repo — this is correct

THE FLY is embedded inside the Funflix website; game and site are one product in one
repo. Do **not** propose splitting the game into its own repo. When the overhaul is
ready to ship, it merges `overhaul/craft → main` as a single deliberate merge — the
user decides when.

## Everything else

The full plan, sprint gates, art bible reference, and guardrails live in
`docs/overhaul/OVERHAUL_BRIEF.md` and the repo-root `CLAUDE.md`. This note only adds the
worktree/branch isolation rule on top of those.

---

# CLAUDE.md — THE FLY

> Ground-truth reference for anyone (human or agent) working on this repo.
> Claude Code reads this automatically at the start of every session.
> **The plan lives in `docs/overhaul/OVERHAUL_BRIEF.md`. This file is the facts:
> where things are and how to run/test them.**

---

## Project

**THE FLY** — a cozy 3D cel-shaded courier/delivery game, browser-based (desktop + mobile touch),
built on Three.js, served via Flask, deployed to Render. The full delivery loop, economy, seasons,
festivals, narrative, districts, and living-town AI already work end-to-end. Active overhaul focus:
**craft quality** (art, animation, audio, UI, writing) — not new systems.

Note: this Flask app (`calculator_web`) hosts several small games/tools (a calculator, "funflix",
"journalist", "lab", "meme"), not just THE FLY. THE FLY is the `/play/*` routes backed by
`templates/town.html` + `static/town/*.js`.

---

## How to run locally

```bash
# install deps
pip install -r requirements.txt

# run the Flask dev server
python app.py
# (runs app.run(debug=True) — see app.py:229; default Flask port 5000)

# then open
http://127.0.0.1:5000/play/the-fly
```

Production runs via gunicorn (see `Procfile`): `gunicorn app:app`. The QA scripts default to
ports in the 5057–5070 range, so if you boot the dev server on a non-default port, pass that base
URL as the script's first argument (see below).

### Other THE FLY routes (all served from the same Flask app)
- `/play/the-fly` → `templates/town.html` — **current/main build** (the one described here)
- `/play/the-fly-classic` → `templates/the_fly.html` — earlier standalone build
- `/play/city-game` → `templates/fly.html` — earlier build, also what `qa/harness.py` targets by default
- `/play/town-slice` → `templates/town_slice.html` — a slice/prototype variant
- `/play/town` → `templates/town.html` — alias of the main build

---

## How to test

There is no `npm`/`package.json` or `pytest` suite — the "Playwright harness" is a set of standalone
Python scripts in `qa/` that boot the game in headless Chromium via `playwright.sync_api`, exercise
it, capture screenshots into `qa/shots/`, and write a JSON report.

```bash
# 1. start the app in one terminal (pick a port matching the script's default, or pass it explicitly)
python app.py

# 2. run a QA script against it, e.g.:
python qa/harness.py [base_url]        # default http://127.0.0.1:5070, targets /play/city-game
python qa/town_qa.py [base_url]        # default http://127.0.0.1:5057, targets /play/the-fly
python qa/town_loop.py [base_url]
python qa/town_econ.py [base_url]
python qa/town_controls.py [base_url]
python qa/town_fun.py [base_url]
python qa/town_harbor.py [base_url]
python qa/town_hill.py [base_url]
python qa/town_rival.py [base_url]
python qa/town_sprint3.py [base_url]
python qa/town_vignettes.py [base_url]
```

Each script writes/updates a report (e.g. `qa/last_report.json`) and screenshots under `qa/shots/`.
`qa/harness.py`'s header notes headless Chromium uses SwiftShader (software WebGL), so its FPS
number is a **regression floor, not a real-GPU number** — treat large drops as meaningful, not the
absolute value.

The QA gate for the overhaul depends on these scripts passing (no console/page errors, expected DOM
markers present, screenshots captured). Never commit with a red run.

---

## Tech stack

- **Engine:** Three.js **r0.128.0**, classic global (non-module) build, loaded from jsDelivr CDN in
  `templates/town.html` (no CapsuleGeometry available at this version — see `static/town/lib.js`
  header). Post-processing via the matching r128 `examples/js/postprocessing` + `shaders` addons
  (EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, CopyShader,
  LuminosityHighPassShader, GammaCorrectionShader, UnpackDepthRGBAShader,
  DepthLimitedBlurShader) and `BufferGeometryUtils` for static-geometry batching.
- **Server:** Flask, entry file `app.py` (`app = Flask(__name__)`; routes for THE FLY around
  `app.py:38-51`). Served in production by gunicorn (`Procfile`: `web: gunicorn app:app`).
- **Deploy:** Render, continuous (every tested feature committed and pushed live).
- **Rendering:** custom cel-shading + ink-outline post-processing pipeline (built in `game.js`'s
  composer setup; no separate shader file yet — see Sprint gates in `OVERHAUL_BRIEF.md` for the
  planned upgrade).
- **World gen:** deterministic, seeded (see `world.js`).

---

## Repo structure

```
calculator_web/
├── app.py                     # Flask app + all routes (THE FLY + other mini-apps)
├── requirements.txt           # flask, gunicorn, google-genai, certifi
├── Procfile                   # gunicorn web process for Render
├── CLAUDE.md                  # this file
├── docs/
│   └── overhaul/
│       └── OVERHAUL_BRIEF.md  # the craft-overhaul production plan
├── templates/
│   ├── town.html              # THE FLY — main build (/play/the-fly, /play/town)
│   ├── the_fly.html           # THE FLY — classic build (/play/the-fly-classic)
│   ├── fly.html               # THE FLY — earlier build (/play/city-game)
│   ├── town_slice.html        # THE FLY — slice/prototype (/play/town-slice)
│   ├── funflix.html           # unrelated: site home ("/")
│   ├── index.html             # unrelated: calculator ("/calculator")
│   ├── game.html              # unrelated: "/game"
│   ├── journalist.html        # unrelated
│   ├── lab.html                # unrelated
│   └── meme.html               # unrelated: "/meme"
├── static/
│   ├── os.css / os.js         # unrelated site chrome
│   └── town/                  # THE FLY client source (loaded in this order by town.html)
│       ├── ARTBIBLE.md        # existing art-direction notes (predates OVERHAUL_BRIEF's ART_BIBLE.md ask —
│       │                      #   Sprint 0's Art Director should reconcile/extend this file, not ignore it)
│       ├── lib.js             # shared foundation: THREE alias, math helpers, shared materials/textures
│       ├── buildings.js       # building factories
│       ├── props.js           # prop factories (street furniture, foliage, decor)
│       ├── characters.js      # hero + NPC factories, animation/pose logic (C.makeHero / C.makeFly)
│       ├── world.js           # seeded world/town layout, districts, static batching
│       └── game.js            # playable layer: controls, chase camera, delivery loop, HUD wiring,
│                               #   synth audio, particle FX, economy/festival/narrative systems
├── qa/                         # Python/Playwright QA harness (see "How to test" above)
│   ├── harness.py              # generic boot-cleanliness/perf/feature-marker harness
│   ├── town_qa.py, town_loop.py, town_econ.py, town_controls.py, town_fun.py,
│   │   town_harbor.py, town_hill.py, town_rival.py, town_sprint3.py, town_vignettes.py
│   ├── drive.py, night.py      # additional drive/scenario scripts
│   ├── last_report.json        # most recent harness.py report
│   ├── scoreboard*.md, backlog.md
│   └── shots/                  # screenshots written by QA scripts
├── studio/
│   └── STUDIO.md, backlog.md   # misc production notes (unrelated project area)
├── analysis/ , data/            # unrelated: calculator's supplement-analysis feature
```

Conceptual module layering (`lib → buildings → props → characters → world → game`) maps directly to
the load order and file names in `static/town/`: `lib.js → buildings.js → props.js → characters.js →
world.js → game.js`, exactly as `<script>`-included in `templates/town.html`.

Key entry points:
- **Server entry:** `app.py` — route `@app.route("/play/the-fly")` → `the_fly()` → renders
  `templates/town.html` (`app.py:43-44`)
- **Client bootstrap / main scene:** `templates/town.html` (script includes + inline bootstrap that
  builds the renderer/scene/camera/composer and calls into `FLY.world` / `FLY.game.start`)
- **Client main scene logic:** `static/town/game.js` (`FLY.game.start(ctx, world)`); world layout in
  `static/town/world.js`
- **Asset loading:** none yet — all geometry is code-composed (primitives, custom BufferGeometry) in
  `lib.js`/`buildings.js`/`props.js`/`characters.js`. A GLTF asset-loading pipeline is Sprint 0's
  deliverable in `docs/overhaul/OVERHAUL_BRIEF.md`.
- **Shader / post-processing pipeline:** built inline in `static/town/game.js` using the r128
  EffectComposer/UnrealBloomPass/ShaderPass stack included in `templates/town.html`; there is no
  standalone shader module yet (planned under the Rendering & Shader Agent in the overhaul brief).
- **Test harness:** `qa/*.py` (Playwright, headless Chromium) — see "How to test" above.

---

## Guardrails (apply to every change)

- **Never break the working loop.** Delivery, economy, seasons, festivals, narrative, districts, and
  living-town AI must keep functioning. Run the test harness before every commit.
- **Performance budget:** stable 60 fps desktop / ~30+ fps mid-range mobile. Watch draw calls (keep
  static batching), triangle count, texture memory, shader cost. Pair every visual change with a perf
  measurement. Budget regressions are blockers.
- **Licensing:** only CC0 / clearly permissive assets, audio, fonts, icons. Record every import's
  source + license in `ASSETS_CREDITS.md`. No copyrighted characters, logos, or music.
- **Small, tested commits. Keep the game live at all times.**
- **Respect the seeded/modular architecture.** You may propose upgrading Three.js or adding a GLTF
  pipeline — propose and migrate cleanly, don't surprise-break it.
- **Every sprint produces before/after evidence** (fixed-camera, fixed-seed screenshots + perf
  numbers) in `docs/overhaul/sprint-N/`.

---

## Current work

Follow `docs/overhaul/OVERHAUL_BRIEF.md`. Work sprint by sprint. Do not advance past a sprint's QA
gate until it is green with committed evidence. **Start with Sprint 0 only** (Art Bible + tooling +
baseline) and report back before touching the Hero Block.
