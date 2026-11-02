# Maze of the Minotaur roadmap

## FPS-R1 — Solo real-time foundation

Merged. Established the solo FPS runtime, WebGL 2 renderer, direct attacks, moving world enemies, inventory, progression, and versioned save foundation.

## FPS-R2A — Greek rebrand and Floor Guardians

Merged. Establishes the Labyrinth identity, local mythic pixel art, Greek class and content presentation, Guardian-gated descents for the first five floors, and migration of R1 expedition progress into a new save namespace.

## FPS-R2B — Mythological combat and enemy AI

Implemented in the R2B branch. Adds timed role-based enemy patterns, line-of-sight rules, status effects, shield defense, weapon-specific hit shapes, clearer animation/VFX/audio feedback, and a one-time Warden phase transition. The five Guardian IDs and gated descent state are preserved. See [combat audit and implementation](FPS_R2B_COMBAT_AUDIT.md).

## FPS-R3 — Procedural pixel animation and VFX

- Produce broader authored animation frames and segmented sprite layers beyond the state transforms and pixel VFX foundation shipped in R2B.
- Expand class-specific weapon presentation and distinct enemy reactions.

## FPS-R4 — ARPG itemization and builds

- Add affixes, unique effects, and deeper equipment choices to the instance-based item model.
- Expand class skill kits and build progression.

## Later

The final Minotaur depth, endgame, outdoor Crete, large quest systems, and multiplayer remain future decisions. No Unity migration or runtime generative service is planned for this foundation.
