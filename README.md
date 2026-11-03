# Maze of the Minotaur

A dark Greek-mythic first-person action RPG set in the Labyrinth beneath Knossos. Its active game uses a Three.js/WebGL 2 world, a single chosen hero, continuous movement and combat, world-space monsters, floor guardians, loot, experience, equipment, and versioned local expedition saves. The browser game requires no runtime AI service or API key.

## Play

```bash
npm install
npm run dev
```

Choose one of eight classes: Myrmidon, Hoplite, Oracle, Trickster, Hunter, Asclepiad, Pankratiast, or Shadebinder. Explore each generated floor, defeat its required Guardian to unlock the descent, and press **E** at the exit when ready. Floors 2–5 also hold prepared Thread Anchors where a limited Thread Charge can open or seal a safe passage. The Minotaur remains the unique long-term goal deeper in the Maze.

### Controls

| Input | Action |
| --- | --- |
| WASD | Move and strafe |
| Mouse | Look; click the view to capture the pointer |
| Left mouse | Primary attack |
| Right mouse | Secondary attack; hold to charge where supported |
| 1–4 | Skills |
| Shift / Space | Sprint / dodge |
| E | Interact, collect, weave at an anchor, or descend |
| I / Tab | Inventory / map |
| Esc | Pause and release the pointer |

Touch controls remain available for movement, look, attacks, dodge, and interaction.

Combat presentation can be set to **Full**, **Reduced**, or **Off** in **Controls & Options**. Reduced mode keeps key combat cues and enemy telegraphs visible while lowering effect density and brightness.

## Validation

```bash
npm run typecheck
npm test
npm run build
```

`npm run test:run` runs the Playwright WebGL 2 smoke runners for class entry, save/continue, mobile controls, and the deterministic R6F1 visibility fixture. Install Playwright Chromium first or set `CHROMIUM_PATH`; when Chromium is unavailable, the command records an explicit browser-QA skip. R6F1 captures are written to `artifacts/r6f1-browser-smoke/`.

## Project notes

- [World Bible](docs/MAZE_OF_THE_MINOTAUR_WORLD_BIBLE.md) defines the setting, visual language, classes, monsters, items, depths, and Guardian hierarchy.
- [R2A migration notes](docs/MAZE_OF_THE_MINOTAUR_R2A.md) describe the world and save migration.
- [R2B combat audit](docs/FPS_R2B_COMBAT_AUDIT.md) records the pre-wave gaps, combat architecture, enemy roles, Guardian patterns, save compatibility, and current limits.
- [R3A character rig notes](docs/FPS_R3A_CHARACTER_RIGS.md) describe the six pilot rigs, state-driven animation, weapon poses, contact sheet, validation, and R3B handoff.
- [R3B mythic VFX notes](docs/FPS_R3B_MYTHIC_VFX.md) document gameplay-timed effects, surface responses, Guardian threat tells, audio gating, budgets, validation, and the [VFX gallery](docs/previews/FPS_R3B_MYTHIC_VFX_GALLERY.png).
- [R6E visual production notes](docs/R6E_IMPLEMENTATION.md) document the Palace Foundations pilot, directional character atlas, equipment viewmodels, material pass, and generated QA sheets.
- [R6F1 render visibility and browser QA](docs/R6F1_IMPLEMENTATION.md) documents the camera scene-graph fix, visible hand fallbacks, render-quality setting, deterministic WebGL fixture, and exact browser capture paths.
- [Art direction](docs/ART_DIRECTION.md) and [asset pipeline](docs/ASSET_PIPELINE.md) document the local static pixel art.
- [Roadmap](docs/ROADMAP.md) tracks the next waves.
- [Class skill kits, passives, and R5B integration](docs/CLASS_SKILLS_R5B.md) records the eight class builds, effect formulas, save compatibility, and validation status.
- [R5C Copilot review resolution](docs/COPILOT_REVIEW_RESOLUTION.md) and [R5C implementation notes](docs/R5C_IMPLEMENTATION.md) record the save, input, tooltip, and rendering hardening findings.
- [R6A implementation notes](docs/R6A_IMPLEMENTATION.md) describe the new FPS labyrinth topology, room architecture, torch placement, lighting, save compatibility, and technical verification.
- [R6D1 implementation notes](docs/R6D1_IMPLEMENTATION.md) describe the Loom of Fate and Living Labyrinth Laws.
- [R6D2 implementation notes](docs/R6D2_IMPLEMENTATION.md) describe prepared Thread Anchors, safe spatial edits, charge persistence, and save migration.
- [R6D3 implementation notes](docs/R6D3_IMPLEMENTATION.md) describe the three bounded Law synergies, the run-local Maze Chronicle, Minotaur inheritance data contract, and version-8 save migration.
- [FPS-R1 architecture](docs/FPS_R1_ARCHITECTURE.md) and [FPS-R1 migration audit](docs/AETHER_CRAWL_FPS_R1_MIGRATION_AUDIT.md) are historical foundation documents; their former title, art direction, and R1 Guardian model are not current gameplay canon.

The former party and initiative-based game path remains as inactive historical source with isolated tests. The active application imports the solo FPS runtime only.
