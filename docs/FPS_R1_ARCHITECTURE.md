# Aether Crawl FPS-R1 architecture and acceptance

## Architecture

The active game path has one mutable `FPSGameRuntime`, owned by `App.tsx` and passed to `components/FPSViewport.tsx`. React owns menus and HUD snapshots at roughly 10 Hz. Three.js owns the scene and renders outside React's frame cycle.

`engine/GameLoop.ts` runs gameplay updates at 60 Hz with a bounded accumulator. It stops accumulating while the document is hidden and resets its clock on visibility changes, so a background tab cannot deal catch-up damage. `engine/InputSystem.ts` converts keyboard, mouse, pointer lock, and touch gestures into one input frame. `player/PlayerController.ts` applies yaw and pitch limits, acceleration, sprint, dodge, collision, and wall sliding.

| Layer | R1 modules | Responsibility |
| --- | --- | --- |
| Engine | `engine/GameLoop.ts`, `engine/InputSystem.ts`, `engine/SceneRenderer.ts`, `engine/FPSGameRuntime.ts` | Fixed updates, input, WebGL scene, and solo game state |
| World | `world/DungeonWorld.ts`, `world/WorldGeometry.ts`, `world/CollisionWorld.ts`, `world/EnemySpawner.ts` | Generated grid floor, 3D surfaces, interactions, collision, and spawn placement |
| Player | `player/PlayerController.ts`, `player/PlayerCombat.ts`, `player/PlayerProgression.ts` | Movement, action timing, class setup, XP, loot, and equipment |
| Combat and AI | `combat/AbilityRegistry.ts`, `combat/DamageSystem.ts`, `combat/ProjectileSystem.ts`, `enemies/EnemyBrain.ts` | Stable ability IDs, hit checks, projectiles, and telegraphed enemy states |
| Presentation | `presentation/PixelArtRenderer.ts`, `presentation/SpriteAnimator.ts`, `presentation/WeaponPresenter.ts`, `presentation/VFXSystem.ts` | Nearest-neighbor pixel art, billboards, weapon motion, and pooled effects |
| Interface | `App.tsx`, `components/FPSViewport.tsx` | Class selection, health/mana/XP HUD, map, inventory, pause, and touch buttons |

The grid remains authoritative for collision and navigation. `WorldGeometry` turns it into perspective-correct floor, ceiling, walls, door blocks, an exit arch, and props. Enemies and loot use world-space billboard sprites with depth testing, so walls occlude them. Movement and enemies use the same grid for wall checks. The first wave stays on one height plane.

## Class and action status

| Class | Primary | Secondary | Skill |
| --- | --- | --- | --- |
| Barbarian | Cleave | Heavy Strike | Ground Slam |
| Sorcerer | Arcane Bolt | Charged Bolt | Fireburst |
| Paladin | Arming Sword | Shield Smite | Consecration |
| Rogue | Quick Stab | Shadow Strike | Knife Fan |
| Ranger | Shortbow Shot | Piercing Arrow | Volley |
| Cleric | War Hammer | Holy Bolt | Restoration |
| Monk | Palm Strike | Flurry | Flying Kick |
| Necromancer | Bone Shard | Soul Drain | Grave Burst |

All actions live in `combat/AbilityRegistry.ts` and use stable IDs. Each action has windup, active, recovery, cooldown, range, damage, and optional mana cost. Barbarian and Sorcerer define the R1 combat pilots; the other classes receive functional baseline actions pending later kit waves. Only the first skill slot is presented in R1.

## Enemies, rewards, and rooms

World enemies use world position and explicit states: `IDLE`, `AGGRO`, `APPROACH`, `ATTACK_WINDUP`, `ATTACK`, `RECOVER`, `HURT`, and `DEAD`. The pilot enemies are Giant Rat and Skeleton Warrior. The AI uses grid BFS to approach, checks line of sight before attacking, and telegraphs attacks before damage. There is no turn order in the active path.

A lethal enemy can grant XP and one loot instance. A reward flag prevents repeat XP and drops. E collects a looked-at drop; the inventory supports potions, equipping, and unequipping. Level-ups improve core stats. The grid-based room system carries through treasure, rest, shrine, trap, event, locked gate, secret, boss, and exit interactions with single-hero effects. Loot and equipment instances already have item level, rarity, affix storage, and an optional unique-effect ID, but R1 does not roll full affix pools or uniques.

## Rendering and art decisions

`THREE.WebGLRenderer` is configured for WebGL 2, with antialiasing off and a low-resolution canvas scaled to the viewport. Floor textures use 32×32 generated pixel tiles. Enemy and first-person weapon textures use compact pixel canvases. Texture filtering is nearest-neighbor, mipmaps are disabled, and CSS uses `image-rendering: pixelated`. Fog, hemisphere light, and one directional light provide the first atmosphere pass.

The previous committed painted assets remain available to the legacy registry tests but are not loaded into the new viewport. `AssetManager` caches generated textures. Projectile meshes are capped at 64 and reused from a pool; pixel VFX reuse a 48-mesh pool on desktop and a 24-mesh pool on narrow screens. Floor geometry is disposed and rebuilt when `worldRevision` changes. The current production build splits the app entry (about 255 kB minified) from Three.js (about 533 kB minified); Vite still reports Three.js above its 500 kB advisory limit.

## Save migration

R1 writes schema version 1 under `aether_crawl_fps_r1_save_v1`. The save includes the active player action and its cooldown timers as well as player stats, item instances, floor grid, enemies, and loot. The loader validates these before a run resumes. It never reads, rewrites, or converts the old party save key. An invalid R1 save is reported in the menu and left intact for inspection; the old party save remains untouched.

## Legacy migration

The active `App.tsx` no longer imports the old party runtime, initiative combat hooks, combat menus, combat transitions, or Canvas raycaster. Their source and tests remain in the repository as inactive migration history. `services/firstPerson.ts` still supplies stable grid-facing helpers used at spawn. No legacy renderer runs alongside the WebGL scene.

The first audit is recorded in [AETHER_CRAWL_FPS_R1_MIGRATION_AUDIT.md](AETHER_CRAWL_FPS_R1_MIGRATION_AUDIT.md). It identifies reusable data, retired active combat systems, adapted dungeon/inventory pieces, painted asset limits, and technical risks.

## Validation status

The R1 unit suite covers solo class setup, movement and wall sliding, yaw/pitch, line of sight and melee, action phases and mana, enemy aggro and attacks, projectile collision, reward-once behavior, XP, item pickup, door interaction, equipment, temporary room buffs, floor transitions, save validation, and hidden-tab clock reset.

`npm install`, `npm run typecheck`, `npm test`, and `npm run build` are the required local checks. The browser smoke command is `npm run test:run`; it starts Vite and uses Playwright with a Chromium installation to check class entry, a WebGL 2 canvas, map and inventory overlays, save/continue, the Sorcerer skill, and touch movement/attack. It does not yet automate a full rat kill, loot equip, or floor descent. In the current managed environment, Chromium could not be installed: the Playwright CDN returned an invalid zero-byte archive, and the available remote browser could not reach the workspace's localhost server. Therefore a rendered browser playthrough and mobile touch smoke are **not claimed as completed** in this environment. A developer machine with Chromium can run the browser script after installing its browser binary.

## Remaining R1 risks

- No rendered browser acceptance or physical-device performance test was possible in this environment.
- The generated 32×32 enemy textures are a silhouette-first placeholder art pass, not the full authored sprite and animation production planned for later waves.
- The six non-pilot classes share the same enemy AI and one first skill slot; class-specific full kits and ranged enemy behavior remain future work.
- Pitch is unrestricted within a safe look range, but R1 has no jumping or vertical navigation.
- Three.js raises the production chunk advisory; the scene is simple but mobile GPU and memory budgets still need device testing.
