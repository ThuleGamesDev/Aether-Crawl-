# Aether Crawl

Aether Crawl is a local-first, retro fantasy dungeon crawler. Choose a three-character party, explore compact first-person dungeons, fight turn-based encounters, collect equipment, and descend through six themed biomes toward their guardians.

The project is a playable browser vertical slice built with React, TypeScript, Vite, Tailwind CSS, and a Canvas raycaster. Gameplay, art, narrative text, saves, and audio work without an API key or network access after dependencies have been installed.

## Game loop

1. Choose three adventurers from eight classes.
2. Explore a procedurally laid-out dungeon using the on-screen controls.
3. Fight random encounters and guarded exits in turn-based combat.
4. Gain XP, choose perks, collect loot, and spend scrap at the crafting menu.
5. Defeat the guardian at each five-floor milestone and descend into the next biome.

Biomes are selected by dungeon level: Stone Dungeon (1–5), Moss (6–10), Catacombs (11–15), Frost (16–20), Gilded (21–25), and Obsidian (26+).

## Controls

- Use the on-screen directional pad to move forward/back or turn left/right.
- Open Inventory, Skills, Status, and Crafting from the exploration controls.
- In combat, choose Attack, Defend, Skill, Item, or Flee. Click an enemy sprite to select it. Intent badges show each enemy's next action; damage ranges are approximate and gear, Defend, and guard can lower the hit.
- Use Save and Exit from the game header. Continue is available from the title screen when a save exists.

## Requirements and setup

Requires Node.js 18 or newer.

```bash
npm install
npm run dev
```

No `.env` file, Gemini key, or other service credentials are required. The development server and the game assets are served locally.

## Build and checks

```bash
npm run typecheck
npm test
npm run build
```

The production build is written to `dist/`. To preview it locally:

```bash
npm run preview
```

## Static asset pipeline

All production art is committed under `public/assets/` as individual PNG files. The runtime only loads those files through `services/assetLoader.ts`; it does not call a generation service or create image data URLs. The title screen waits for the first floor's biome, enemies, weapons, and combat effects. Before a saved floor or the next biome appears, its required local assets are loaded and cached. A missing asset is reported visibly instead of silently replaced by generic art.

The assets use a cohesive, dark fantasy pixel-painted style with distinct materials and accent colors for each biome. Transparent enemy, hand, prop, light, and VFX sprites are PNGs with alpha. Environment surfaces are opaque PNG tiles.

See [the art direction](docs/ART_DIRECTION.md) for visual rules and [the asset pipeline](docs/ASSET_PIPELINE.md) for filenames, registry updates, and addition steps.

## Project structure

```text
App.tsx                    Game flow and screen composition
components/                Canvas viewport, controls, minimap, and log
data/                      Enemy and ability data, translations, narrative, and asset registry
services/                  Dungeon generation, enemy intent and combat resolution, progression, saves, and asset loading
public/assets/
  environments/            Six biome tile sets and biome light sprites
  enemies/                 Normal enemies, mini-bosses, and biome bosses
  hands/                   First-person hand and weapon sprites
  props/                   Shared and biome-themed decoration sprites
  vfx/                     Static combat effect sprites
docs/                      Art direction and asset pipeline
tests/                     Dungeon, gameplay, and asset registry tests
```

## Adding a new enemy

1. Add its transparent PNG to `public/assets/enemies/` using a stable kebab-case name.
2. Add the gameplay definition, stable `visualId`, design role, and ability IDs to `data/enemies.ts`.
3. Add the corresponding `visualId` entry and sprite path to `enemyVisuals` in `data/assetRegistry.ts`.
4. Register new abilities in `data/enemyAbilities.ts`; use existing typed effects and status types when possible.
5. Run `npm test`; registry tests check enemy sprites and referenced ability IDs.

See [the combat system guide](docs/COMBAT_SYSTEM.md) for turn flow, intent rules, pilot behaviors, summons, and extension steps.

## Adding a new biome

1. Add a `BiomeId` in `types.ts` and its level range in `getBiomeIdForLevel`.
2. Add wall, floor, ceiling, door, exit, light, and prop PNGs under `public/assets/environments/` and `public/assets/props/`.
3. Register the complete set in `biomeVisuals` in `data/assetRegistry.ts`.
4. Add local narrative lines in `data/narratives.ts` and extend the asset registry test if the test's explicit biome list changes.

## Save data

Saves remain in browser `localStorage` under the existing Aether Crawl save key. The save stores gameplay state only; visual URLs, image payloads, and derived weapon sprite types are excluded. Older saves receive defaults and weapon visual types are recovered from their item names when loaded.
