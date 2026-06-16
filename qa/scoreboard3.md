# Costa Vista → Stylized Art-Direction loop (cycle 3) — scoreboard

Studio: **Meridian Interactive** (20-role studio, see `studio/STUDIO.md`).
Inspiration: **abeto _Messenger_** — art-directed restraint (outlines, posterized cohesion,
gradient atmosphere, animated UI), not realism.
Rubric: 0–10 each, where a *cohesive stylized open-world* (Messenger/Sable-class direction) = 10.
**Stop when** avg ≥ **8.8**, OR a sprint gains **< 0.2**, OR **6 sprints** done.

| Dimension                       | Base(8.1 cycle) | S1 | S2 | S3 | S4 | S5 |
|---------------------------------|:--:|:--:|:--:|:--:|:--:|:--:|
| Art-direction cohesion ★        | 7  | 8  | 9  |    |    |    |
| Atmosphere & sky/fog            | 7  | 8  | 8  |    |    |    |
| Stylization / signature look ★  | 5  | 6  | 8  |    |    |    |
| Materials & surfaces            | 8  | 8  | 8  |    |    |    |
| Lighting mood                   | 8  | 8  | 8  |    |    |    |
| Controls & camera feel          | 8  | 8  | 8  |    |    |    |
| World detail & district variety | 8  | 8  | 8  |    |    |    |
| UI / first-impression polish    | 6  | 6  | 6  |    |    |    |
| Character & expression          | 5  | 5  | 5  |    |    |    |
| Performance (auto)              | 9  | 9  | 9  |    |    |    |
| Stability (auto)                | 9  | 9  | 9  |    |    |    |
| **Average**                     | **7.3** | **7.5** | **7.8** |  |  |  |

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

Notes per sprint appended below as the loop runs.
