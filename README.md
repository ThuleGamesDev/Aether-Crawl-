# Aether Crawl

Aether Crawl is a solo dark-fantasy first-person action RPG. Its active R1 game path uses a real-time Three.js/WebGL 2 dungeon, one player-selected hero, world-space enemies, direct attacks, loot, experience, equipment, and a versioned local save. The browser game runs without a runtime AI service or API key.

## FPS-R1 playable foundation

- Choose one of eight classes: Barbarian, Paladin, Sorcerer, Rogue, Ranger, Cleric, Monk, or Necromancer.
- Move through the generated grid dungeon as 3D floor, ceiling, wall, door, exit, and prop geometry.
- Fight moving monsters in the same space. The first floor includes Giant Rats and Skeleton Warriors with telegraphed attacks.
- Earn XP and loot, collect items, open Inventory, equip weapons and armor, and save or continue a run.
- Keep the dungeon generator, room interactions, doors, secrets, shrines, traps, and floor progression in the solo world.

Barbarian and Sorcerer are the combat pilots for this wave. Their actions are Cleave, Heavy Strike, and Ground Slam; and Arcane Bolt, Charged Bolt, and Fireburst. The other six classes each start with a working class-themed primary, secondary action, and skill. Their full kits remain future work.

The first presentation pass creates compact pixel-art textures and sprites at runtime, uses nearest-neighbor sampling, and upscales a configurable low-resolution WebGL render target. Existing painted assets are retained for reference and legacy tests; the R1 viewport does not mix them into its pixel-art scene.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move and strafe |
| Mouse | Look; click the viewport to capture the pointer |
| Left mouse | Primary attack |
| Right mouse | Secondary attack; hold to charge where supported |
| 1 | Class skill |
| Shift | Sprint |
| Space | Dodge |
| E | Interact or collect loot in front of the player |
| I | Inventory and equipment |
| Tab | Dungeon map |
| Esc | Pause and release the pointer |

Mouse sensitivity is adjustable from **Controls & Options**. On touch screens, drag the left side of the view to move and the right side to look. The on-screen controls provide attack, skill, dodge, and interaction.

## Requirements and setup

Requires Node.js 18 or newer.

```bash
npm install
npm run dev
```

## Checks

```bash
npm run typecheck
npm test
npm run build
```

`npm run test:run` starts the Vite app in Chromium and checks the browser-facing R1 flow. Install Chromium with `npx playwright install chromium`. The test writes its screenshots and summary to `artifacts/fps-r1-smoke/`.

## Active architecture

| Area | Ownership |
| --- | --- |
| `engine/` | Fixed-step game loop, input capture, renderer, and solo runtime |
| `world/` | Generated dungeon state, 3D geometry, grid collision, and enemy spawns |
| `player/` | One player character, movement, actions, leveling, and equipment |
| `combat/` and `enemies/` | Action resolution, projectiles, damage, enemy AI, and telegraphs |
| `presentation/` | Pixel-art textures, weapon hands, billboard sprites, animation, and pooled VFX |
| `services/fpsSave.ts` | Validated R1 save schema in its own localStorage namespace |
| `App.tsx`, `components/FPSViewport.tsx` | React menus, HUD, overlays, and WebGL canvas ownership |

The former party, initiative combat, and Canvas raycaster source is retained as inactive legacy code with its own tests. It is not imported by the active application. See [the FPS-R1 migration audit](docs/AETHER_CRAWL_FPS_R1_MIGRATION_AUDIT.md) and [the architecture and acceptance notes](docs/FPS_R1_ARCHITECTURE.md).

## R1 boundaries

R1 supports one dungeon height plane, basic pathfinding, one active class skill, and simple melee enemy AI. It does not include the later class skill trees, complex enemy or boss kits, stairs and bridges, outdoor levels, deep ARPG affixes, a Diablo-style inventory grid, multiplayer, or Unity migration. Full module and browser checks are summarized in [the FPS-R1 acceptance notes](docs/FPS_R1_ARCHITECTURE.md).
