# Costa Vista → Stylized Art-Direction loop (cycle 3) — scoreboard

Studio: **Meridian Interactive** (20-role studio, see `studio/STUDIO.md`).
Inspiration: **abeto _Messenger_** — art-directed restraint (outlines, posterized cohesion,
gradient atmosphere, animated UI), not realism.
Rubric: 0–10 each, where a *cohesive stylized open-world* (Messenger/Sable-class direction) = 10.
**Stop when** avg ≥ **8.8**, OR a sprint gains **< 0.2**, OR **6 sprints** done.

| Dimension                       | Base(8.1 cycle) | S1 | S2 | S3 | S4 | S5 |
|---------------------------------|:--:|:--:|:--:|:--:|:--:|:--:|
| Art-direction cohesion ★        | 7  | 8  |    |    |    |    |
| Atmosphere & sky/fog            | 7  | 8  |    |    |    |    |
| Stylization / signature look ★  | 5  | 6  |    |    |    |    |
| Materials & surfaces            | 8  | 8  |    |    |    |    |
| Lighting mood                   | 8  | 8  |    |    |    |    |
| Controls & camera feel          | 8  | 8  |    |    |    |    |
| World detail & district variety | 8  | 8  |    |    |    |    |
| UI / first-impression polish    | 6  | 6  |    |    |    |    |
| Character & expression          | 5  | 5  |    |    |    |    |
| Performance (auto)              | 9  | 9  |    |    |    |    |
| Stability (auto)                | 9  | 9  |    |    |    |    |
| **Average**                     | **7.3** | **7.5** |  |  |  |  |

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

Notes per sprint appended below as the loop runs.
