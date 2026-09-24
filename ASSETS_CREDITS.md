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
| PWA app icons | `static/trainer/icon-192.png`, `icon-512.png` | generated in-repo (headless render of an inline SVG) | CC0-1.0 / own work | the Voice mark: a white weight plate on electric cobalt (maskable-safe); also the site favicon |
| Bricolage Grotesque (variable, opsz 12–96, wght 200–800, Latin subset) | `static/fonts/bricolage.woff2` | github.com/ateliertriay/bricolage (Google Fonts build) | OFL-1.1 | Display face of the site-wide Voice system (home, Trainer, shared chrome). Self-hosted via `static/fonts/fonts.css`. |
| Geist (variable, wght 100–900, Latin subset) | `static/fonts/geist.woff2` | github.com/vercel/geist-font | OFL-1.1 | Body face. Replaces the Google Fonts request in `os.css`. |
| Geist Mono (variable, wght 100–900, Latin subset) | `static/fonts/geist-mono.woff2` | github.com/vercel/geist-font | OFL-1.1 | Labels, numbers, data. |

---
_Add a row here in the same commit that introduces any new asset. No asset ships without a recorded license._
