# Maze of the Minotaur roadmap

## FPS-R1 — Solo real-time foundation

Merged. Established the solo FPS runtime, WebGL 2 renderer, direct attacks, moving world enemies, inventory, progression, and versioned save foundation.

## FPS-R2A — Greek rebrand and Floor Guardians

Merged. Establishes the Labyrinth identity, local mythic pixel art, Greek class and content presentation, Guardian-gated descents for the first five floors, and migration of R1 expedition progress into a new save namespace.

## FPS-R2B — Mythological combat and enemy AI

Implemented in the R2B branch. Adds timed role-based enemy patterns, line-of-sight rules, status effects, shield defense, weapon-specific hit shapes, clearer animation/VFX/audio feedback, and a one-time Warden phase transition. The five Guardian IDs and gated descent state are preserved. See [combat audit and implementation](FPS_R2B_COMBAT_AUDIT.md).

## FPS-R3A — Modular pixel character rigs and animation

Implemented on `codex/maze-of-the-minotaur-fps-r3a`; pending review and merge. Adds six local pixel-rig pilots, combat-state-driven poses, and weapon-specific first-person actions. See [R3A rig documentation](FPS_R3A_CHARACTER_RIGS.md) and [contact sheet](previews/FPS_R3A_CHARACTER_CONTACT_SHEET.png).

## FPS-R3B — Mythic pixel animation and VFX

- Expand authored animation content selectively for enemies with distinct source art.
- Produce the broader mythic VFX wave, keeping world effects tied to simulation positions and player weapons camera-relative.

## FPS-R4 — ARPG itemization and builds

- Add affixes, unique effects, and deeper equipment choices to the instance-based item model.
- Expand class skill kits and build progression.

## Later

The final Minotaur depth, endgame, outdoor Crete, large quest systems, and multiplayer remain future decisions. No Unity migration or runtime generative service is planned for this foundation.
