# Maze of the Minotaur roadmap

## FPS-R1 — Solo real-time foundation

Merged. Established the solo FPS runtime, WebGL 2 renderer, direct attacks, moving world enemies, inventory, progression, and versioned save foundation.

## FPS-R2A — Greek rebrand and Floor Guardians

Merged. Establishes the Labyrinth identity, local mythic pixel art, Greek class and content presentation, Guardian-gated descents for the first five floors, and migration of R1 expedition progress into a new save namespace.

## FPS-R2B — Mythological combat and enemy AI

Implemented in the R2B branch. Adds timed role-based enemy patterns, line-of-sight rules, status effects, shield defense, weapon-specific hit shapes, clearer animation/VFX/audio feedback, and a one-time Warden phase transition. The five Guardian IDs and gated descent state are preserved. See [combat audit and implementation](FPS_R2B_COMBAT_AUDIT.md).

## FPS-R3A — Modular pixel character rigs and animation

Merged into `main`. Adds six local pixel-rig pilots, combat-state-driven poses, and weapon-specific first-person actions. See [R3A rig documentation](FPS_R3A_CHARACTER_RIGS.md) and [contact sheet](previews/FPS_R3A_CHARACTER_CONTACT_SHEET.png).

## FPS-R3B — Mythic VFX and world combat feedback

Implemented on `codex/maze-of-the-minotaur-fps-r3b`; awaiting review. Adds authored local pixel VFX, gameplay-timed world effects, material-specific impacts, Guardian threat markers, audio cue gating, and Full/Reduced/Off presentation settings. See [R3B VFX documentation](FPS_R3B_MYTHIC_VFX.md) and [gallery](previews/FPS_R3B_MYTHIC_VFX_GALLERY.png).

## FPS-R4 — ARPG itemization and builds

- Add affixes, unique effects, and deeper equipment choices to the instance-based item model.
- Expand class skill kits and build progression.
- Keep new item and skill VFX attached to existing stable ability IDs and simulation events; do not introduce a separate visual damage path or a new save field for cosmetic settings.
- Extend the local atlas and effect definitions only when an item or skill has a distinct visual cue; preserve the shared pool limits and reduced-mode readability.

## Later

The final Minotaur depth, endgame, outdoor Crete, large quest systems, and multiplayer remain future decisions. No Unity migration or runtime generative service is planned for this foundation.
