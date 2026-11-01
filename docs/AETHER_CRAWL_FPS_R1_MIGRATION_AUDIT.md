# Aether Crawl FPS-R1 migration audit

Baseline: `main` at `4c6da5af15885454c32e913de31adfe249838092` (2026-10-18).

## Existing systems and migration decisions

### Reuse

- `services/dungeonGenerator.ts`, `services/floorRandom.ts`, and `services/dungeonPlan.ts` provide deterministic grid floors, exits, room anchors, secrets, locked areas, and floor metadata. R1 converts this grid into world geometry rather than replacing the generator.
- `constants.ts`, `data/enemies.ts`, `data/enemyAbilities.ts`, `data/assetRegistry.ts`, and the existing item fields provide class stats, enemy definitions, stable content IDs, and a starting point for loot and equipment.
- `services/firstPerson.ts` already contains continuous yaw, collision checks, circle-versus-grid movement, and wall sliding. Its grid conventions remain useful for the 3D controller.
- The existing floor seed and room data are serializable and can be retained in the new save envelope.

### Replaced in the active path

- `App.tsx` previously owned a three-character `Player.party`, active-character selection, initiative combat, and tactical combat UI. The new active app owns one `PlayerCharacter`; no active gameplay action indexes a party.
- `hooks/useCombatRuntime.ts`, `hooks/useCombatControls.ts`, `services/combatRuntime.ts`, `services/combatActions.ts`, `services/enemyAI.ts`, `components/CombatHud.tsx`, and `components/Viewport.tsx` implement round combat, turn intents, and the old Canvas raycaster. They are not used by the new active runtime.
- Combat transitions that removed enemies from the dungeon view are replaced by world-space enemies, direct input actions, and telegraphed attacks.

### Adapted

- `FloorState` and room anchors remain the world layout. The active runtime resolves room interactions with a single hero and keeps movement, attacks, and enemies in the same world.
- Legacy `Item` values and the class templates remain useful content inputs, while new item instances carry stable IDs and fields for later item levels, rarity, affixes, and unique effects.
- Old party save serialization remains isolated under its current key. R1 uses a new, versioned save key and validates it before loading.

### Art and technical risks

- Existing world, hand, and enemy assets are largely painted, not pixel-native. R1 uses a configurable low-resolution render target, nearest-neighbor sampling, and small procedural pixel textures for the pilot world; existing painted art is not silently mixed into this presentation.
- The current maze is only `12 × 12`. World geometry fits this floor size, but larger spaces, vertical navigation, outdoor areas, and complex pathfinding remain future work.
- WebGL availability varies across mobile browsers. Renderer initialization must fail into a clear recovery screen, while combat rules remain identical.
- The grid is authoritative for collision and simple enemy navigation. Dynamic doors and floor transitions must update both the logical grid and rendered geometry together.
- New saves are intentionally separate from legacy party saves. Legacy saves remain untouched and cannot be resumed by the solo runtime.
- Legacy party combat modules and their tests are retained as inactive historical code for this migration. They must not be imported by the active application or run in parallel with the new renderer.
