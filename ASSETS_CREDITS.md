# THE FLY — ASSET CREDITS & LICENSES

Every imported or generated art/audio/font/icon asset must be recorded here with its
source and license (CC0 or clearly permissive only). See `ART_BIBLE.md` §7 and the
overhaul brief's licensing guardrail.

## 3D assets (GLTF)
| Key | File | Source | License | Author / Notes |
|---|---|---|---|---|
| `crate` | `static/town/assets/crate.glb` | `tools/gen_gltf_box.py` (generated in-repo) | CC0-1.0 | Sprint 0 pipeline probe — a 1m unit crate used to prove the GLTF loader end-to-end. **Not a shipped art asset.** |

## Fonts
| Name | Source | License | Notes |
|---|---|---|---|
| Patrick Hand | Google Fonts | OFL-1.1 | HUD hand-lettering (loaded in `templates/town.html`). |

## Audio
_None imported yet — current SFX/music are procedural (Web Audio). CC0 sample set lands in Sprint 4._

## Icons
_None imported yet — current UI uses text/emoji. CC0 icon set (or authored SVG) lands in Sprint 4._

## The Trainer (unrelated to THE FLY, same repo)
| Asset | File(s) | Source | License | Notes |
|---|---|---|---|---|
| Movement pictograms (17 glyphs) | inline SVG in `templates/trainer.html` | authored in-repo (trainer Sprint 4) | CC0-1.0 / own work | signage-style exercise icons in the plan table + PDF |
| PWA app icons | `static/trainer/icon-192.png`, `icon-512.png` | generated in-repo (headless render) | CC0-1.0 / own work | serif T + acid underline on paper |

---
_Add a row here in the same commit that introduces any new asset. No asset ships without a recorded license._
