# THE FLY — ART DIRECTION BIBLE (HISTORICAL — golden-hour direction)

> ⚠️ **SUPERSEDED FOR LOOK/LIGHTING by `/ART_BIBLE.md` (repo root, Sprint 0 canonical).**
> The shipped build pivoted from this golden-hour grade to a flat painterly **teal
> "Messenger paper"** look. Use the root `ART_BIBLE.md` as ground truth. This file is
> retained because its palette-**cohesion rules** (§2.1 saturation ceilings, the shared
> cream unifier, the 3:1 warm/cool wall rhythm) are still law; its golden-hour
> lighting/fog/sky **hexes are obsolete** — see root §4 for the shipped values.

> Single source of truth for the visual look of THE FLY. Hand this verbatim to
> any specialist working on `lib.js`, `buildings.js`, `props.js`, `characters.js`,
> `world.js`, `town.html`, or `game.js`. Every value here is concrete and
> paste-ready. When in doubt, this document wins over what is currently in code.

> Reference target: **messenger.abeto.co** — a tiny hand-built town, warm and
> soft, low-poly but lovingly detailed, lit like late afternoon. Cozy, not slick.

---

## 0. ONE-LINE BRIEF

A toy-sized Mediterranean town at golden hour, hand-painted and softly lit, where
every wall, awning and rooftop feels like it was placed by the same warm hand.

---

## 1. AESTHETIC NORTH STAR

THE FLY is a **cozy hand-made toy town bathed in golden-hour light.** It should
feel small, warm, and lovingly arranged — like a tabletop diorama you want to lean
into — not a sprawling realistic city. Surfaces are matte and painterly (plaster,
sun-faded paint, weathered wood, patinated iron); edges read as soft low-poly
charm, never sterile CAD. The mood is **late-afternoon Mediterranean**: amber sun,
long soft shadows, cool sky-fill in the shade, a faint dusty-warm haze at distance.
Color is **curated and harmonized**, not "every building a different loud hue."

**AVOID, always:**
- **Muddy / desaturated grey-brown sludge.** The current ground (`#9aa183` dirt),
  asphalt (`#3a3e46`) and many walls drift grey. We want warmth, not concrete.
- **Oversaturation / clown palette.** No pure primaries on big surfaces. The walls
  array currently has too many competing chroma directions (peach vs. blue vs.
  purple vs. green all at full strength) — that reads as random, not designed.
- **Harsh contrast & hard black outlines.** Keep blacks lifted; let shadows be
  warm-grey, not pure 0.
- **Generic Three.js defaults.** No flat-grey untextured boxes, no chrome where
  matte iron belongs, no blue-white "noon" lighting.
- **Visual noise from over-bright emissives** (lit windows, neon, lamp bulbs) that
  blow out under bloom. Tune emissive intensity DOWN, count UP.

The single feeling to protect: **"I could live there."**

---

## 2. MASTER PALETTE

A tight, harmonized palette. The governing idea: **warm dominant + cool relief.**
~70% of visible surface area should sit in the warm-cream-terracotta family; cool
tones (blues, sages, teals) are the **minority relief** that makes the warmth sing.

### 2.1 Cohesion rules (NON-NEGOTIABLE)
1. **Value range for wall fields:** keep wall base colors in lightness **L\* 58–78**
   (mid-to-light). No near-black or near-white walls. Roofs sit darker, **L\* 30–48**.
2. **Saturation ceiling for big fields:** wall/roof/ground saturation **≤ 45% HSL**.
   Saturation is *spent* on small accents (awnings, signage, doors, flowers, the
   Fly's scarf), which may go up to **70%**.
3. **Accent budget per building:** at most **TWO** saturated accents (e.g. awning +
   sign). Everything else is wall/trim/roof neutrals.
4. **Warm/cool ratio across a block:** roughly **3 warm walls : 1 cool wall.** Cool
   walls (sage/blue) are punctuation, never the rhythm.
5. **Shared cream:** ALL trim, sills, cornices, window frames, awning light-stripes
   pull from ONE cream family (§2.4). This single repeated cream is the strongest
   unifier in the whole town — protect it.
6. **One global undertone:** every hex should feel like it has a faint warm
   (amber) undertone, as if seen through afternoon light. Cool colors are
   *muted/dusty* blues and greens, never electric.

### 2.2 Building WALL tones — REPLACE `PAL.walls` in `lib.js`
Current `PAL.walls` is 12 entries spread across peach/terracotta/blue/sage/mauve at
inconsistent saturation. Re-harmonize to a curated **terracotta-warm-dominant** set
with a few dusty-cool reliefs, all nudged toward a shared amber undertone:

```js
walls: [
  // — warm dominant (use most often) —
  '#d8a877', // warm sand (hero wall)
  '#cf9a6e', // terracotta tan
  '#e0bd8c', // pale ochre
  '#caa074', // clay
  '#d9b07e', // wheat
  '#c08a63', // burnt sienna (muted)
  '#e3c79a', // cream-ochre (lightest warm)
  // — soft mid relief —
  '#c99a8a', // dusty rose-clay
  '#d4a890', // faded coral plaster
  // — cool minority relief (sparingly) —
  '#9fb0a0', // dusty sage
  '#9eb2bd', // faded sky-grey-blue
  '#aeb39a', // olive-stone
],
```
Rule for `world.js`: when a roster `wall` hex is authored, it overrides PAL — but
authored walls must ALSO obey §2.1 (audit the ROSTER, §2.9).

### 2.3 ROOF tones — REPLACE `PAL.roofs` in `lib.js`
Roofs unify the skyline seen from the air (the player's #1 view). Pull them toward
**terracotta tile + a few weathered slate-greens**, all darker than walls:

```js
roofs: [
  '#a85f43', // terracotta tile (hero roof — use most)
  '#9c5740', // deep clay tile
  '#b56b48', // sun-faded tile
  '#7d6a52', // weathered timber
  '#6f7d68', // mossy slate-green (relief)
  '#8a5446', // oxblood tile
],
```
Bias roof selection ~65% toward the three terracotta tiles so the rooftops read as
one warm tiled field from above.

### 2.4 TRIM / CREAM family — REPLACE `PAL.trims` in `lib.js`
The unifier. Keep it tight and warm-white (never cold white):

```js
trims: [ '#f4ead2', '#efe2c6', '#f1e7d0', '#e8dabb' ],
```
Use `#f1e7d0` as the canonical "cream" everywhere a single value is needed
(sills `#e7ddc8` → bump to `#ece0c6`; window-sill instanced mat in `buildings.js`).

### 2.5 AWNING / SIGNAGE accents — adjust `PAL.awning`, `PAL.signbg`
The accent layer. Each awning is `[accent, cream]`; keep the cream stripe locked to
§2.4. Harmonize the accent halves to a curated jewel-but-muted set (no neon):

```js
awning: [
  ['#c8504a', '#f1e7d0'], // tomato red
  ['#cf8a3c', '#f1e7d0'], // amber/saffron
  ['#3f7d6e', '#f1e7d0'], // teal-green
  ['#3a6a92', '#f1e7d0'], // denim blue
  ['#8a5288', '#f3ecd9'], // plum
  ['#b0506a', '#f3ecd9'], // raspberry
  ['#d8b14a', '#f3ecd9'], // mustard
],
signbg: [ '#8b3528','#2f5878','#3f6e3c','#7a4828','#5a2870','#28484e','#a8442f','#2f6048' ],
```
Rule: **at most 4 distinct awning accents visible on any one street block** — the
furniture/road already adds variety. Repetition of a small accent set = cohesion.

### 2.6 GROUND / ROAD neutrals — FIX in `lib.js` (biggest cohesion bug)
Current ground is the muddiest part of the town. Warm it and lift saturation
slightly toward sun-baked, not cold-grey:

| Surface | File / func | Current | TARGET |
|---|---|---|---|
| Dirt / base plaza | `dirtTex` base | `#9aa183` (greenish-grey) | `#b3a07e` warm dust |
| Dirt mottle hi/lo | `dirtTex` | `#b4ba9c` / `#7c8466` | `#c6b491` / `#9a8866` |
| Asphalt road | `roadTex` base | `#3a3e46` (cold blue-grey) | `#4a4640` warm graphite |
| Sidewalk | `sidewalkTex` base | `#bcb4a4` | `#cabda4` warm stone |
| Plaza tile | `world.js plazaTileTex` | `#cabfa6` | keep — already good |
| Curb | `world.js curbMat` | `#cac4b4` | `#d2c6b0` |
| Lane dashes | `world.js dashMat` | `#d4c890` | keep |
| Grass (park) | `world.js grassTex` | `#6f9a52` | `#7aa257` slightly warmer/brighter |

Road normal/asphalt should stay matte (roughness ~0.95) — wet-look asphalt kills
the cozy feel.

### 2.7 SKY / ATMOSPHERE — see §4 for full lighting; palette anchors:
```
Sky zenith   #4f86c4   (warm-leaning daytime blue, not navy)
Sky mid      #b7cfe2   (hazy pale blue)
Sky horizon  #f3cf95   (warm golden haze — the hero color of the look)
Fog          #e6d2b0   (warm dusty haze; replaces cold #d6e3ee)
```
The horizon glow `#f3cf95` and fog `#e6d2b0` are what sell "golden hour." They are
mandatory.

### 2.8 CHARACTER palette — adjust in `lib.js` PAL + `characters.js`
Cloth should harmonize with the town (earthy + a few jewel accents), not fight it.
Skins span a warm inclusive range; hair stays natural.

```js
// lib.js PAL
cloth: [ '#c85f5a','#d99a44','#3f7d8a','#6a5da8','#3f9468','#b8485a',
         '#7088c0','#cf8a48','#5f8a96','#a04878','#5a86a8','#d98f54','#3f9a64' ],
skin:  [ '#f0c79a','#e6b889','#f3c69d','#c8825f','#d89e78','#e8c096','#b07a52','#8a5a3c' ],
hair:  [ '#2a1d14','#4a3322','#6b4a2c','#1c1a1f','#7a5a3a','#3a2410','#5a4a42','#2a2018' ],
foliage: [ '#5e9047','#6fa356','#5a9450','#4d8240','#7aab5d','#588a44' ],
```
The Fly hero's red scarf (`#d0473e`) is the brand accent — keep it; it should be the
single most saturated thing the camera usually frames.

### 2.9 ROSTER audit task (`world.js`)
Several authored `wall` hexes in `ROSTER`/`CROSS_ROSTER` drift cool/grey or chalky
(`#9aa8c8`, `#a0b0c8`, `#88a0c0`, `#9ab0c8`, `#b8a0c4`, `#bca0c8`). Re-snap any wall
with HSL saturation > 45% or that reads bluer than the sage relief into the §2.2
warm-dominant family, keeping the cool reliefs to ~1-in-4. Do NOT touch signColor /
awning (those are the legitimate accent layer).

---

## 3. MATERIAL & SHAPE LANGUAGE

### 3.1 Surface finish (roughness / metalness) standard
The town must read **matte and painterly.** Standard ranges:

| Surface | roughness | metalness | Notes |
|---|---|---|---|
| Plaster walls | **0.92–0.96** | 0 | already good; keep |
| Brick | 0.95 | 0 | keep |
| Wood (trim, doors, planks) | 0.80–0.88 | 0 | keep |
| Cream trim / sills | 0.80 | 0 | keep matte |
| Roof tile | 0.88 | 0 | matte, slight relief |
| Cast iron (lamps, benches, rails) | 0.55–0.65 | 0.35–0.45 | **not** shiny; patinated |
| Window glass (dark) | 0.10–0.18 | 0.7–0.85 | reflective but not mirror |
| Car body | 0.32–0.40 | 0.45–0.55 | **lower metalness** than now (was 0.5+); toy-paint, not showroom |
| Chrome (rims, handles) | 0.18–0.25 | 0.85 | reserve chrome for tiny bits only |
| Ground/road | 0.94–1.0 | 0 | fully matte |
| Skin | 0.62–0.70 | 0 | keep |
| Cloth | 0.84–0.88 | 0 | keep |

**Rule:** metalness > 0 is a privilege, not a default. Big surfaces are 0.

### 3.2 Normal-map relief
Keep the procedural normal maps (`plasterNormal/brickNormal/etc.`) — they are a real
asset. Target relief is **subtle**: this is painted plaster, not stucco.

| Map | current normalScale | TARGET |
|---|---|---|
| `MAT.wall` plaster | 0.35 | **0.28** (softer) |
| `MAT.brick` | 0.7 | **0.55** |
| road | 0.45 | 0.40 |
| sidewalk | 0.5 | 0.45 |
| dirt | 0.4 | 0.35 |

Relief should be felt at street level, invisible from the air. Never crank it.

### 3.3 Edges, rounding, bevels
Low-poly **with rounded charm**, never sharp-CAD:
- Big boxes get their corners *softened by trim/cornice geometry* (the cornice +
  string-course system in `buildings.js` already does this — keep and extend).
- Organic props (trees, fountains, characters, the Fly) use **sphere/capsule lobes**
  — the established language. Keep lobe counts low (8–14 segs) for faceted charm.
- NO hard 90° unbroken corners on hero buildings; every building silhouette should
  have at least a cornice cap + base course breaking the vertical edge.
- Doors/windows always get a frame (no glass flush in a wall).

### 3.4 Proportion & silhouette (the "one family" rules)
- **Unit scale (keep):** floor ≈ 3m, NPC ≈ 1.7m, car ≈ 4.3m, lamp ≈ 5m. All assets
  must respect this so the town reads as one toy set.
- **Buildings:** width:height ratio should feel stout and toy-like — favor 3–5
  floors, w 6–12m. Avoid skinny towers except deliberate landmarks (clock tower).
- **Roofline variety is the silhouette:** mix flat-parapet, pitched (townhouse),
  and the occasional dome/lantern (civic). From the air this varied roofscape is the
  composition — push it (§5).
- **Characters:** chunky, rounded, big-head-friendly (the kid/elder/adult system is
  good). Heads ~0.18m radius, readable from 13m. Keep proportions cartoon-soft.
- **The Fly:** rounded, friendly, goggles + red scarf = the readable hero
  silhouette. It must always pop against the warm town — its cool steel-blue body
  (`#33414f`) + warm belly + red scarf is correct; protect that contrast.

---

## 4. LIGHTING & ATMOSPHERE — THE SIGNATURE LOOK

**Signature: warm golden-hour late afternoon.** This is the single most important
section for "cohesion" — light ties every material together. All values below go in
`templates/town.html`. They are starting targets to tune in-engine, but the
*direction* (warm key, cool fill, warm haze, lifted blacks) is fixed.

### 4.1 Renderer (town.html bootstrap)
```js
renderer.outputEncoding = T.sRGBEncoding;          // keep
renderer.toneMapping = T.ACESFilmicToneMapping;    // keep
renderer.toneMappingExposure = 0.98;               // was 0.92 — open up slightly
```

### 4.2 Sun (key light) — `DirectionalLight`
```js
const sun = new T.DirectionalLight(0xffd09a, 2.2); // warm amber, was 0xffd197/2.05
sun.position.set(58, 30, 40);   // LOWER angle (was y=40) → longer raking shadows
// shadow rig: keep 4096 map, radius 4, bias -0.00018, normalBias 0.35
```
A low sun (raking light, long soft shadows) is the heart of golden hour. Lower the
`y` so shadows stretch across the streets.

### 4.3 Hemisphere + fills
```js
const hemi  = new T.HemisphereLight(0xbfd2ec, 0x6b5236, 0.50); // cool sky / warm ground bounce
const fill  = new T.DirectionalLight(0xa9c6ef, 0.30); fill.position.set(-34,22,-30); // cool shade fill
const bounce= new T.DirectionalLight(0xffd9a0, 0.20); bounce.position.set(0,-8,22);   // warm ground bounce up
```
The **warm key vs. cool fill** split is what gives forms dimension and the cozy
"sun + shade" read. Do not let fill go warm or the whole scene flattens.

### 4.4 Fog (atmosphere) — warm haze, not cold
```js
scene.fog = new T.FogExp2(0xe6d2b0, 0.0022);  // was 0xd6e3ee, 0.0024 (cold blue)
```
Warm dusty horizon haze. Density slightly lower so the town stays readable from the
air; the warm color does the mood work, not heavy density.

### 4.5 Sky dome gradient (ShaderMaterial uniforms)
```js
uZ: 0x4f86c4   // zenith  (was 0x3f78bc)
uM: 0xb7cfe2   // mid     (was 0xa8c2e0)
uH: 0xf3cf95   // horizon (was 0xf6c486) — slightly less orange, more golden
```
Also warm the body background CSS `html,body { background:#e6d2b0 }` (was `#b9d2e6`)
so the first paint matches the fog and there is no cold flash before the canvas
loads.

### 4.6 Environment reflection probe (the PMREM mini-scene gradient)
Match it to the sky so glass/metal reflect the right world:
```
gradient: 0(top) #6f9fd0 → 0.55 #e9dcc2 → 1(bottom) #c9b48c
```
(warm the lower stops; currently `#d8eaf4`/`#c8b890` reads cold).

### 4.7 Post stack — bloom
```js
new T.UnrealBloomPass(new T.Vector2(800,600), 0.26, 0.55, 0.86);
//                                            strength threshold radius? 
// strength: 0.26 (was 0.30 — pull back; emissives are too hot)
// threshold: 0.86 (was 0.82 — raise so only true lights bloom, not bright walls)
```
Bloom should kiss the lamp bulbs, lit windows, neon and the sun-side of cream trim —
not haze the whole frame.

### 4.8 Post stack — color grade (GradeShader uniforms)
```js
uCon : 1.10           // contrast (was 1.08) — a touch more snap
uSat : 1.14           // saturation (was 1.16) — pull back a hair to avoid clown
uVig : 0.30           // vignette (was 0.28) — gentle frame darkening
uLift: (0.012, 0.008, 0.004)   // warm lifted shadows (warm-grey blacks, never pure black)
uGain: (1.08, 1.02, 0.90)      // warm highlights (keep blue gain < 1 = golden highs)
```
The **warm lift + warm gain** is the grade signature: shadows are warm-grey, highs
are golden. This is what makes it "painterly," not "rendered."

### 4.9 SAO (contact shadow depth)
Keep enabled (safe-guarded). Slightly strengthen for grounded contact:
```js
sao.params.saoBias = 0.4;
sao.params.saoIntensity = 0.016;   // was 0.010 — a little more contact darkening
sao.params.saoScale = 6; sao.params.saoKernelRadius = 28;
sao.params.saoBlur = true; sao.params.saoBlurRadius = 6;
```
Keep it subtle — SAO is for the soft dirt-in-the-corners feel, not a grime pass.

### 4.10 Emissive discipline (across all asset files)
Because bloom threshold is rising, raise emissive **counts** but TUNE intensities so
they glow without blowing out:
- Lit windows `MAT.glassLit` emissiveIntensity: keep ~1.0–1.1, but ensure lit
  probability (`litP`) stays modest so the town isn't a christmas tree by day.
- Lamp bulbs / string lights: 1.2–1.5 (warm `#ffd27a` family) — these are hero
  glows, let them bloom.
- Neon blade signs: drop to 1.4–1.6 (was 1.8–1.9) and keep them rare.
- Goggle lenses / antenna tips on the Fly: keep — they're brand glints.

---

## 5. COMPOSITION & DISTRICTS

The player sees the town **from the air, looking down a warm street toward a
landmark.** Compose for that.

### 5.1 District color-zoning (assign in `world.js` ROSTER ordering)
Give regions a dominant temperature so the map reads as *places*, not noise:

| District | Where (current layout) | Color character |
|---|---|---|
| **Market / Plaza** | +Z center, plaza & fountain | Warmest: tomato/saffron awnings, terracotta walls, market-stall stripes. The cozy heart. |
| **Civic spine** | plaza-back civics, clock tower, corner landmarks | Cooler & paler: stone-cream walls, slate-green roofs, restrained signage. Gravitas. |
| **Park / leafy** | -Z `PARK_CX` park | Green-dominant: foliage, sage walls on adjacent buildings, soft. |
| **Avenue shops** | the main east-west rows | Warm-dominant mix, the §2.1 3:1 rhythm. Everyday charm. |
| **Cross-street** | the perpendicular block | Slightly more saturated "artisan" feel (CHOCOLATERÍA, PERFUMERÍA) — but still capped. |

Implementation: bias `PAL.walls`/`PAL.roofs` picks by district when authoring, or
re-snap the ROSTER hexes per district per §2.9.

### 5.2 Landmark framing
- The **clock tower** (z = ROWZ+22) is the town's vertical anchor — it should be
  visible from most of the avenue. Light it so its cream stone catches the sun; the
  spire finial already has an emissive — keep it as a beacon.
- The **fountain + plaza** is the warm focal heart — densest props, most lights,
  café tables, market stalls. This is where the eye should rest.
- Corner landmark buildings frame the 4-way intersection — keep them taller (4–5
  floors) so the intersection reads as a "place."

### 5.3 Density gradient
High density (props, lights, NPCs, awnings) at the **plaza & intersection**;
thinning toward the avenue ends and park edges. Empty asphalt at the map edges is
fine — it focuses the eye inward. Avoid uniform prop spacing (the current
`L.rand(5.5, 8.5)` jitter is good — keep it).

### 5.4 What the player sees from the air (priority order)
1. **Rooftops** — the terracotta-dominant roofscape (§2.3) is the #1 surface. Push
   rooftop variety (tile pitch, parapets, the occasional garden/water tank).
2. **Awning stripes & street furniture** — the colorful midground rhythm.
3. **The lit objective beam/ring** (gold pickup / green dropoff) must always read
   against the warm town — keep those HUD-world markers saturated and bright.
4. **Long raking shadows** across the streets — the golden-hour signature.

### 5.5 Vertical interest
Hanging banners, festoon string-lights across the avenue, tram overhead wires, and
balconies give the *air-space* texture so flying through feels rich. Keep and
slightly increase festoon-light density near the plaza.

---

## 6. UI / HUD VISUAL LANGUAGE

The HUD lives in `town.html` (`<style>` + markup) and `game.js` (injected CSS).
Goal: **warm, soft, glassy, cohesive with the town** — the same cozy hand as the
world. Currently the HUD is cool-blue-grey glass; nudge it warm to match the new
palette.

### 6.1 Type
- Family: `ui-rounded, "SF Pro Rounded", system-ui, sans-serif` (keep — rounded is
  on-brand). Monospace only for the controls hint.
- Weights: labels 800, big numbers 800–900, body 600–700.
- Micro-labels uppercase, letter-spacing `.12–.14em` (keep).

### 6.2 Color tokens (define once, reuse)
```
--glass-bg     rgba(28,22,16,0.58)   /* warm-dark glass, was cool rgba(14,20,30,.62) */
--glass-brd    rgba(255,244,222,0.16)
--glass-shadow 0 8px 28px rgba(20,12,4,0.30)
--accent-gold  #ffd27a   /* primary accent — pickup, timer warm end, combo */
--accent-green #7fe0a0   /* success — delivery, score */
--accent-blue  #9fd0ff   /* info — new job, time label */
--accent-warn  #ff8f8f   /* low-time / combo-lost */
--text         #fff5e9   /* warm white, not pure #fff */
```
Swap the existing cool `rgba(14,20,30,.x)` panel backgrounds for `--glass-bg` so the
HUD glass feels lit by the same golden room.

### 6.3 Layout / spacing / shape
- Corner radius: **14px** for primary panels (task/score), **12px** for secondary
  (timer/combo), **10px** for chips (dist/hint/best), **14px** minimap. (Matches
  current — keep consistent.)
- Padding: 10–15px panels. Edge margin 16px. (Keep.)
- Glass: `backdrop-filter: blur(10px)` primary, `blur(6–8px)` secondary. (Keep.)
- Soft drop shadow on every floating panel (`--glass-shadow`).

### 6.4 Minimap (`game.js` drawMap)
- Footprint fill: warm `rgba(46,40,28,0.55)` (was greenish `rgba(40,52,40,.55)`).
- Avenue band: `rgba(150,140,120,0.5)` warm stone (was cool grey).
- Address dots: `rgba(244,234,210,0.55)` cream.
- Objective dot: pulsing `--accent-gold` (pickup) / `--accent-green` (dropoff). Keep.
- Player triangle: `--accent-blue`, red `#ff7a7a` when stunned. Keep.
- Round the canvas corners visually with the 14px container radius (keep).

### 6.5 Toasts / feedback
- Big center toast: 30px/900, warm text-shadow `0 4px 18px rgba(40,20,0,.5)`,
  scale-in (keep the `.show` transform).
- Color-code by event using the tokens: gold = pickup, green = delivery, blue =
  info/express, warn = penalty. (Already wired — keep, just use warm token hexes.)
- Combo readout glows gold with `text-shadow:0 0 10px rgba(255,200,90,.5)` (keep).

### 6.6 Loading screen
- Background gradient warm: `radial-gradient(120% 120% at 50% 30%, #3a2c1e, #15100a)`
  (was cool `#2a3a52/#131a26`) so even the loader feels golden.
- Loader bar fill stays `--accent-gold`. Keep the title weight/spacing.

---

## 7. PRIORITIZED BACKLOG (P0 / P1 / P2)

Tasks are grouped so disjoint files can be worked in parallel. **P0 = biggest
aesthetic win for least effort.** Owning file(s) in the right column.

### P0 — golden-hour cohesion (do first; mostly tuning)
| # | Task | Owning file(s) |
|---|---|---|
| P0-1 | Re-grade lighting to golden hour: warm sun `#ffd09a`/2.2 at lower angle, hemi `#bfd2ec`/`#6b5236`/0.50, warm fill split, exposure 0.98 (§4.1–4.3) | `town.html` |
| P0-2 | Warm the atmosphere: fog `#e6d2b0`/0.0022, sky uH `#f3cf95`/uM/uZ, env probe warm stops, body bg `#e6d2b0` (§4.4–4.6) | `town.html` |
| P0-3 | Tune post: bloom strength 0.26 / threshold 0.86; grade warm lift+gain, sat 1.14, con 1.10; SAO intensity 0.016 (§4.7–4.9) | `town.html` |
| P0-4 | Re-harmonize `PAL.walls`, `PAL.roofs`, `PAL.trims`, `PAL.awning` to the §2.2–2.5 curated sets | `lib.js` |
| P0-5 | Fix muddy ground/road: warm `dirtTex` `#b3a07e`, `roadTex` `#4a4640`, `sidewalkTex` `#cabda4` (§2.6) | `lib.js` |

### P1 — material & palette polish
| # | Task | Owning file(s) |
|---|---|---|
| P1-1 | Audit & re-snap cool/grey ROSTER + CROSS_ROSTER `wall` hexes into warm-dominant 3:1 rhythm (§2.9); zone districts (§5.1) | `world.js` |
| P1-2 | Lower car/truck body metalness to ~0.45 & roughness ~0.35; reserve chrome for tiny bits (§3.1) | `props.js` |
| P1-3 | Soften normal-map relief: plaster 0.28, brick 0.55, road/sidewalk/dirt (§3.2) | `lib.js` |
| P1-4 | Re-harmonize `PAL.cloth`/`skin`/`hair`/`foliage` + character accent palettes to town (§2.8) | `lib.js`, `characters.js` |
| P1-5 | Warm the HUD: swap cool glass bg for warm `--glass-bg`, warm `--text`, define tokens (§6.2) | `town.html`, `game.js` |
| P1-6 | Warm the minimap fills + loader gradient (§6.4, §6.6) | `game.js`, `town.html` |

### P2 — depth & charm extras
| # | Task | Owning file(s) |
|---|---|---|
| P2-1 | Bias rooftop selection toward terracotta tiles; add pitched/tiled roof variety to non-townhouse archetypes for a richer aerial roofscape (§5.4) | `buildings.js` |
| P2-2 | Tune emissive intensities down per §4.10 (windows, neon, lamps), raise lamp/festoon glow counts near plaza | `buildings.js`, `props.js`, `world.js` |
| P2-3 | Increase plaza/intersection density gradient: more lamps, planters, café tables, string-lights at the focal heart; thin toward edges (§5.3) | `world.js` |
| P2-4 | Light the clock tower as a beacon (catch sun on cream stone, keep finial glow); ensure landmark framing (§5.2) | `world.js` |
| P2-5 | Add subtle warm window-glow falloff at dusk-readability; verify the Fly's red scarf stays the most-saturated framed object (§2.8, §3.4) | `characters.js`, `game.js` |

### Parallelization note
- `town.html` (P0-1/2/3, P1-5/6) — one owner, lighting+post+HUD, no code conflicts
  with assets.
- `lib.js` (P0-4/5, P1-3/4) — palette/material owner; everything downstream inherits.
  Land this early so other files pick up the new PAL.
- `buildings.js` / `props.js` / `characters.js` / `world.js` are disjoint and can be
  worked simultaneously **after** `lib.js` PAL lands.

---

## APPENDIX A — QUICK-REFERENCE PALETTE CARD

```
WALLS (warm dominant):  d8a877 cf9a6e e0bd8c caa074 d9b07e c08a63 e3c79a c99a8a d4a890
WALLS (cool relief):    9fb0a0 9eb2bd aeb39a
ROOFS:                  a85f43 9c5740 b56b48 7d6a52 6f7d68 8a5446
CREAM/TRIM:             f4ead2 efe2c6 f1e7d0 e8dabb     (canonical: f1e7d0)
AWNING ACCENTS:         c8504a cf8a3c 3f7d6e 3a6a92 8a5288 b0506a d8b14a
GROUND:                 dirt b3a07e · road 4a4640 · sidewalk cabda4 · plaza cabfa6 · grass 7aa257
SKY:                    zenith 4f86c4 · mid b7cfe2 · horizon f3cf95
FOG:                    e6d2b0
SUN:                    ffd09a @ 2.2   HEMI sky bfd2ec / ground 6b5236
HUD GLASS:              rgba(28,22,16,0.58)   TEXT fff5e9
HERO ACCENTS:           gold ffd27a · green 7fe0a0 · info 9fd0ff · scarf-red d0473e
```

## APPENDIX B — THE COHESION CHECKLIST (paste into PR reviews)
- [ ] No big surface above 45% saturation.
- [ ] ≤ 2 saturated accents per building.
- [ ] All trim/sill/frame cream comes from the §2.4 family.
- [ ] ~3 warm walls : 1 cool wall per block.
- [ ] metalness = 0 on all big surfaces.
- [ ] Shadows are warm-grey, highlights golden (grade lift/gain respected).
- [ ] Emissives glow but don't blow out under bloom (threshold 0.86).
- [ ] Rooftops read terracotta-dominant from the air.
- [ ] The Fly's red scarf is the most saturated thing usually on screen.
