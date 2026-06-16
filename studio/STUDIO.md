# ◢◤ MERIDIAN INTERACTIVE — Costa Vista Studio Charter

A virtual game studio stood up to take **Costa Vista** (the GTA-style browser game at
`templates/fly.html`) to its best achievable quality and player experience, drawing
direct inspiration from **abeto's _Messenger_** (https://messenger.abeto.co/) — a
Three.js/WebGL game whose acclaim comes from *art-directed restraint*, not realism.

> Founded 2026-06-16. Mandate: continuous improvement loop until best quality / diminishing returns.

---

## ★ Creative Thesis (the lesson from _Messenger_)

_Messenger_ (studio abeto, Sept 2025) is a Three.js game where a kid delivers mail on a
tiny round planet. Critics and Awwwards praised it for being *"somewhere between strangeness
and calm,"* compared to **_Sable_** and **_Wheel World_**. What makes it feel premium is **not**
fidelity — it loads just 5.7 MB. It is:

1. **A confident, cohesive art direction** — flat/posterized shading, deliberate **silhouette
   outlines**, a *serene limited palette*, custom toon/outline shaders.
2. **Atmosphere over detail** — soft gradient skies, matched fog, calm mood; the world fades
   into the sky.
3. **WebGL-native, animated UI** — every UI detail animates; the interface is part of the world.
4. **Accessibility** — automated camera centering; playable by non-gamers.
5. **Restraint** — they *cap* clutter (10 players max) to protect the mood.

**Strategic implication for Costa Vista:** the realism path capped at **8.1/10** because
browser realism has a hard ceiling (no baked GI, no mocap, no streamed scale). The way *past*
that ceiling is a **stylized art-direction layer** — outlines, posterized cohesion, gradient
atmosphere, expressive characters, animated UI — that reads as *more* polished with *less*.
We will not throw away Costa Vista's identity; we will **art-direct it** toward a cohesive,
premium, slightly stylized "modern open-world, hand-finished" look.

**Hard constraints (unchanged studio ethos):** Three.js **r128** only · **no external assets**
(everything procedural/canvas/in-code) · hold **60fps** · never break story mode / save-load /
day-night / traffic / audio.

---

## ◢◤ Org Chart & Role Mandates (20 roles)

### Executive
| Role | Mandate on Costa Vista |
|---|---|
| **CEO** | Owns the quality bar and the stop condition. Greenlights each sprint, kills scope that doesn't raise the score, protects the 60fps/no-assets ethos. Final arbiter when departments disagree. |
| **Producer** | Owns the sprint cadence and the loop. Sequences work by leverage-per-risk, keeps the scoreboard, calls "ship it" vs "iterate." |
| **Project Manager** | Owns the backlog (`studio/backlog.md`), dependencies, and the definition-of-done (QA gates green) for every item. |

### Creative leadership
| Role | Mandate |
|---|---|
| **Creative Director** | Owns the _Messenger_-inspired thesis above. Every change must serve "cohesive, calm-confident, art-directed." Vetoes anything that adds noise without mood. |
| **Technical Director** | Owns the render pipeline & architecture: EffectComposer pass order, the new outline/atmosphere systems, perf budget. Signs off that r128 + 60fps + no-assets hold. |
| **Narrative Director** | Owns tone & world fiction (Costa Vista: a sun-warmed coastal city; Ibarra/Rico/Marisol story). Ensures art & systems reinforce the story's mood. |

### Design
| Role | Mandate |
|---|---|
| **Lead Designer** | Owns game-feel: controls, camera accessibility (auto-centering à la _Messenger_), moment-to-moment driving & on-foot feel. |
| **Level Designer** | Owns the map: district identity, landmarks, sightlines, the "circle the world with no walls" sense of place. |
| **AI Systems Designer** | Owns traffic, pedestrians, police/wanted behavior — believable, calm-but-alive city life. |
| **Lead Writer** | Owns mission text, signage, emotes/expression copy — the diegetic voice. |

### Art
| Role | Mandate |
|---|---|
| **Art Director** | Owns palette, lighting mood, material cohesion, the stylization blend knob. Guardian of restraint. |
| **Character Artist** | Owns the player & NPC silhouettes, readability, expressive/emote support. |
| **Environment Artist** | Owns facades, props, foliage, road surfaces, skyline composition. |
| **Animation Director** | Owns motion: vehicle weight, camera spring, character locomotion, UI micro-animation. |

### Engineering
| Role | Mandate |
|---|---|
| **Lead Programmer** | Owns code health of `fly.html`, integration of all systems, no-regression discipline. |
| **Gameplay Programmer** | Implements controls/camera/physics & feel changes. |
| **AI Programmer** | Implements traffic/ped/police systems and optimizations (instancing, culling). |
| **Audio Director** | Owns the procedural WebAudio mix — engine, ambience, radio, calm-but-alive soundscape. |

### Operations
| Role | Mandate |
|---|---|
| **QA Lead** | Owns the Playwright harness/drive/tour + the objective control tests. Nothing ships without green gates. |
| **Marketing Director** | Owns the player-facing first impression: title screen, the "wow" of the first 10 seconds, shareability. |

---

## ◢◤ Operating Model — how the studio actually runs (honest note)

To respect cost and avoid 20 cold-start agents each re-reading 4,200 lines of `fly.html`,
the studio runs as: **one integrating lead (with full codebase context) embodying every
department**, plus **targeted specialist subagents spawned only where fresh parallel work
adds real value** (e.g. an R&D agent compiling r128 outline/toon/atmosphere recipes — work
that needs *no* codebase context). Each department's *output* is real; the *compute* is
consolidated. This is the same model that lifted Costa Vista 6.1 → 8.1 in the prior cycle.

## ◢◤ The Quality Loop

Scoreboard: `qa/scoreboard3.md`. Rubric 0–10 per dimension vs. a *cohesive stylized
open-world* bar (where _Messenger_/_Sable_-class art direction = 10).

**Each sprint:** Creative+Art+Tech pick the highest leverage-per-risk item → Gameplay/Env/AI
implement → QA runs gates (renders · 0 console · 0 page · load < 8s · 60fps · drive/tour 0 errors
· objective control tests) → Producer scores the board → commit → deploy.

**Stop when** average ≥ **8.8/10** on the new stylized rubric, **OR** a sprint yields **< 0.2**
gain, **OR** the 6-sprint cap is reached — whichever comes first.
