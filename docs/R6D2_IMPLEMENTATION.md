# R6D2 — Ariadne's Thread: Anchors and Spatial Maze Editing

## Player flow and resource

Architectural floors 2–5 generate one stable Thread Anchor in the central quiet chamber. The player starts with two **Thread Charges**, can carry at most three, and receives one additional charge after each Guardian reward while below the cap. Charges carry across floors and are stored in the expedition save; they remain separate from Ariadne's Tokens and floor keys.

Pressing **E** at an unused anchor opens the `FPSGameRuntime`-owned choice overlay. **Reveal Passage** opens a prepared optional route; **Seal a Passage** closes a prepared loop. Each card shows direction, charge and health costs, risk (`SAFE`, `REWARD`, or `LOCKED`), effect, and a reason when disabled. Closing or canceling leaves the route and charge count unchanged. Each anchor can be woven once. Recall is not offered because this pilot has no anchor teleport action.

The generator exposes only marked wall cells for reveal and marked optional-loop cells for sealing. The room graph reserves two unused center edges: one is carved as a narrow, removable loop and the other remains a narrow wall route. The center and its four adjacent chamber bounds are constrained to preserve actual corridor cells. The spanning tree remains connected, and the optional Guardian arena retains its single prepared entrance. Stable IDs include floor level and unsigned seed (`thread_<level>_<seed>_0`); route IDs derive from the same values and action.

## Transaction and world consistency

`services/ariadneThread.ts` builds the choice state and plans edits against a cloned tile map. It verifies the saved route tiles, non-empty unique route cells, player action state, charge and health affordability, and proximity to the player, living enemies, projectiles, and ground loot. It protects gates, the Guardian arena, boss/antechamber cells, unresolved encounter cells, and non-normal room anchors.

Before commit, flood-fill compares the player's current reachable cells before and after the edit. A seal is rejected if it strands any previously reachable cell other than its own edited cells. The check also preserves the exit, player, required room anchors, gate approaches, unresolved encounter cells, living enemy positions, and loot positions. The transaction returns an edited map, cleared route decorations, charge/health costs, choice history, and incremented topology revision together; the runtime applies them only after all validations pass. Invalid plans do not spend charges or health.

The tile grid remains authoritative for collision, line of sight, projectile collision, and pathfinding. On commit, `worldRevision` increments so the existing `SceneRenderer` replaces and disposes its `WorldGeometry` group while keeping the scene, renderer, VFX pool, and asset manager. Enemy route caches are cleared. The map UI reflects discovered anchors and the route choice cards include the directional arrows and current risk; unexplored rooms and secret rooms remain hidden. A short pixel-art thread effect reuses the locally bundled VFX atlas frames.

`broken_thread` supplies its route effect through the active Law registry: revealing costs no Thread Charge and costs 5% of maximum health. The health affordability check runs before the plan can commit; sealing keeps its normal charge cost. Other Laws do not change Thread costs. Rewards and Guardian entities are not created, removed, or re-rolled by a route edit.

## Save contract and migration

The expedition save advances from version 6 to version 7. `FloorState.threadJunctions` stores deterministic prepared route data. `FloorState.threadProgress` stores a versioned charge count, maximum, discovered/used anchor states, junction choices, topology revision, and optional open anchor ID. Save validation checks ID shapes, map bounds, route separation, exact post-edit route tiles, charge bounds, one-time anchor history, matching revisions, and room/gate protection.

R6D1 version-6 saves migrate in memory to version 7. Migration preserves the saved map, rooms, actors, inventory, and Law state; it initializes an empty junction list and two Thread Charges for the current legacy floor without regenerating it. Future newly generated architectural floors get their junction data from the deterministic floor generator. The migration marker is persisted only when the player next saves.

## Review audit

The prior R6A Copilot finding on `WorldGeometry.addProps()` was verified against the merged base. Sprite materials are now created lazily only for actual sprite props; wall-mounted props keep their plane materials, and the created resources are tracked for disposal. The R6D1 findings on stray file tokens and reduced Law-draft hash space are fixed on current `main`. No unaddressed pre-PR review finding remains in the R6D2 change set.

## Changed areas

- Data and generation: `types.ts`, `data/mazeLaws.ts`, `services/ariadneThread.ts`, `services/labyrinthLayout.ts`, `services/dungeonGenerator.ts`, `services/dungeonPlan.ts`.
- Runtime, persistence, and presentation: `engine/FPSGameRuntime.ts`, `world/DungeonWorld.ts`, `world/WorldGeometry.ts`, `services/mazeSave.ts`, `services/dungeonSave.ts`, `services/uiInputPolicy.ts`, `presentation/vfxDefinitions.ts`, `App.tsx`, `styles.css`.
- Regression coverage and documentation: `tests/ariadneThreadR6D2.test.ts`, `tests/vfxSystem.test.ts`, `README.md`, `docs/ROADMAP.md`, `docs/R6D1_IMPLEMENTATION.md`.

## Technical verification

- `npm run typecheck` — passed.
- `npm test` — passed: 303 tests across 32 files, including the 9-test R6D2 suite and route validation across 160 deterministic floor seeds.
- `npm run build` — passed. The existing Vite chunk-size advisory remains: the Three.js chunk is 542.46 kB and the application chunk is 639.52 kB before gzip.
- `git diff --check` — passed for the proposed R6D2 file set.

Browser/WebGL smoke and first-person gameplay/balance were not run as part of this technical wave. No simulated gameplay or balancing test regime was used.

## Known limits

The pilot provides one prepared junction on each generated architectural floor from level 2 through level 5. Only those two exact route options can change the floor; arbitrary tile edits and anchor recall are not part of this wave. The scene stays alive during the existing bounded world-geometry rebuild, but the geometry group is reconstructed after a committed topology revision.
