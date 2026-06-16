# Costa Vista — Graphics / Feel / Map Revamp Backlog

Council deliverable: IDEATION + DESIGN LEAD. Target: get a single-file Three.js r128, zero-asset
browser game as close to GTA V / Watch Dogs / Forza Horizon as the platform allows, holding 60fps
on M3 and degrading on touch. All items are achievable in r128 with procedural/canvas content only.

**Effort:** S (<1h), M (half day), L (1+ day). **Perf risk:** low / med / high (60fps M3 budget).

Note from code review: the chase cam already has a speed look-ahead lead and a fast catch-up lerp.
The real feel gap is that `camYaw` only follows heading on foot — in a vehicle it is drag-only, so
the camera does NOT auto-orbit behind the car through corners. That reframes track (A) below.

---

## TOP 12 — RECOMMENDED EXECUTION ORDER

1. ★ (A) Auto-realign chase yaw behind vehicle heading + steer-anticipation lead
2. ★ (A) Decouple physics from framerate: fixed-timestep accumulator for car integration
3. ★ (A) Counter-steer-friendly grip curve + speed-sensitive steering rework
4. ★ (B) Real day-night sun color/intensity ramp driving exposure + fog color
5. ★ (D) Reinhard-option + tuned ACES, plus night-graded bloom threshold
6. ★ (C) Screen-space wet-road reflection strip (second render target, road-only)
7. ★ (E) District zoning: 3 visually distinct neighborhoods via instanced building variety
8. ★ (B) Fake CSM: tighten shadow frustum to camera + dual-cascade near/far split
9. ★ (F) Instanced vertex-colored building variety (kill the monotone grid)
10. ★ (D) Velocity-buffer motion blur on the grade pass (radial + directional)
11. ★ (E) Map expansion: extend BOUND_Z south into a hills/freeway zone
12. ★ (C) Procedural normal/roughness detail on asphalt + puddle mask for wetness

---

## (A) CONTROLS & CAMERA FEEL

### A1 ★ Auto-realign chase yaw behind heading + steering anticipation  — S — low
WHY: The single biggest "swimmy" complaint. Today `camYaw` is manual-drag-only in a vehicle, so
cornering whips the car out of frame. Modern chase cams sit behind the car and *lean into* turns.
HOW: When `currentV && !dragging && camId===null`, `camYaw = lerpAngle(camYaw, v.heading + Math.PI + steerLead, k)`
where `steerLead = -steerVisual * 0.18 * spdF` (anticipates the apex) and `k = min(1, dt*2.5)` (fast
enough to track, slow enough to feel weighty). Keep manual drag override with a 1.5s re-arm timer.

### A2 ★ Fixed-timestep physics accumulator  — M — low
WHY: All car integration is raw `*dt`. On frame spikes the grip/slip model (`v.lat`, recover terms)
becomes non-deterministic — drifts feel inconsistent, collisions tunnel. Sim games lock the step.
HOW: Accumulate frame dt; run the car/traffic step in fixed 1/120 substeps (`while(acc>=h){step(h)}`),
render-interpolate mesh position/heading by the leftover fraction. Wraps existing block 3500-3600.

### A3 ★ Grip curve + speed-sensitive steering rework  — M — low
WHY: `steerAuth = clamp(1.25 - speed/(maxV*1.7), .42, 1)` is linear and the grip recover is a flat
exponential — there's no rewarding catch/counter-steer window, and low-speed turning feels heavy.
HOW: Replace steerAuth with a smooth curve `0.35 + 0.65*exp(-speed/12)`; make lateral recover scale
with how aligned steer is to slip (counter-steer = faster recover → stable slides). Add a small
self-aligning torque pulling `heading` toward velocity vector so letting off straightens you out.

### A4 Analog throttle/brake ramp + clutch-kick launch  — S — low
WHY: Throttle is binary (`v.vel + accel*dt`). Real feel comes from a throttle that ramps in and an
initial launch punch.
HOW: Track `throttle01` that lerps toward gas (dt*4); `accel * throttle01 * (1 + launchBoost)` where
launchBoost decays from 0.6 over the first second of standstill→go.

### A5 Brake-light / reverse / handbrake input clarity + gamepad axes  — S — low
WHY: S both brakes and reverses with no neutral; handbrake on Space conflicts with jump.
HOW: Brake while moving forward, reverse only after a ~0.3s hold at near-zero. Read `navigator.getGamepads()`
for analog steer/trigger axes in the input poll (already have a `pad` struct to populate).

### A6 Camera FOV + boom kick on collision / drift, settle spring  — S — low
WHY: Impacts already `shake`, but FOV stays calm. A short FOV+pullback punch sells weight.
HOW: On crash, add a decaying `camKick` to `camDist` and `camFov` (impulse, critically-damped spring
return). Reuse existing `hitPause`/`shake` triggers.

---

## (B) LIGHTING & ATMOSPHERE

### B1 ★ Day-night sun ramp drives exposure + fog tint + hemi balance  — M — med
WHY: Tone mapping exposure is a fixed 0.92 and fog is a fixed blue. The day-night cycle already moves
sun color/elev — but the renderer exposure and fog don't follow, so dusk/night look mis-exposed.
HOW: In the existing sky update, drive `renderer.toneMappingExposure` (≈1.05 noon → 0.7 night),
`scene.fog.color` (lerp day-blue → sunset-orange → night-indigo, you already compute `skyCol`), and
hemi ground color. Cheap, transforms mood. Med risk only because exposure shifts interact with bloom.

### B2 ★ Fake CSM — camera-tracked tight shadow frustum + 2-split  — M — med
WHY: One 2048 shadow map spans a 190-unit ortho box → soft, low-res contact shadows near the car.
HOW: Each frame recenter `sun.shadow.camera` on the player and shrink the ortho box to ~60 units
(crisp near shadows); optionally a second cheap DirectionalLight with a wide box + low map for far
objects, toggled off on touch. `sun.shadow.camera.updateProjectionMatrix()` after resize.

### B3 Volumetric god-ray hint via radial sun streaks in grade  — M — med
WHY: A sun low on the horizon should bleed light shafts — huge for the "golden hour" Forza look.
HOW: Project sun world pos to screen; in GradeShader add a cheap radial blur sampling toward the
sun screen-uv (8 taps) masked by a bright-pass — only when sun is near horizon and on-screen. Gate
off on touch. Reuse the bloom bright buffer if available.

### B4 Animated sky gradient + horizon haze band  — S — low
WHY: The sky sphere is static per time-of-day; a horizon haze band adds depth.
HOW: Add a brighter low-saturation band near horizon v in the procedural sky canvas; rebuild the
PMREM env only on coarse time-of-day buckets (not per frame) to keep cost near zero.

### B5 Window-light variety + warm interior glow at night  — S — low
WHY: `windowMats` already follow night, but every window lights uniformly → flat.
HOW: Per-building random emissive intensity + a few warm vs cool hues; randomize which windows are
"off". Pure material tweak, zero perf cost.

### B6 Local headlight cones light the road (already spotlights — add falloff cookie)  — S — low
WHY: Headlamp spotlights exist but project as flat circles.
HOW: Give the SpotLights a canvas-generated `map` (elongated soft beam cookie) and `penumbra` ~0.4.

---

## (C) MATERIALS & SURFACES

### C1 ★ Screen-space wet-road reflection strip  — L — high
WHY: Reflective wet asphalt is THE signature Watch Dogs / night-GTA look.
HOW: Second `WebGLRenderTarget` at half-res; render scene mirrored under the ground plane (flip Y,
clip above road) OR cheaper: re-use the camera color buffer and sample it inverted-V in a custom road
ShaderMaterial blended by a wetness mask. Half-res, road-tiles only, desktop-only, gated behind a
"wet" weather state. High risk → ship behind a quality toggle; start with the cheap fake.

### C2 ★ Procedural asphalt normal + roughness + puddle wetness mask  — M — med
WHY: Roads use a bump map only; no roughness variation, so they read as uniform matte plastic.
HOW: Generate a `normalMap` and `roughnessMap` from the existing asphalt canvas (height→normal via
Sobel). Add a low-freq puddle mask that, when `wet>0`, drops roughness to ~0.08 in puddles → sharp
env reflections for free off the PMREM map. Pairs with C1/D-rain.

### C3 ★ Triplanar-ish vertex AO + grime gradient on buildings  — M — low
WHY: Buildings are flat-shaded boxes; real cities have dirt streaks and base grime.
HOW: Bake a vertical AO/grime gradient into building geometry vertex colors (`color` attribute,
`vertexColors:true`) — darker at ground and under ledges. No texture, no draw-call cost.

### C4 Car paint flake + clearcoat tuning per vehicle class  — S — low
WHY: All paint is `clearcoat:1, roughness:0.3` — sport cars should look glossier, beaters duller.
HOW: Per-KIND clearcoatRoughness/roughness; add faint metallic-flake via a sparse noise in the paint
canvas. `MeshPhysicalMaterial` already in use (line 1682).

### C5 Sand/beach + water normal animation  — S — low
WHY: Water is a static plane with envMapIntensity; it doesn't move.
HOW: Scroll two `normalMap` offsets in opposite directions each frame on the water material (canvas
ripple normal); animate a foam line at the sand boundary via an emissive sine band.

### C6 Sidewalk/curb wear + decals (cracks, manhole, paint)  — S — low
WHY: Pristine sidewalks read as "untextured prototype".
HOW: Add cracks/stains/manhole circles to the concrete canvas; sprinkle a few additive-blended decal
planes (paint arrows, crosswalk) at intersections, instanced.

---

## (D) VFX & POST-PROCESSING

### D1 ★ Tuned ACES + Reinhard A/B + night-aware bloom threshold  — S — low
WHY: ACES at fixed exposure crushes night neon and can wash noon. A togglable Reinhard often reads
cleaner for neon-heavy night.
HOW: Expose a tone-map switch; raise bloom threshold at day / lower at night by feeding `sky.nightF`
into the UnrealBloomPass `threshold` (and slightly higher `strength` at night). One-line per-frame.

### D2 ★ Velocity / radial motion blur in grade pass  — M — med
WHY: Speed currently only tightens a vignette. Real motion blur sells velocity.
HOW: In GradeShader, add a radial blur centered on screen (6-8 taps toward center) scaled by `uSpeed`;
add a directional component from camera yaw delta. No depth buffer needed for the radial fake. Keep
sample count low; desktop-only.

### D3 ★ Rain + wet-road weather state  — L — med
WHY: Weather variety is a massive open-world atmosphere multiplier and unlocks C1/C2 reflections.
HOW: A `Points` cloud of streak sprites around the camera (recycled, falling, slight camera-relative
wind), a fullscreen rain-streak overlay quad in the grade pass, a `wet01` global that ramps puddle
masks (C2) and reflection strength (C1), plus distant lightning = a brief exposure/ambient flash.

### D4 Chromatic aberration + barrel at screen edge, speed-scaled  — S — low
WHY: Subtle edge CA is a cheap "expensive camera" tell.
HOW: In GradeShader sample R/G/B at slightly offset uvs scaled by `r2 * uSpeed`. ~3 extra taps.

### D5 Depth-of-field hint on far fog + bloom-on-near  — M — high
WHY: Cinematic focus separation. High risk: true DoF needs depth pass.
HOW: Cheap fake — push fog start so distant geometry softens; or a half-res blur composited by a
linear-depth ramp from a `MeshDepthMaterial` pre-pass. Only if budget allows; lowest priority.

### D6 Tire smoke + spark + dust particle pools  — M — med
WHY: Skid marks exist but no smoke/spark volume; drifts look flat.
HOW: Recycled additive `Sprite` pool emitted from rear axle under `v.drift`, plus orange spark sprites
on crash. Cap the pool (≈40) and fade by age. Touch: skip.

---

## (E) MAP EXPANSION & WORLD DETAIL

### E1 ★ District zoning — 3 distinct neighborhoods  — L — med
WHY: The grid is visually uniform; real cities have downtown / residential / industrial character.
HOW: Partition the existing block grid by region: tall glass towers + dense signage downtown (NE),
low pastel villas + gardens residential (SW), warehouses + silos + cranes industrial (SE near beach).
Drive building-height ranges, palette, and prop density off the block's region. Reuses existing
building builders; mostly a parameterization + palette pass.

### E2 ★ South map expansion — hills + coastal freeway  — L — med
WHY: A 290x284 box feels small. Extending one axis adds the "open road" Forza fantasy.
HOW: Grow `BOUND_Z` southward; add a low-poly rolling-hills plane (displaced PlaneGeometry via the
existing height noise), a raised freeway ribbon with on/off ramps (extruded path), and re-seed ambient
traffic onto it. Watch shadow frustum (B2) and fog falloff so far terrain stays cheap.

### E3 Parametric block generator + alleys / backstreets  — M — med
WHY: Roads are a fixed 7x7 array; no alleys, dead-ends, or plazas → predictable.
HOW: Replace fixed `ROADS_X/Z` with a generator that inserts occasional half-width alleys and a
central plaza/park superblock. Regenerate colliders + traffic waypoint graph from the same data.

### E4 Landmarks — silhouette anchors for navigation  — M — low
WHY: No skyline read; players orient by landmarks (Forza's mountain, GTA's stadium).
HOW: 3-4 hero structures: a lighthouse on the beach point, a stadium/arena ring, a radio tower with
blinking aviation light, a pier with a ferris wheel (instanced spokes). All box/cylinder primitives.

### E5 World detail pass — overpasses, billboards, street clutter  — M — med
WHY: Empty roadsides read as sterile.
HOW: Instanced traffic cones, dumpsters, newspaper boxes, bus stops, animated billboard sprites
(canvas video-ish loop), tunnel/underpass for one road. All additive to existing instanced-prop system.

### E6 Traffic density LOD + parked-car variety + crossing peds  — M — med
WHY: Ambient traffic is capped low; parked cars repeat 6 colors.
HOW: Scale `AMB_MAX` by distance-culled visibility; add color/mesh variety + a few trucks/vans;
spawn pedestrians at crosswalks that wait on lights (reuse signage red/green state).

---

## (F) VEHICLE / CHARACTER VISUAL FIDELITY

### F1 ★ Instanced vertex-colored building variety  — M — low
WHY: Buildings share materials → the city reads as cloned even with C3 grime. Variety is the fix.
HOW: Where buildings are box stacks, push them through `InstancedMesh` with `setColorAt` per instance
(palette-jittered per region from E1), plus per-instance scale jitter. Cuts draw calls AND adds
variety. The biggest single visual-density win for the cost.

### F2 ★ Car body fidelity — bevels, mirrors, wheels, brake glow  — M — low
WHY: Cars are box chassis; up close they're plain. Modern feel needs silhouette detail.
HOW: Add chamfered body panels (extra boxes), side mirrors, exhaust, a windshield rake, multi-segment
wheels with rim spokes (low-radial cylinders). Add emissive brake-disc glow that pulses on hard brake
(you already track `playerBraking`). Keep the player car higher-detail than traffic (LOD by role).

### F3 Character mesh upgrade — limbs, walk cycle polish, idle  — M — med
WHY: Pedestrians/player are simple capsule-ish meshes; close-up they break immersion.
HOW: Segment arms/legs into upper/lower with a sine-driven walk cycle (phase by speed), add a head-bob
and idle sway. Skinning is overkill in r128 no-asset — use grouped box limbs with rotation.

### F4 Per-vehicle damage deformation + dirt accumulation  — M — med
WHY: Damage already limps the car but the mesh doesn't visibly crumple.
HOW: On `damageVehicle`, randomly displace front/rear panel vertices inward (geometry already owned),
darken paint, add a soot/dirt vertex-color overlay that grows with distance driven.

### F5 Brake / reverse / indicator lights driven by input  — S — low
WHY: `tlMat` tail-light is static; brake lights should brighten on brake, whites on reverse.
HOW: Drive tail emissiveIntensity from `playerBraking`; add reverse-white quads when `v.vel<0`;
optional turn-signal blink keyed to steer at low speed. Pure emissive tweak, bloom does the glow.

### F6 Player on-foot polish — shadow blob already exists, add jump/land squash  — S — low
WHY: On-foot traversal feels stiff next to the driving.
HOW: Squash-and-stretch on jump/land, a faint dust puff sprite on landing, arm swing during run.

---

## Perf guardrails (apply throughout)
- Anything sampling a second render target (C1, D2 heavy, D5) = desktop-only, behind a quality flag,
  half-res target, and skipped on `IS_TOUCH`.
- Prefer `InstancedMesh` + `setColorAt`/`setMatrixAt` over new meshes (E5, F1) to protect draw calls.
- Per-frame work that can bucket (PMREM rebuild B4, minimap) must throttle — never rebuild env per frame.
- Validate 60fps on M3 after B2 (shadow recenter) and after each render-target add; budget is tight.
