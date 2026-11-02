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

## FPS-R4A — ARPG itemization core and affix engine

Merged into `main` via PR #18. Adds stable item-base and affix registries, seeded rarity rolls, normal/elite/Guardian reward tiers, one derived-stat pipeline, equipment comparisons, and version-3 save migration. The four existing equipment slots remain compatible, with enforced two-handed/offhand rules. See [itemization formulas, audit, and migration](ARPG_ITEMIZATION.md).

## FPS-R4B — Inventory, uniques, and character stats

Merged to `main` via PR #19. Adds the 10×5 bag with safe overflow, stack management, mouse/touch actions, a character-stats screen, eight capped mythic uniques, item-specific rarity-marked loot, and version-4 save migration from R4A. Guardian reward identities and the R4A derived-stat pipeline are preserved. Browser/WebGL smoke was not run because Chromium was unavailable. See [inventory, uniques, and controls](INVENTORY_AND_UNIQUES.md).

## FPS-R5A — Class Buildcraft I

Implemented on `codex/maze-of-the-minotaur-fps-r5a`. Adds four active skill slots and bounded class passives for Myrmidon, Hoplite, Oracle, and Trickster, plus rank 1–5 progression, retained skill-point migration, level-up choices, effective-cost UI, timed multi-hit actions, chain attacks, and collision-safe dashes. R4A derived stats, R4B item effects, and version-4 saves remain integrated. The other four classes retain their existing loadouts. See [R5A class skill documentation](CLASS_SKILLS_R5A.md).

## Later

The final Minotaur depth, endgame, outdoor Crete, large quest systems, and multiplayer remain future decisions. No Unity migration or runtime generative service is planned for this foundation.
