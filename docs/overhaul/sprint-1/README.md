# Sprint 1 — Hero Block (exterior-only) — QA Gate Report

**Status: ready for Producer review.**
Date: 2026-07-07 · Branch: `overhaul/craft` · Build: `/play/the-fly` · Seed: `20240617`

Scope: the plaza + adjoining avenue + the storefront row, brought toward finished
quality by fixing the **specific weak points** the Producer identified in the Sprint 0
baselines — **not** a blanket primitive-replacement pass (the building wash/linework
already read well and was left alone).

Teal is locked as the canonical north star (`ART_BIBLE.md` §0).

---

## The five targeted fixes (before → after)

| # | Weak point | Fix | Evidence |
|---|---|---|---|
| 1 | **Clock tower** was the flattest, whitest asset (flat near-white fills) | Textured cream **stone** (plaster map + normal wash), values pulled into the §2.1 wall band (no near-white), + a soft **contact-shadow** ground decal (SAO is off, so hero landmarks need explicit AO) | `*_tower_desktop.png` |
| 2 | **Untextured white cuboids** on rooftops | AC units: flat `#a6a097` (blew to white under the key light) → cooler **textured** metal housing + recessed top fan grille. Civic **domes/cupolas** de-whitened (`mix→white` 0.22/0.18 → 0.10/0.08) so they carry wall wash instead of reading as flat white blobs | `*_rooftop_desktop.png` |
| 3 | **Bare rooftop planes** | Large flat roofs (`w·d > 46`) now get a brick roof-hatch + crates so no roof reads as an empty plane | `*_rooftop_desktop.png` |
| 4 | **Rank/rival HUD card** clipped "Messenger"/"Paco" | Root cause was the ☰ log button overlapping the card (not text overflow). Card set to `white-space:nowrap`; log button + panel moved below the card. `logBtnOverlapsCard: true → false` | `*_hud_mobile.png`, `*_report.json` |
| 5 | **Mobile portrait** wasted the top third on sky | Chase camera is now aspect-aware: as the frame goes tall it lifts the eye and pitches the look down (`pf≈0.54` on a 390×844 phone, 0 on desktop) so the skyline sits high | `*_hud_mobile.png` |

Before/after pairs at matched fixed camera + seed, desktop + mobile:
`before_*` vs `after_*` (`plaza`, `tower`, `rooftop`, `hud`).

---

## Gate checks

| Check | Result |
|---|---|
| Boot clean (no console/page errors) | ✅ desktop + mobile, both empty |
| Working loop intact | ✅ delivery HUD/jobs/minimap live in shots |
| **Interiors still enterable** (guardrail) | ✅ door trigger detected + enter→`inside:true`, exit→`inside:false` (PHARMACY, via game `debug` API) |
| Art-bible conformance | ✅ teal rig, cel + ink + curvature preserved; tower/dome now inside the wall value band |
| Perf within budget (no regression) | ✅ see below |

### Perf (fixed plaza pose, seed 20240617 — SwiftShader floor, relative only)
| Device | Scene draw calls | Triangles | Textures |
|---|---|---|---|
| Desktop | 3040 → **2945** (−95) | 731,256 → 742,528 (+1.5%) | 391 → 377 |
| Mobile | 2277 → **2174** (−103) | 676,644 → 684,452 (+1.2%) | 183 → 185 |

Draw calls **dropped** (the new static props batch into the merged town geometry);
triangles rose ~1.5% for the added rooftop dressing + tower detail. No regression.
**Anchor the 60/30 budget with the Producer's real-device fps** — headless numbers are
a relative signal only.

Regenerate: `python qa/capture_sprint1.py after http://127.0.0.1:5099`
(matched before via `git stash` + `... before`).

---

## Files touched (hero-slice-focused, recipe-level — not a blanket pass)
- `static/town/world.js` — clock tower: textured stone + contact shadow.
- `static/town/buildings.js` — `rooftop()` AC redress + large-roof filler; `domeRoof`/`cupola` de-whiten.
- `static/town/game.js` — `#flyBest` nowrap + log-button reposition (HUD); aspect-aware chase camera (mobile).
- `ART_BIBLE.md` — teal north star locked.
- `qa/capture_sprint1.py` — Sprint 1 evidence harness.

## Notes / corrections for the Producer
- **Correction to the Sprint 0 finding:** walk-in shop **interiors DO exist** and are
  enterable (Sprint 43, `game.js` `INT_CFG`, 12 enterable shops). The Sprint 0 report's
  "no interiors" was wrong. This does not change the scope call (interiors remain
  out-of-scope for *craft*), but the guardrail "interiors still enterable" is a real,
  now-passing check.
- The civic dome reads much better but its sunlit crown is still light (a dome catching
  the key). If the Producer wants it pushed further, that's a quick follow-up.

**Recommendation:** accept the hero-slice bar; on approval, propagate these patterns
town-wide in Sprint 2 (exterior-only).
