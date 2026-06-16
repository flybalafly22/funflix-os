# Costa Vista → Stylized Art-Direction loop (cycle 3) — scoreboard

Studio: **Meridian Interactive** (20-role studio, see `studio/STUDIO.md`).
Inspiration: **abeto _Messenger_** — art-directed restraint (outlines, posterized cohesion,
gradient atmosphere, animated UI), not realism.
Rubric: 0–10 each, where a *cohesive stylized open-world* (Messenger/Sable-class direction) = 10.
**Stop when** avg ≥ **8.8**, OR a sprint gains **< 0.2**, OR **6 sprints** done.

| Dimension                       | Base | S1 | S2 | S3 | S4 | S5 | S6 |
|---------------------------------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Art-direction cohesion ★        | 7  | 8  | 9  | 9  | 9  | 9  | 9  |
| Atmosphere & sky/fog            | 7  | 8  | 8  | 8  | 8  | 8  | 8  |
| Stylization / signature look ★  | 5  | 6  | 8  | 9  | 9  | 9  | 9  |
| Materials & surfaces            | 8  | 8  | 8  | 9  | 9  | 9  | 9  |
| Lighting mood                   | 8  | 8  | 8  | 8  | 8  | 8  | 8  |
| Controls & camera feel          | 8  | 8  | 8  | 8  | 8  | 8  | 9  |
| World detail & district variety | 8  | 8  | 8  | 8  | 8  | 8  | 8  |
| UI / first-impression polish    | 6  | 6  | 6  | 6  | 6  | 8  | 8  |
| Character & expression          | 5  | 5  | 5  | 6  | 8  | 8  | 8  |
| Performance (auto)              | 9  | 9  | 9  | 9  | 9  | 9  | 9  |
| Stability (auto)                | 9  | 9  | 9  | 9  | 9  | 9  | 9  |
| **Average**                     | **7.3** | **7.5** | **7.8** | **8.1** | **8.3** | **8.5** | **8.5** |

★ = the dimensions the _Messenger_ thesis most directly targets (where the realism path left the most headroom).

## S1 — Art-direction foundation (Δ +0.2) — gates: renders ✅ · 0 console ✅ · 0 page ✅ · load 4.3s ✅ · 60fps ✅ · drive 0 errors ✅
- **S1.1 posterize/toon-band knob** in GradeShader: luma quantized into 7 soft bands (hue/chroma
  preserved via the `ratio` rescale), 2×2 ordered dither on the band edge to kill 8-bit stepping,
  blended by `uStylize=0.30` (a taste knob, not a switch). Zero new passes → zero perf cost.
- **S1.2 gradient atmospheric sky dome**: ShaderMaterial inverted sphere, zenith→warm-horizon,
  horizon tracks the day/night sky colour (== fog) so the fogged city melts into the sky.
  Linear-space output (`convertSRGBToLinear`) to brightness-match r128's composer buffer.
- R&D agent delivered the full r128 stylization library (outline/posterize/sky/rim/grade) — feeds S2.
- Rim-light deferred into S2 (it coincides with the outline on silhouettes — they pair).

## S2 — The signature silhouette outline (Δ +0.3) — gates: renders ✅ · 0 console ✅ · 0 page ✅ · load 4.1s ✅ · 60fps(proxy) ✅ · drive 0 errors ✅
- **S2.1 depth-Laplacian OUTLINE post pass** (the headline): crisp dark ink lines on every
  silhouette (cars, trees, buildings, props) = the Sable/Messenger read. Depth-only Laplacian
  on a **separate half-res depth target** (so the composer's own depth is never sampled-while-
  written → no feedback), inserted BEFORE bloom so lines stay sharp. `depthWrite:false` sky/
  sprites/glows stay out of the depth target → no spurious lines; sky + far distance skipped
  for a calm horizon. Tuned to strength 0.9 / thick 1.3 / thresh 0.0012 — clearly inked, not noisy.
- Live tuning hooks added to the `?qa=1` bridge: `setOutline`/`setStylize`/`gfx` (inert in play).
- A/B verified (ab_off vs ab_on captures): outline fires on silhouettes only, sky clean.
- **HONEST perf caveat:** the outline adds one extra half-res scene render/frame (desktop-only,
  like the whole composer). Held 60fps on the M3 test rig; the fps proxy can't measure GPU cost,
  so Performance stays 9 *pending real-hardware confirmation*. Rolls back to the no-composer path
  on touch automatically. (Rim-light pushed to S3 — one big shader change per sprint to stay bisectable.)

## S3 — Lean-in stylization + material finish (Δ +0.3) — gates: renders ✅ · 0 console ✅ · 0 page ✅ · 60fps(proxy) ✅ · drive 0 errors ✅
User direction: **"lean in harder"** on the Messenger/Sable look. Delivered globally + on hero mats:
- **Stronger cel**: posterize uStylize 0.30→0.45, bands 7→5 (clearer flat tone steps).
- **Heavier ink**: outline strength 0.9→1.0, thick 1.3→1.5, thresh 0.0012→0.0010, darker line.
- **Flatter palette**: grade saturation 1.19→1.10, contrast 1.13→1.15 (illustrated, serene).
- **Fresnel rim-light** (`addRimLight`, non-destructive `onBeforeCompile` at `<output_fragment>`):
  soft silhouette edge glow on car/bike paint + the player; coincides with the ink outline and
  feeds bloom → premium edge. Player-only on humans (gated) so pedestrian crowds don't recompile.
  - Bug found + fixed in QA: injected `transformed` at `<defaultnormal_vertex>` (before it's
    declared) → vertex compile error; moved the injection to `<begin_vertex>`. Verified 0 errors.

## S4 — Character & expression: emote system (Δ +0.2) — gates: renders ✅ · 0 console ✅ · 0 page ✅ · load 4.2s ✅ · 60fps(proxy) ✅ · drive 0 errors ✅
- **Procedural emote system** (Messenger's emoji communication): tap **1–4** → a canvas-drawn
  emoji (🙂 / ❤ / 😎 / 😂) springs in above the player (or the car when driving), floats up and
  fades. Billboarded sprite, depth-test off so it reads like a UI bubble, no external assets.
- Verified on foot AND in-vehicle (positions via `focusPos()`); `?qa=1` `emote(i)` hook added.
- Character silhouette already lifted in S2/S3 (ink outline + rim glow); this adds the expression layer.
- 1–4 discoverability hint to be surfaced in S5's UI pass.

## S5 — UI & first-impression (Δ +0.2) — gates: renders ✅ · 0 console ✅ · 0 page ✅ · load 4.3s ✅ · 60fps(proxy) ✅
Messenger's UI animates every detail. Added (pure-CSS, zero gameplay risk + one tiny JS pop):
- **Title/overlay entrance**: box springs up (cubic-bezier), eyebrow→title→sub→body→buttons
  stagger in, the gradient title gets a slow sheen sweep, primary buttons breathe a glow pulse.
- **HUD entrance**: objective / clock / speedo / minimap / stats ease-in when first shown.
- **Speedo pop**: the km/h readout pulses each time you cross a 10 km/h boundary (JS toggles a class).
- **Emote discoverability**: "1–4 — EMOTE" added to both controls cards.
- Verified: title screen renders clean, 0 errors. UI/first-impression 6 → 8.

## S6 — Driving feel/camera + finish & day-night QA (Δ +0.05) — gates: renders ✅ · 0 console ✅ · 0 page ✅ · steer regression PASS ✅ · 60fps(proxy) ✅
- **Camera auto-centering** (Messenger accessibility): the on-foot camera now always eases behind
  you — brisk while moving, a slow settle when idle — never fighting a manual drag. Non-gamers
  don't have to wrestle the camera. (The in-vehicle spring chase cam was already excellent.)
- **Adaptive day-night stylization** (protects the day-night constraint): posterize eases
  0.45→~0.29 and outline 1.0→~0.72 as night falls, so the 5-band cel + raised contrast don't
  crush low-light tones. Night re-captured: moody but readable, car/emote clean.
- Regression: the steer-skids-right fix re-verified (LEFT→left, RIGHT→right, both PASS) after all
  six sprints of changes. Full day/sunset/night QA, 0 errors throughout.

## ✅ LOOP TERMINATED at Sprint 6 — avg 8.5/10
Two stop conditions hit at once: **6-sprint cap reached** AND **diminishing returns** (S6 Δ < 0.2).
Total lift this cycle: **7.3 → 8.5 (+1.2)** on the stylized rubric; 0 console/page errors every sprint,
60fps(proxy) held, load < 5s. (Target was 8.8; the last ~0.3 is character-model fidelity + true
animated-WebGL UI + denser world — bigger builds than a polish loop, flagged for a future cycle.)

**What the studio shipped (Messenger-inspired):** gradient atmospheric sky · posterized tone
cohesion · the signature silhouette **ink outline** · fresnel rim-light on hero materials ·
a procedural **emote system** (1–4) · animated title/HUD + first-impression polish · camera
auto-centering · adaptive day-night stylization — all r128, all procedural (no external assets),
desktop composer auto-disabled on touch.

**HONEST CAVEAT (unchanged):** the outline adds one extra half-res scene render/frame (desktop
only); held 60fps on the M3 dev rig but the fps proxy can't measure GPU — wants real-hardware
confirmation. Performance stays 9 pending that.
