# Maze of the Minotaur

A dark Greek-mythic first-person action RPG set in the Labyrinth beneath Knossos. Its active game uses a Three.js/WebGL 2 world, a single chosen hero, continuous movement and combat, world-space monsters, floor guardians, loot, experience, equipment, and versioned local expedition saves. The browser game requires no runtime AI service or API key.

## Play

```bash
npm install
npm run dev
```

Choose one of eight classes: Myrmidon, Hoplite, Oracle, Trickster, Hunter, Asclepiad, Pankratiast, or Shadebinder. Explore each generated floor, defeat its required Guardian to unlock the descent, and press **E** at the exit when ready. The Minotaur remains the unique long-term goal deeper in the Maze.

### Controls

| Input | Action |
| --- | --- |
| WASD | Move and strafe |
| Mouse | Look; click the view to capture the pointer |
| Left mouse | Primary attack |
| Right mouse | Secondary attack; hold to charge where supported |
| 1–4 | Skills |
| Shift / Space | Sprint / dodge |
| E | Interact, collect, or descend |
| I / Tab | Inventory / map |
| Esc | Pause and release the pointer |

Touch controls remain available for movement, look, attacks, dodge, and interaction.

## Validation

```bash
npm run typecheck
npm test
npm run build
```

`npm run test:run` launches the Playwright WebGL 2 smoke runner for class entry, the action HUD, save/continue, and mobile movement/attack. It requires an installed Chromium browser. It is a rendering/input smoke test and does not replace hands-on boss balance review.

## Project notes

- [World Bible](docs/MAZE_OF_THE_MINOTAUR_WORLD_BIBLE.md) defines the setting, visual language, classes, monsters, items, depths, and Guardian hierarchy.
- [R2A migration notes](docs/MAZE_OF_THE_MINOTAUR_R2A.md) describe the world and save migration.
- [R2B combat audit](docs/FPS_R2B_COMBAT_AUDIT.md) records the pre-wave gaps, combat architecture, enemy roles, Guardian patterns, save compatibility, and current limits.
- [Art direction](docs/ART_DIRECTION.md) and [asset pipeline](docs/ASSET_PIPELINE.md) document the local static pixel art.
- [Roadmap](docs/ROADMAP.md) tracks the next waves.
- [FPS-R1 architecture](docs/FPS_R1_ARCHITECTURE.md) and [FPS-R1 migration audit](docs/AETHER_CRAWL_FPS_R1_MIGRATION_AUDIT.md) are historical foundation documents; their former title, art direction, and R1 Guardian model are not current gameplay canon.

The former party and initiative-based game path remains as inactive historical source with isolated tests. The active application imports the solo FPS runtime only.
