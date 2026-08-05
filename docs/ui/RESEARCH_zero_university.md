# Benchmark research: zero.university (2026-08-06)

Research: THE REFINERS + R&D LAB. UI/UX: CADENCE. Goal: pull The Trainer's landing
up to this caliber.

## What makes zero.university feel like a top-tier site (17 principles, distilled)
1. Powerful first impression: opens on the USER's frustration, not the company.
2. Storytelling, not sections: each scroll is the next chapter (progressive disclosure).
3. Ruthless visual hierarchy: one focal point per screen.
4. Oversized typography, very short sentences, strong keywords, high contrast.
5. Generous white space (premium = room to breathe).
6. Purposeful motion: scroll-triggered fades, cinematic, never decorative; rich micro-interactions.
7. REAL product mockups (not illustrations) = authenticity + trust.
8. Minimal palette (white/black/grey), accent only where it matters.
9. Consistent design system; 10. disciplined grid/alignment.
11. Emotional copy: outcomes over features ("Learn. Build. Get hired.").
12. Low cognitive load: one idea per screen. 13. Focused nav toward one goal.
14. Confident, minimal, slightly rebellious brand voice.
15. Psychology: progressive disclosure, curiosity loops, social proof, CTAs.
16-17. It creates a FEELING and feels REAL because nothing is decorative; every
element is intentional, so it reads as handcrafted.

## How the Voice landing applies it
- First impression = the coach's time-aware greeting + a blunt thesis ("Every other
  app hands you a template and walks away. I don't.").
- Storytelling = the landing IS a guided conversation; scroll-triggered reveals so
  each section unfolds like a chapter.
- Real product = the "your first week" card + the pre-filled intake card (actual
  interfaces, not art).
- Emotional, outcome copy; minimal warm palette + one green accent; big serif voice;
  one question on screen at a time (low cognitive load).

## The integration (the owner's ask): landing -> app continuity
The conversation IS the intake. As the user answers, a live **"Your file"** panel
fills (name, goal, anchor, today). On the real site the landing writes this to
`localStorage.trainerHandoff = {name, goal, anchor, feel, at}`. When the user opens
`/trainer`, the app reads it, greets by name, and pre-fills the intake (4 of ~6
fields already done: "two questions left, not thirteen"). Logged sets then carry the
same file forward; it syncs across devices once an account is made, and never leaves
the device until then. This is what makes the site feel integrated and useful, not a
marketing page you bounce off.

Prototype: private Artifact, not deployed. Ship only on explicit owner go-ahead.
No em-dashes anywhere (owner rule).
