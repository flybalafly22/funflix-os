# Costa Vista — Production Backlog (Meridian Interactive)

Ordered by **leverage ÷ risk**. Each item names the owning department and the _Messenger_
inspiration it serves. DoD = QA gates green + scoreboard delta justified.

## Sprint 1 — Art-direction foundation (no new render targets; safe + high leverage)
- [ ] **S1.1 Posterize / toon-band knob in GradeShader** — Art Dir + Tech Dir.
  Quantize luminance into N bands, blended 0..1 (default subtle). The _Sable_-ish cohesion,
  done inside the existing grade pass → zero new passes, zero perf risk.
- [ ] **S1.2 Gradient atmospheric sky + matched fog** — Environment Artist.
  Richer vertical sky gradient; fog tuned so the city fades into the sky (calm depth).
- [ ] **S1.3 Fresnel rim-light via `onBeforeCompile`** — Technical Director.
  Soft stylized silhouette glow injected into existing MeshStandard materials (no replacement).
- [ ] **S1.4 Palette cohesion + vignette + ordered dithering** — Art Director.
  Push toward a serene limited palette; dither to kill 8-bit banding the posterize introduces.

## Sprint 2 — The signature outline (depends on R&D r128 recipe)
- [ ] **S2.1 Depth/normal Sobel silhouette OUTLINE post pass** — Tech Dir + Lead Programmer.
  Crisp dark edge lines = the _Messenger_/_Sable_ signature read. Insert before bloom; keep 60fps.

## Sprint 3+ — Feel, UI, life
- [ ] **S3.1 Camera accessibility: auto-align when coasting** — Lead Designer. (_Messenger_ auto-centering.)
- [ ] **S3.2 Animated UI / micro-animation + first-10-seconds title polish** — Animation Dir + Marketing.
- [ ] **S3.3 Expressive character + quick emote wheel** — Character Artist + Lead Writer. (_Messenger_ emoji.)
- [ ] **S3.4 Calm-but-alive soundscape pass** — Audio Director.
- [ ] **S3.5 District identity / landmark sightlines** — Level Designer.

## Done (prior cycle, carried forward)
- Car grip model rebuild (steer-skids-wrong-way fixed, objectively verified).
- gfx-cycle iters 1–5 (6.1 → 8.1): controls, lighting, materials, VFX, map expansion.
