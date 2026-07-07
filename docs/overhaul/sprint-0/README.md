# Sprint 0 — Foundation & Art Bible — QA Gate Report

**Status: GATE GREEN ✅** (pending Producer sign-off)
Date: 2026-07-07 · Build: `/play/the-fly` (`templates/town.html`) · Seed: `20240617` (deterministic)

Sprint 0 sets the standard and stands up tooling; it ships **no visible gameplay
change**. Default play (`/play/the-fly`) is byte-for-byte unchanged — every addition
is additive and guarded.

---

## Gate criteria vs. evidence

| Gate criterion | Result | Evidence |
|---|---|---|
| Art Bible approved | ✅ produced | `/ART_BIBLE.md` (canonical); old `static/town/ARTBIBLE.md` reconciled + banner-linked |
| Pipeline loads ≥1 real GLTF in-game | ✅ | `gltf_pipeline.probeInScene=true`, 1 mesh, `MeshToonMaterial`, 0 errors; see `gltf_probe_desktop.png` |
| No perf regression from the pipeline | ✅ | probe is flag-gated (`?gltf=1`) + loads post-batch = +1 draw only when requested; default play unchanged |
| Baseline evidence committed | ✅ | 7 screenshots + `baseline_perf.json` in this folder |
| Working loop intact | ✅ | 0 console/page errors on boot at both viewports; delivery HUD/jobs/minimap all live in shots |
| Licensing recorded | ✅ | `/ASSETS_CREDITS.md` (probe = CC0) |

---

## Baseline perf (fixed plaza pose, seed 20240617)

| Device | Viewport / DPR | FPS* | Scene draw calls† | Triangles | Geometries | Textures (~MB) |
|---|---|---|---|---|---|---|
| Desktop | 1280×720 / 1.5→1‡ | ~33 | 3621 | 768,816 | 4392 | 329 (~66 MB) |
| Mobile  | 390×844 / 2.0→1.5‡ | ~46 | 2254 | 676,588 | 2377 | 183 (~66 MB) |

**Static batching:** `23,296 static meshes → 452 merged draws` (the town's core perf
mechanism; verified working).

\* **FPS is a SwiftShader software-render FLOOR, not GPU-accurate** — headless
Chromium has no GPU here. Treat it as a regression signal only; real-device fps is
much higher. †Scene draw calls = one beauty pass; **per-frame total is ~2–3×** (adds
the shadow-map pass and the ink-outline normal/depth pass). Draw-call counts are
view/aspect-dependent (wider desktop frustum sees more town than the tall mobile one).
‡ The in-engine adaptive governor drops pixel-ratio under load (working as designed).

Regenerate anytime: `python qa/baseline_sprint0.py http://127.0.0.1:5099`
(app: `python app.py` — but run non-debug so templates aren't cached, e.g.
`python -c "from app import app; app.run(port=5099)"`).

---

## Screenshots (fixed-camera, fixed-seed)
- `baseline_plaza_{desktop,mobile}.png` — aerial 3/4 over the plaza + fountain + clock tower.
- `baseline_street_{desktop,mobile}.png` — elevated 3/4 down the main avenue (landmark clock tower, domes, crossings).
- `baseline_shop_{desktop,mobile}.png` — the shopfront row (Bakery/Florist/Bookshop/Clockmaker) from the avenue.
- `gltf_probe_desktop.png` — the loaded GLTF crate floating above town, cel-shaded + ink-outlined + curved (pipeline proof).

Each re-captures deterministically. These are the **before** side for every future
sprint's diff.

---

## What shipped in Sprint 0
**Docs / standard**
- `ART_BIBLE.md` (root, canonical) — documents the *actually-shipped* flat-teal
  "Messenger paper" look: the four stacked systems (cel ramp, ink outline,
  tiny-planet curvature, paper grade), the shipped palette, **per-season ramps**,
  **time-of-day mood ramp**, **explicit ink-outline logic**, proportion rules, the
  asset-pipeline contract, and a PR cohesion checklist. Reconciles the older
  golden-hour `static/town/ARTBIBLE.md` (kept for its still-valid cohesion *rules*).
- `ASSETS_CREDITS.md` — license ledger.

**Pipeline / tooling**
- `static/town/assets.js` → `FLY.assets` — GLTF `load` / `reskin` (re-materials to the
  cel `std()` chokepoint so curvature + ink + banding apply) / `prep` (static-batching
  contract) / `place` / `manifest`. Fully guarded; town runs without it.
- `tools/blender_export.py` — headless Blender (`bpy`) authoring/export path (GLB, y-up,
  triangulated, transforms applied, Draco off). Authored + documented; **not executed
  here (Blender not installed in this sandbox)** — run where Blender is available.
- `tools/gen_gltf_box.py` — zero-dependency valid-GLB generator → `static/town/assets/crate.glb`,
  so the loader is provable without Blender/Node/network.
- `templates/town.html` — additive, guarded: GLTFLoader + `assets.js` includes; a
  `window.__QA_FREEZE` camera hook (inert in play, used for fixed-camera capture);
  a flag-gated (`?gltf=1`) probe loader. **No change to default play.**
- `qa/baseline_sprint0.py` — the baseline harness (screenshots + perf + GLTF verify).

---

## Findings for the Producer — RESOLVED (2026-07-07)
1. **Walk-in shop interiors → OUT OF SCOPE.** The build is an exterior town (shops are
   storefronts at z≈±13, no enterable rooms); interiors would be a net-new *system*, and
   this overhaul is craft, not systems. Sprint 1 hero slice is reworked to **exterior-only**
   (plaza + one adjoining street + one hero **storefront exterior**); the "1 interior" /
   "7 interiors" gate items are removed from Sprints 1–2 and **deferred** to a separate
   future decision. (Brief updated §2, §5.)
2. **Teal is the north star → CONFIRMED.** The root `ART_BIBLE.md` (flat-teal Messenger)
   is canonical; the old golden-hour `static/town/ARTBIBLE.md` stays historical. Sprint 1
   grades to teal.
3. **Perf = relative regression signal only.** SwiftShader/headless fps is not GPU-accurate;
   the Producer supplies real-device desktop + mobile fps to anchor the 60/30 budget. The
   harness (`qa/baseline_sprint0.py`) is ready to run against any host.

---

**Gate: ACCEPTED by Producer (2026-07-07).** Sprint 1 (exterior-only Hero Block) is
**not** started — awaiting (a) Producer confirmation the working tree is clean after the
parallel-process cleanup, then commit/reconcile of Sprint 0 work, and (b) explicit go.
