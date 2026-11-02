# FPS-R2A migration and architecture notes

## Active runtime

R2A continues the FPS-R1 Three.js/WebGL 2 runtime. React owns the menus, HUD, inventory, and map. The existing game loop owns frame stepping; the dungeon grid is converted into world meshes and collision tiles. Local static PNGs replace the former visible fantasy assets while Canvas textures remain an initial-load fallback.

## Content migration

- The eight `ClassType` IDs and existing enemy definition IDs are retained where they can carry a new presentation identity.
- All visible class names, starter equipment, first-wave actions, room labels, enemy rosters, and item drops are Greek-mythic.
- The six implementation biome IDs remain stable and now map to Labyrinth depth zones.
- New stable `guardian_*` IDs identify the five floor Guardians. They are not selected by display name.
- Optional legacy miniboss and biome-boss definitions are retained in the registry for stable source references but are excluded from the required Floor 1–5 Guardian selection.

## Floor Guardian state

Every generated floor contains one canonical Guardian in a reachable, cleared arena around the exit. The floor saves `guardianId` and one of `NOT_DISCOVERED`, `ALIVE`, `DEFEATED`, or `DESCENT_UNLOCKED`. The Guardian's unique instance is retained through saves. Reward processing is guarded by `rewardGranted`; only that floor Guardian's defeat unlocks descent. Pressing E on the exit performs the floor transition, so the player remains free to search after the kill.

## Save migration

- R1 remains under `aether_crawl_fps_r1_save_v1` and is never overwritten by R2A.
- R2A uses `maze_of_the_minotaur_fps_r2a_save_v2` and schema version 2.
- Continue validates R2A first, then validates and migrates an R1 save in memory if no R2A save exists.
- Migration embeds the old floor into a larger map, preserves the seed, floor, player stats, position relative to the old topology, equipment, inventory, item instance IDs, enemies, loot, and cleared/rewarded Guardian state, then adds the new arena and canonical Guardian identity.
- The v2 key is written only after the user selects Continue (or saves in the active run). Invalid v2 or R1 data is reported and left untouched; it is not silently replaced with a new expedition.

## Current limitations

The first five Guardians use simple attack sets and a small telegraph language rather than full boss phase graphs. Floors 6+ temporarily cycle the five pilot Guardians. The Minotaur depth and final encounter remain unconfigured. Full class skill trees, affixes, Uniques, and large-scale animation production remain future waves.
