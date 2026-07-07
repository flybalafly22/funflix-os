# THE FLY — ART BIBLE (canonical, Sprint 0)

> **Authoritative visual source of truth.** Every specialist (Environment, Character,
> Rendering, Audio-adjacent-UI, Narrative) conforms to this. The Art Director may
> reject any output for non-conformance to this file.
>
> **Relationship to `static/town/ARTBIBLE.md`:** that older file documents the
> *golden-hour* direction the town was originally graded for. The shipped build has
> since pivoted to a **flat painterly teal ("Messenger paper") look** (git:
> "walking human hero + teal painterly sky"). **This file is ground truth and wins
> on every conflict.** The older file is retained as historical reference and for its
> still-valid palette-cohesion *rules* (§2 saturation ceilings, cream unifier, 3:1
> warm/cool wall rhythm) — those rules still apply; its *golden-hour lighting/fog/sky
> hexes* are superseded by §4 here.
>
> Reference target: **messenger.abeto.co** — a tiny hand-built town, flat painterly
> color fields, confident ink lines, a soft tiny-planet horizon. Cozy, not slick.

---

## 0. ONE-LINE BRIEF

> **NORTH STAR LOCKED (Producer, 2026-07-07): flat painterly TEAL "Messenger paper."**
> Not golden-hour. All craft work grades to the teal rig in §4. Do not reopen this.

A toy-sized seaside town drawn on warm paper under a flat teal sky, curving gently
away like a tiny planet, outlined in confident ink, where every surface is a
hand-picked flat color and the courier's red scarf is the one thing that sings.

The single feeling to protect: **"I could live there."**

---

## 1. THE LOOK IS FOUR SYSTEMS STACKED

The aesthetic is not one trick — it is four cheap systems layered, and **all four
must survive every change.** If any one is removed the look collapses.

1. **Cel banding** — every surface is `MeshToonMaterial` driven by a shared 3-band
   grayscale ramp (`lib.js _toonGrad = [120,184,255]`). Flat hand-drawn fills, not
   PBR gradients. **The shadow band is lifted to 120, never 0** — blacks stay
   warm-grey; pure black is a bug (`lib.js:353`).
2. **Ink outlines** — a post pass edge-detects view-space normals + depth into ink
   (`#241d18`). Silhouettes always; interior creases only up close (§5). The line is
   *clean*, a whisper of wobble, never scribbled.
3. **Tiny-planet curvature** — a shared view-space vertex bend (`_curve = 0.0008`)
   pushes every vertex down by the square of its horizontal distance from camera, so
   the world curves away. Applied to **every** material incl. the outline normal pass
   so ink bends with the world (`lib.js:363`).
4. **Paper grade** — a final ShaderPass adds contrast/saturation, warm lifted
   shadows, gentle vignette, a faint crosshatch in the darks, paper tooth, and
   speed-lines when fast (`town.html` GradeShader).

**The outline is NOT allowed to carry the whole look** (anti-pattern §6 of the
brief). Geometry + flat cel fills must read with ink disabled — verify by toggling
`outlinePass.enabled = false`.

---

## 2. MASTER PALETTE (shipped values — `lib.js` PAL)

Warm-dominant surfaces under a cool teal sky. ~70% of built surface sits in the
warm cream–terracotta family; teal/sage are the minority relief. These are the
**actual arrays in `static/town/lib.js`** — treat as canonical, extend by the rules,
don't fork.

### 2.1 Cohesion rules (NON-NEGOTIABLE — inherited from the older bible, still law)
1. Wall base colors stay mid-to-light (**L\* 58–78**). No near-black/near-white walls.
   Roofs darker (**L\* 30–48**).
2. Wall/roof/ground saturation **≤ 45% HSL**. Saturation is *spent* on small accents
   (awnings, signage, doors, the scarf) up to **70%**.
3. **≤ 2 saturated accents per building.**
4. **~3 warm walls : 1 cool wall** per block. Cool walls are punctuation.
5. **One shared cream** for all trim/sills/cornices/frames (canonical `#f1e7d0`). This
   single repeated cream is the strongest unifier in the town — protect it.

### 2.2 The arrays (from `lib.js`)
```
WALLS warm:   d8a877 cf9a6e e0bd8c caa074 d9b07e c08a63 e3c79a c99a8a d4a890
WALLS cool:   9fb0a0 9eb2bd aeb39a
ROOFS:        a85f43 9c5740 b56b48 7d6a52 6f7d68 8a5446   (~65% terracotta from air)
CREAM/TRIM:   f4ead2 efe2c6 f1e7d0 e8dabb                 (canonical f1e7d0)
AWNING pairs: [c8504a,f1e7d0][cf8a3c,f1e7d0][3f7d6e,f1e7d0][3a6a92,f1e7d0]
              [8a5288,f3ecd9][b0506a,f3ecd9][d8b14a,f3ecd9]   (≤4 accents/block)
SIGN bg:      8b3528 2f5878 3f6e3c 7a4828 5a2870 28484e a8442f 2f6048
CAR body:     c8504a 3f72ae 3f9468 d8b14a d8d0c4 40444e c8783a 9eb2bd e0986a 6a5da8 3f7d6e b0b4bc
CLOTH:        c85f5a d99a44 3f7d8a 6a5da8 3f9468 b8485a 7088c0 cf8a48 5f8a96 a04878 5a86a8 d98f54 3f9a64
SKIN:         f0c79a e6b889 f3c69d c8825f d89e78 e8c096 b07a52 8a5a3c
HAIR:         170f0a 291c12 3a2818 100e12 443120 201408 322925 17110d   (authored dark; light rig runs hot)
FOLIAGE:      5e9047 6fa356 5a9450 4d8240 7aab5d 588a44
```

### 2.3 Ground / road (shipped — Messenger flat-bright, NOT the old bible's dark values)
The code deliberately moved **lighter and flatter** than the old golden-hour bible.
Ground reads as sunlit paper, not asphalt.
```
Road base     #706b62  (light grey-greige, flat-bright)   — lib.js roadTex
Sidewalk      #c9c4b2  (pale grey-cream)                   — lib.js sidewalkTex
Dirt/plaza    #b7ac92  (pale dust)                         — lib.js dirtTex
```
Keep all ground **matte** and **light**. Do not re-darken toward the old `#4a4640`
road — that fights the paper read.

### 2.4 The brand accent
The courier's **red scarf `#d0473e`** must be the single most-saturated object the
camera usually frames. Protect its contrast against the teal sky and warm town.

---

## 3. MATERIAL & SHAPE LANGUAGE

### 3.1 Everything flows through `lib.js std()`
`std()` builds a `MeshToonMaterial` with the shared ramp + curvature hook and
**strips PBR-only options** (`roughness/metalness/envMap*`) so old call-sites keep
working. **Do not author raw `MeshStandardMaterial`** for common surfaces — you lose
cel banding, curvature and outline coherence. New GLTF assets are re-skinned through
`std()` by `FLY.assets.reskin()` (§7) for exactly this reason.

Roughness/metalness values in call-sites are **advisory only** (toon strips them);
keep them for documentation but know they don't render. The finish is carried by the
ramp + grade, not PBR.

### 3.2 Normal-map relief (subtle — painted plaster, not stucco)
Procedural normal maps (`plasterNormal/brickNormal/...`) are a real asset — keep
them. Shipped scales: plaster **0.28**, brick **0.55**, road 0.45, sidewalk 0.5,
dirt 0.4. Relief felt at street level, invisible from the air. Never crank it.

### 3.3 Silhouette & rounding (low-poly with charm)
- Big boxes get corners *broken by trim/cornice geometry* (the cornice/string-course
  system in `buildings.js`) — never a bare 90° vertical edge on a hero building.
- Organic props (trees, fountains, characters) use sphere/capsule lobes, **8–14
  segments** for faceted charm. **No CapsuleGeometry** (r128 classic build lacks it —
  compose from cylinder + spheres).
- Doors/windows always framed (no glass flush in a wall).

### 3.4 Proportion (the "one toy set" rule — keep exact)
Unit scale ≈ meters: **floor ≈ 3, NPC ≈ 1.7, car ≈ 4.3, lamp ≈ 5.** Buildings stout
and toy-like: 3–5 floors, w 6–12m. Skinny towers only as deliberate landmarks (clock
tower). Characters chunky, big-head-friendly (heads ~0.18m radius, readable at 13m).
**Any new/authored/GLTF asset must respect this scale** or it won't belong.

---

## 4. LIGHTING & ATMOSPHERE — moods (shipped values)

Values live in `templates/town.html` (base rig) and are animated per-day and
per-season by `game.js`. **The base mood is flat-bright teal midday**; the day
slides to a warm dusk; seasons re-tint the whole rig.

### 4.1 Base rig (`town.html`, = Summer / midday)
```
Renderer:  ACES filmic, exposure 0.98 (→1.02 at dusk), pixelRatio min(dpr,1.5)
Shadows:   PCFSoft, 2048 map, radius 4, bias -0.00018, normalBias 0.35; frustum
           follows the player each frame (only near casters render → sharp + cheap)
Sun (key): #fff3e0  intensity 1.45  pos (62,74,44)   — a REAL directional: lit side + shade side
Hemi:      sky #cfe4de / ground #8a8474  intensity 0.72
Fill:      #cfe0e8  0.35  (-34,22,-30)   — cool shade fill
Bounce:    #efe6d2  0.18  (0,-8,22)      — warm ground bounce up
Fog:       FogExp2  #a8dcd4  density 0.0015   — thin teal paper haze (distance stays flat, not murky)
Sky dome:  top #53bcae · horizon #6cc8ba · cloud #bfe8dc · cloud-shade #8fd4c6  (flat teal shader, drifting paper clouds)
Body bg:   #5fc0b2  (matches sky so first paint doesn't flash)
Env probe: gradient #6f9fd0 → #e9dcc2 → #c9b48c  (what glass/metal reflect)
```
**The warm-key vs cool-fill split gives forms dimension. Never let the fill go warm
or the scene flattens.**

### 4.2 Time-of-day mood ramp (`game.js applyTOD`, param `k = tod²`, tod 0→1 across a day's 8 deliveries)
| Channel | Dawn/day (k=0) | Dusk (k=1) |
|---|---|---|
| Sun color / intensity | `#fff2dc` / 1.45 | `#ffb066` / 0.95 |
| Hemi sky / ground | `#d6e8e2` / `#9a9484` | `#bcd0d8` / `#6a5236` |
| Fog | `#a8dcd4` | `#e8c49a` |
| Sky top / horizon / cloud | `#53bcae` / `#6cc8ba` / `#bfe8dc` | `#4a86b0` / `#f0b878` / `#f2d0a8` |
| Exposure | 0.98 | 1.02 |
| Grade gain (R,G,B) | (1.05,1.02,0.96) | (1.15,1.02,0.92) |
| Grade lift (R) | 0.018 | 0.038 |
| Bloom strength | 0.14 (base) | ~0.64 (base+0.5) — lamps/windows/festoons swell |

So the town **dawns cool-teal and sets warm-amber**; ink and cel banding are
constant, only the light/atmosphere warms. Respect this arc — don't hard-code a
single time-of-day into an asset's baked color.

### 4.3 Season ramps (`game.js SEASONS`, one season per 3 in-game days, tinted *on top* of TOD)
Each season lerps the rig toward these anchors and drifts a signature particle.
Summer is the neutral/base look above.
| Season | Fog | Ground(hemi) | Sky top | Sky horizon | Sun | Particle (cols, n) |
|---|---|---|---|---|---|---|
| 🌸 Spring | `#bfe0d0` | `#8aa06a` | `#66c2b0` | `#8fd6b8` | `#fff2e0` | petals `f6c4d4 fadbe6 ffffff` ×68 |
| ☀️ Summer | `#a8dcd4` | `#9a9060` | `#53bcae` | `#6cc8ba` | `#fff4dc` | none |
| 🍂 Autumn | `#e0c49a` | `#8a6a3a` | `#7ab0b0` | `#e0b070` | `#ffdca0` | leaves `c86a2a d89a3a a8482a 8a6a2a` ×60 |
| ❄️ Winter | `#dce6ee` | `#b8c0c8` | `#8fb4c8` | `#c8dae4` | `#eef4ff` | snow `ffffff eef4f8` ×78 |
Blend weights (from code): fog 0.4, ground 0.42, sky 0.3, sun 0.28 — seasons *nudge*,
they don't repaint. Winter is the one cool-dominant season; keep its palette restrained.

### 4.4 Post stack order & params (`town.html`)
`RenderPass → UnrealBloomPass(res 800×600, strength 0.14, radius 0.55, threshold 0.9)
→ GradeShader → GammaCorrection → OutlineShader`.
Grade base: vignette 0.16, contrast 1.13, saturation 1.14, lift (0.018,0.016,0.012),
gain (1.05,1.02,0.96), hatch 0.07. **Bloom threshold 0.9 is high on purpose** — only
true lights bloom, not bright walls. Raise emissive *counts*, not intensities.

---

## 5. OUTLINE (INK) LOGIC — explicit spec (`town.html` OutlineShader)

The ink pass is a signature system; author to these rules so new assets outline
correctly.

- **Ink color:** `#241d18` (warm near-black, never pure `#000`).
- **Two edge sources, combined `max(depth, normal)`:**
  - *Depth silhouettes* — relative depth break `(Δdepth)/(depth+0.04)`, thresholded
    `smoothstep(0.02,0.10,·)`. **Always drawn**, near and far, so objects stay
    separated against each other and the sky.
  - *Normal creases* — strongest neighbour normal difference,
    `smoothstep(0.30,0.9,·)`. A **close-up privilege**: multiplied by
    `creaseF = smoothstep(0.0025,0.007, depth)` so interior lines **die fast with
    distance** → mid/far read as clean shaded shapes, not a line tangle.
- **Distance falloff:** `distF = smoothstep(0.0035,0.014, depth)`; silhouettes fade
  to 55% strength far, creases vanish. This keeps the aerial roofscape clean.
- **Line quality:** thickness `uThick 0.85`, a *whisper* of UV wobble (0.12 texel) +
  gentle per-pixel thickness variation — steady, defined, **not scribbled**.
- **Normal/depth source:** the world is re-rendered with `MeshNormalMaterial` (curved
  by the same `_curve` hook) into a full-device-res `normalRT` with a `DepthTexture`.
  **FX/HUD-world markers live on `LAYER_FX = 1` and are excluded** so the objective
  beam, pickup ring etc. are never outlined.
- **Authoring implication:** an asset reads correctly only if its **geometry has real
  normals and depth separation**. Flat-normal or coplanar-shell geometry won't
  outline. Give props genuine thickness; don't rely on the line to fake form.
- **Perf tier:** the adaptive governor disables the ink pass as a last resort below
  ~28 fps (`town.html` tick). Design so the scene still reads without it (§1).

---

## 6. COMPOSITION (what the player sees)

The player flies **above a warm street toward a landmark, sky curving away.** Compose
for that view.
- **Priority surfaces from the air:** (1) the terracotta-dominant **roofscape** —
  push pitch/parapet/tank variety; (2) **awning stripes + street furniture** as the
  colorful midground rhythm; (3) the **lit objective marker** (gold pickup / green
  dropoff), always saturated against the town; (4) **raking shadows** as the day warms.
- **Focal heart:** the **plaza + fountain** (+Z center, `x ∈ [-18,18]`, near
  `z ≈ +28`) — densest props, most lights, café tables, market stalls. The eye rests
  here.
- **Landmark anchor:** the **clock tower** — vertical anchor visible down the avenue;
  keep its cream stone catching light and its finial glowing as a beacon.
- **Density gradient:** dense at plaza & the 4-way intersections (`x = ±86`),
  thinning toward avenue ends and the park (`x = -78`, -Z). Empty edge asphalt is
  fine — it focuses the eye inward.
- **Districts** (assign by `world.js` ROSTER zoning): warmest at Market/Plaza; cooler
  pale stone at the civic spine; green-dominant at the Park; the 3:1 warm rhythm along
  the avenues; slightly more saturated "artisan" feel on the cross-streets — still
  capped.

---

## 7. ASSET PIPELINE — how authored GLTF enters the town (Sprint 0 deliverable)

New in Sprint 0: a loader so authored **CC0 low-poly GLTF** can replace code-built
primitives without losing the four-system look or the batching perf.

- **Module:** `static/town/assets.js` → `window.FLY.assets`.
  - `FLY.assets.load(url) → Promise<THREE.Group>` (r128 `THREE.GLTFLoader`, guarded).
  - `FLY.assets.reskin(obj, opts)` — walks a loaded scene and **replaces every
    material with a `std()` cel material** (preserving base color + map), so curvature
    + ink + banding all apply. Sets `castShadow/receiveShadow`. **This is mandatory**
    for any GLTF before it enters the world.
  - `FLY.assets.prep(obj, {static:true})` — tags meshes so the existing
    `batchStatic()` merges them with the rest of the town (one draw call per material)
    — a placed authored prop costs the same as a code-built one after batching.
  - `FLY.assets.manifest` — the source/license table (mirror into `ASSETS_CREDITS.md`).
- **Batching contract:** authored static props must (a) be re-skinned through `std()`
  so they share cached materials by `material.uuid`, and (b) sit under `root` as
  static (not in the dynamic npc/car/etc. sets) — then `world.js batchStatic()`
  collapses them for free. Dynamic/animated GLTF (future rigged NPCs) stay unbatched.
- **Authoring/export path:** `tools/blender_export.py` — a headless Blender (`bpy`)
  script: `blender --background --python tools/blender_export.py -- <in.blend> <out.glb>`.
  It applies transforms, triangulates, limits to the town scale (§3.4), and exports
  GLB (Draco off — r128 loader here has no Draco decoder wired). Where Blender is
  unavailable, `tools/gen_gltf_box.py` emits a valid GLB with **zero dependencies**
  (used to prove the loader in Sprint 0).
- **Licensing:** every imported asset's source + license goes in `ASSETS_CREDITS.md`.
  CC0 / clearly-permissive only. No exceptions.

---

## 8. UI / HUD LANGUAGE (shipped — hand-lettered paper)

The HUD is **warm paper cards with a 2px ink border and a hard drop-shadow**, hand-
lettered in *Patrick Hand*. This is on-brand (paper + ink, matching the world) and is
the shipped direction — the older bible's "warm glassmorphism" tokens are **superseded**.
```
Card bg     rgba(250,247,238,.95)   ink border #2c261c 2px   shadow 0 3px 0 rgba(44,38,28,.22)
Text ink    #2c261c        Task accent #c04434        Score accent #4d8a52
Font        'Patrick Hand', ui-rounded, system-ui        Loader bg #faf7ee (white paper + ✉)
```
Cards are slightly rotated (±0.4°) for a pinned-note feel. Keep radius irregular
(`12px 14px 11px 13px`) — the hand-made wobble. UI micro-animation (toast scale-in,
combo glow) stays. Any new UI conforms to *paper + ink*, not flat glass.

---

## 9. COHESION CHECKLIST (paste into every PR)
- [ ] New surface material came from `lib.js std()` (or `FLY.assets.reskin`) — cel +
      curvature + outline intact; no raw `MeshStandardMaterial`.
- [ ] Reads correctly with `outlinePass.enabled = false` (line isn't carrying it).
- [ ] No big surface above 45% saturation; ≤2 saturated accents per building.
- [ ] All trim/sill/frame cream from the §2.2 family (canonical `#f1e7d0`).
- [ ] ~3 warm walls : 1 cool wall per block.
- [ ] Shadow band never pure black (ramp lifted; grade lift respected).
- [ ] Emissives glow but don't blow out (bloom threshold 0.9).
- [ ] Asset respects the toy scale (§3.4) and has real normals/depth (outlines work).
- [ ] Rooftops read terracotta-dominant from the air.
- [ ] The courier's red scarf (`#d0473e`) is the most-saturated framed object.
- [ ] Any imported asset recorded in `ASSETS_CREDITS.md` with a CC0/permissive license.

---

## APPENDIX — KEY CODE ANCHORS (ground truth locations)
| Concern | File / symbol |
|---|---|
| Cel ramp | `static/town/lib.js` `_toonGrad` (~L353) |
| Curvature | `static/town/lib.js` `applyCurve` / `_curve` (~L363) |
| Material chokepoint | `static/town/lib.js` `std()` / `MAT` (~L448) |
| Palette | `static/town/lib.js` `PAL` (~L334) |
| Base lighting/fog/sky/post | `templates/town.html` bootstrap (~L120–330) |
| Ink outline shader | `templates/town.html` `OutlineShader` (~L288) |
| Grade shader | `templates/town.html` `GradeShader` (~L227) |
| Time-of-day ramp | `static/town/game.js` `applyTOD` (~L1069) |
| Seasons | `static/town/game.js` `SEASONS` (~L1051) |
| Static batching | `static/town/world.js` `batchStatic()` (~L1692) |
| Deterministic seed | `static/town/world.js` `L.setSeed(20240617)` (~L169) |
| GLTF pipeline | `static/town/assets.js` `FLY.assets` |
