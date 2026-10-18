# Aether Crawl

Aether Crawl is a local-first, retro fantasy dungeon crawler. Choose a three-character party, explore compact first-person dungeons, fight turn-based tactical encounters, collect equipment, and descend through six themed biomes toward their guardians.

The project is a playable browser vertical slice built with React, TypeScript, Vite, Tailwind CSS, and a Canvas raycaster. Gameplay, art, narrative text, saves, and audio work without an API key or network access after dependencies have been installed.

## Game loop

1. Choose three adventurers from eight classes.
2. Explore a procedurally laid-out dungeon using the on-screen controls.
3. Fight random encounters and guarded exits in turn-based tactical combat.
4. Gain XP, choose perks, collect loot, and spend scrap at the crafting menu.
5. Defeat the guardian at each five-floor milestone and descend into the next biome.

Biomes are selected by dungeon level: Stone Dungeon (1–5), Moss (6–10), Catacombs (11–15), Frost (16–20), Gilded (21–25), and Obsidian (26+).

## Controls

**Desktop:** click the viewport to capture the mouse, then use WASD to move and strafe. Mouse movement turns freely; arrow keys turn if you prefer keyboard-only aiming. Press E to open a nearby closed door, use a prop, or challenge/descend at an exit. Closed doors block movement until opened. I opens or closes Inventory, C/K opens party stats, Tab opens the map, and Escape releases the pointer or opens the menu. Mouse sensitivity is adjustable in Options. Movement stops at walls and slides along them.

**Mobile:** drag the left virtual stick to move and drag the right half of the view to look. Large touch buttons open Inventory, Skills, Party, Crafting, and the map; E interacts. Turn the device sideways for more room where possible.

Combat uses initiative rounds: each living hero and monster gets one action, in descending effective INIT order. Equipment load lowers initiative. The active hero waits indefinitely for Attack, Guard, a skill, potion or Flee; other party members cannot act out of turn. Guard lasts until that hero’s next turn. Enemies resolve their advertised intent individually, with a short presentation pause between actions. There is no real-time recovery, input buffer, Auto Basic or tactical slowdown. The HUD shows the current round and remaining turn order. Save after the encounter; Menu suspends enemy presentation. See [combat rules](docs/COMBAT_SYSTEM.md).


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

The optional `npm run test:run` plays an ordinary party through Floors 1–5 in Chromium. Install its browser with `npx playwright install chromium`; see [run verification, commands and limits](docs/RUN_ACCEPTANCE.md). This is separate from the fast unit suite.

## Static asset pipeline

All production art is committed under `public/assets/` as individual PNG and WebP files. The runtime only loads those files through `services/assetLoader.ts`; it does not call a generation service or create image data URLs. The title screen waits for the first floor's biome, enemies, weapons, and combat effects. Before a saved floor or the next biome appears, its required local assets are loaded and cached. A missing asset is reported visibly instead of silently replaced by generic art.

Floors 1–5 now use detailed painted stone walls, perspective floors and an arched gate, with larger painted sword/shield foregrounds inspired by the supplied dark fantasy reference. Other weapons, creatures, props and later biomes retain the existing pixel-painted assets. This remains a 2.5D raycaster; curved corridors and an outdoor castle scene are not implemented. Transparent sprites retain real alpha in PNG or WebP.

See [initiative, art provenance and browser verification](docs/INITIATIVE_AND_PAINTED_LOOK.md) for the original art pass; current combat rules are documented below.

See [the art direction](docs/ART_DIRECTION.md) for visual rules and [the asset pipeline](docs/ASSET_PIPELINE.md) for filenames, registry updates, and addition steps.

## Project structure

```text
App.tsx                    Game flow and screen composition
components/                Canvas viewport, mobile controls, minimap, and log
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

See [the current roadmap and vertical-slice status](docs/ROADMAP.md) for the Floors 1–5 acceptance checklist and deferred next steps.

## Adding a new enemy

1. Add its transparent PNG to `public/assets/enemies/` using a stable kebab-case name.
2. Add the gameplay definition, stable `visualId`, design role, and ability IDs to `data/enemies.ts`.
3. Add the corresponding `visualId` entry and sprite path to `enemyVisuals` in `data/assetRegistry.ts`.
4. Register new abilities in `data/enemyAbilities.ts`; use existing typed effects and status types when possible.
5. Run `npm test`; registry tests check enemy sprites and referenced ability IDs.

See [the combat system guide](docs/COMBAT_SYSTEM.md) for clock/readiness, intent/cast rules, pilot behaviors, summons, and extension steps. [First-person exploration](docs/FIRST_PERSON_EXPLORATION.md) documents movement, input, interaction, and migration details.

## Adding a new biome

1. Add a `BiomeId` in `types.ts` and its level range in `getBiomeIdForLevel`.
2. Add wall, floor, ceiling, door, exit, light, and prop PNGs under `public/assets/environments/` and `public/assets/props/`.
3. Register the complete set in `biomeVisuals` in `data/assetRegistry.ts`.
4. Add local narrative lines in `data/narratives.ts` and extend the asset registry test if the test's explicit biome list changes.

## Save data

Saves remain in browser `localStorage` under the existing Aether Crawl save key. The save stores gameplay state only; visual URLs, image payloads, and derived weapon sprite types are excluded. Player position now stores continuous world coordinates and a horizontal angle. Older saves with integer `pos` and cardinal `dir` are migrated to the center of that tile while preserving the old facing; weapon visual types are still recovered from item names when loaded.

## Turn-based combat controls

The hero whose initiative turn is highlighted owns the commands. LMB attacks; Q/E/R/F use its first four skills; V guards; G uses the bound potion; Tab/Shift+Tab cycles living enemies. Other party cards cannot change turn ownership. Touch uses Attack/skill/Guard/Potion/Target buttons; hold a skill for details. More offers all skills, potion binding and Flee. Take as much time as needed. See [turn-based combat](docs/COMBAT_SYSTEM.md).

## Dungeon Gameplay 2.0

Floors now contain marked patrols, guaranteed treasure choices, one-use camps, sealed side vaults and changing shrine/hazard/event/secret content. E inspects, opens, prays, rests and challenges. Keys are earned locally and expire on descent; the main path never needs them. Room claims and gate/discovery state persist in saves. Guardian victory stays on the current floor until E descends, allowing remaining side content to be explored. See [Dungeon Gameplay](docs/DUNGEON_GAMEPLAY.md) for first-five-floor budgets, prices, risk previews and migration rules.
