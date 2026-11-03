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

Merged to `main` via PR #20. Adds four active skill slots and bounded class passives for Myrmidon, Hoplite, Oracle, and Trickster, plus rank 1–5 progression, retained skill-point migration, level-up choices, effective-cost UI, timed multi-hit actions, chain attacks, and collision-safe dashes. R4A derived stats, R4B item effects, and version-4 saves remain integrated. See [R5A class skill documentation](CLASS_SKILLS_R5A.md).

## FPS-R5B — Class Buildcraft II

Implements four rankable skills and bounded passives for Hunter, Asclepiad, Pankratiast, and Shadebinder, completing all eight class kits. The implementation reuses R5A progression, effective-cost UI, and save validation, and adds capped projectile pierce/fans, healing and cleanse rules, timed combo and counter windows, and a curse-to-burst interaction. See [R5B class skill documentation](CLASS_SKILLS_R5B.md).

## FPS-R5C — Copilot review, save, and input hardening

Implemented as a focused maintenance wave on the post-R5B `main`. Resolves confirmed review findings across PRs #16–#21, preserves version-4 saves, and adds no gameplay systems. See [review resolutions](COPILOT_REVIEW_RESOLUTION.md) and [implementation notes](R5C_IMPLEMENTATION.md).

## FPS-R6A — Labyrinth architecture, rooms, and lighting

Implemented on `codex/maze-of-the-minotaur-fps-r6a`. New FPS floors use a deterministic 23×23 chamber layout with wide routes, optional narrow passages, pillared combat spaces, a single controlled Guardian entrance, wall mounted art, and bounded local light sources. Legacy generation remains available to old callers, and saved R4 maps load without regeneration or a save version change. See [R6A implementation notes](R6A_IMPLEMENTATION.md).

## FPS-R6B — Equipment, dual wield, and two-hand viewmodels

Merged to `main` via PR #24. Adds canonical equipment slots, validated shield/focus/two-hand rules, hand-specific melee resolution, and local first-person hand presentation while retaining version-5 saves. See [R6B implementation notes](R6B_IMPLEMENTATION.md).

## FPS-R6C — Combat mastery: stamina, parry, poise, and enemy reads

Merged into `main` via PR #25. Adds bounded stamina and recovery rules, collision-aware dodge windows, explicit shield-parry attacks, pilot-enemy poise breaks, and readable incoming-attack cues for the Cretan Cave Rat, Bronze Revenant, Bull-Cult Enforcer, and Bronze Gatekeeper. Version-5 saves remain compatible through optional validated fields. See [R6C implementation notes](R6C_IMPLEMENTATION.md).

## FPS-R6D1 — Loom of Fate and Living Labyrinth Laws

Merged in PR #26. Implements the saved three-card choice after every Guardian and nine functional Laws that reshape future room plans, creature spawns, hazards, combat cadence, and rewards. The active set is capped at three with an explicit replacement choice; version-5 expeditions migrate to version 6. See [R6D1 implementation notes](R6D1_IMPLEMENTATION.md).

## FPS-R6D2 — Ariadne's Thread: anchors and spatial maze editing

Implements deterministic prepared route junctions on floors 2–5, two Thread Charges to start, a cap of three, Guardian charge rewards, and one transactionally validated reveal/seal choice per anchor. Map reachability, protected rooms/gates, nearby actors, floor state, and charges are checked before the map changes. Version-6 expeditions migrate in memory to version 7 without floor regeneration. See [R6D2 implementation notes](R6D2_IMPLEMENTATION.md).

## FPS-R6D3 — Living Labyrinth synergies, Minotaur inheritance contract, and Chronicle

Implemented in the R6D3 PR. Adds three explicit, bounded Law pairings (Echo-Pack, Ares Pillar Arena, Venom Nest), a 64-event run-local discovery Chronicle, and a data-only Minotaur inheritance plan capped at three Laws and three derived modifiers. Version-7 expeditions migrate in memory to version 8 with an empty Chronicle and unchanged floor/Thread state. Also resolves two confirmed R6D2 review findings: closed doors no longer count as walkable for Thread reachability, and the center chamber remains combat-eligible on later floors outside the Thread range. See [R6D3 implementation notes](R6D3_IMPLEMENTATION.md).

## FPS-R6 — Floors 1–5 Action-RPG Vertical Slice & Quality Pass

Next: carry out the user's first-person playtest of floors 1–5 across movement, enemy telegraphs, loot, class progression, room events, save/load, Guardian arenas, and Thread Anchors. Keep content expansion bounded until the full progression loop is integrated.

## Later

The final Minotaur depth, endgame, outdoor Crete, large quest systems, and multiplayer remain future decisions. No Unity migration or runtime generative service is planned for this foundation.
