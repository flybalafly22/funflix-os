# Costa Vista → Graphics + Controls + Map loop (cycle 2) — scoreboard

Rubric: 0–10 each (modern open-world AAA = 10). Stop when avg ≥ 8.0, OR 5 iterations, OR <0.3 gain/pass.
Council: full-stack + front-end + back-end + QA + graphic-designer + 3D-modelling + VFX + designer + ideation.
User priorities (verbatim): "work on the graphics", "car controls especially are very bad",
"completely reconstruct the graphics into something much better, cleaner, closer to modern open world games",
"expand the map".

| Dimension                  | Base | I1 | I2 | I3 | I4 | I5 |
|----------------------------|:---:|:--:|:--:|:--:|:--:|:--:|
| Controls — vehicle feel ★  | 4 | 7 | 7 | 7 |  |  |
| Camera & game-feel         | 6 | 7 | 7 | 7 |  |  |
| Lighting & atmosphere      | 6 | 6 | 8 | 8 |  |  |
| Materials & surfaces       | 5 | 5 | 7 | 7 |  |  |
| VFX & post-processing      | 6 | 6 | 7 | 7 |  |  |
| World detail & density     | 6 | 6 | 7 | 8 |  |  |
| Vehicle/character fidelity | 5 | 5 | 5 | 5 |  |  |
| Map scale & layout variety | 5 | 5 | 5 | 8 |  |  |
| Performance (auto)         | 9 | 9 | 9 | 9 |  |  |
| Stability (auto)           | 9 | 9 | 9 | 9 |  |  |
| **Average**                | **6.1** | **6.5** | **7.1** | **7.5** |  |  |

I1 (Controls & camera) gates: renders ✅ · 0 console ✅ · 0 page ✅ · load 4.16s ✅ · 60fps ✅ · drive 0 errors ✅ (Δ +0.4)
  - chase cam: critically-damped spring (k scales 55→125 with speed), steer-lead into corners, looks into slides — kills the swimmy follow
  - throttle torque curve (strong launch, eases near v-max); firm front brake that rolls into a slower reverse (no snap)
  - smoothed steer input (no binary snap); low-speed steering engages at speed/4.5 not speed/7 → tight maneuvering

I2 (Graphics core) gates: renders ✅ · 0 console ✅ · 0 page ✅ · 60fps ✅ · drive 0 errors ✅ (Δ +0.6)
  - lighting: sun key 1.12→1.55, hemi fill 0.42→0.30 (sun:fill ~3:1 → real form/contrast); exposure 0.92→0.98
  - shadows: frustum ±95→±62 player-centred → ~2.3x texel density → crisp contact shadows; radius 2.4
  - grade: contrast 1.07→1.13, saturation 1.12→1.19, deeper cool shadows + warm highlights (golden-hour bias)
  - facades: 4→8 coastal-Mediterranean colours + per-type glass tints + variable column counts; sill grime
    weathering streaks + base ambient-occlusion gradient — kills the monotone-beige-box grid
  - asphalt: deeper cooler base, roughness 0.95→0.78 + envMap 0.5 → real sun sheen on the road

I3 (Map expansion) gates: renders ✅ · 0 console ✅ · 0 page ✅ · load 4.15s ✅ · 60fps ✅ · teleport tour 0 errors ✅ (Δ +0.4)
  - grid -1..5/-4..2 → -1..7/-5..2: ~50% more city area (east + north), all props/traffic/minimap auto-extend
  - NEW eastside "uptown" district: glass-forward midrise on slim plinths + accent fins → distinct skyline cluster
  - roads/lane-dashes/bounds extended; minimap MAP_PAD 210→340 + land band so the radar covers the new extent
  - new uptown plaza + east parking lot; villa hills extended north into a long boulevard
  - props auto-furnish new blocks (derived from footprints); traffic drives the new roads (verified in capture)
  - QA bridge: added inert tp()/setCamYaw() (gated by ?qa=1) for district capture + future loop testing

★ = user's explicit #1 complaint.

Baseline notes (code review + prior cycle QA):
- Controls 4/10: chase cam follows heading at slow dt*1.8 lerp (~0.55s lag) → swimmy; no turn
  anticipation/lead; steering authority taper can feel laggy; reverse/brake blend abrupt.
- Graphics already has ACES + bloom + grade + PMREM env; gap is material consistency, lighting
  cascade/contact, sky realism, reflections, AA quality.
- Map ~290x284 units, single grid district; no skyline landmarks, limited district variety.
