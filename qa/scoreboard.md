# Costa Vista → GTA-likeness loop — scoreboard

Rubric: 0–10 each (GTA V = 10 reference). Stop when avg ≥ 7.0, OR 5 iterations, OR <0.3 gain.

| Dimension              | Baseline | Iter1 | Iter2 | Iter3 | Iter4 |
|------------------------|:-------:|:----:|:----:|:----:|:----:|
| Visual fidelity        | 4 | 5 | 5 | 5 | 6 |
| World density          | 5 | 5 | 7 | 7 | 7 |
| Living world (AI)      | 3 | 3 | 6 | 6 | 6 |
| Vehicle feel/physics   | 4 | 6 | 6 | 6 | 6 |
| Camera & game-feel     | 5 | 6 | 6 | 6 | 7 |
| Missions/progression   | 6 | 6 | 6 | 6 | 6 |
| Audio                  | 4 | 4 | 4 | 7 | 7 |
| HUD/minimap            | 5 | 5 | 5 | 7 | 7 |
| Performance (auto)     | 8 | 9 | 9 | 9 | 9 |
| Stability (auto)       | 9 | 9 | 9 | 9 | 9 |
| **Average**            | **5.3** | **5.8** | **6.3** | **6.8** | **7.0** |

Auto gates baseline: renders ✅ · 0 console errors ✅ · 0 page errors ✅ · load 7.6s ✅ · 60fps (real GPU) ✅
Iter1 gates: renders ✅ · 0 console ✅ · 0 page ✅ · load 4.1s ✅ · 60fps ✅ · full-drive 0 errors ✅ (Δ +0.5)
Iter2 gates: renders ✅ · 0 console ✅ · 0 page ✅ · load 4.2s ✅ · 60fps ✅ · drive 0 errors ✅ · traffic+peds+props visible ✅ (Δ +0.5)
Iter3 gates: renders ✅ · 0 console ✅ · 0 page ✅ · load 4.2s ✅ · 60fps ✅ · drive 0 errors ✅ · wanted/health/cash/radar HUD visible ✅ (Δ +0.5)
Iter4 gates: renders ✅ · 0 console ✅ · 0 page ✅ · load 4.3s ✅ · 60fps ✅ · night forced (nightF=1) 0 errors ✅ · headlight/glow/emissive verified via light probe (Δ +0.2)

## LOOP TERMINATED at Iteration 4 — avg 7.0/10
Stop triggered two ways: target (≥7.0) reached AND diminishing returns (+0.2 < 0.3 floor).
Total lift: 5.3 → 7.0 (+1.7) over 4 passes, 0 console/page errors throughout, 60fps held.

HONEST CEILING: 7.0/10 is on a rubric where GTA V = 10. This is now a polished,
modern, alive browser open-world driver — it is NOT GTA V and never could be in a
browser. The gap that remains is the irreducible part: world scale, true vehicle/rag-
doll physics, asset/mocap fidelity, mission depth, and online. The loop closed the
gap that browser tech allows; the rest is a platform ceiling, not an iteration count.

Notes:
- Strengths already present: 3-act story w/ dialog & cinematics, save/load, day–night, cars+bikes+humans w/ animation, vehicle damage, particle FX, Web Audio, minimap+speedo.
- Biggest GTA gaps: realistic lighting/materials, vehicle handling realism, traffic/pedestrian density & AI, richer HUD (wanted level), fuller audio.
