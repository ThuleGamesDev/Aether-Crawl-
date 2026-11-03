# R6D1 — Loom of Fate and Living Labyrinth Laws

## Player flow

Defeating a Floor Guardian still grants its existing XP and guaranteed Guardian drop exactly once. The kill unlocks the descent and persists one deterministic draft. Interacting with the exit opens **The Loom of Fate** before any floor transition. The player sees one `ROOM`, one `CREATURE`, and one `CURSE` card. Every card states **What changes**, **Danger**, and **Reward**.

Cancel, Escape, or **Return to the Floor** closes the overlay and leaves the draft unchanged. The player can revisit the exit. Choosing a Law closes the Loom, records the selection, and leaves the current floor playable. The next exit interaction descends. At three active Laws, selecting a new Law opens an explicit replacement step; the oldest is highlighted, and no Law is removed until the player chooses one.

The Loom is owned by `FPSGameRuntime`. `App.tsx` presents the saved offer, releases pointer lock for mouse/touch, and routes card clicks to runtime methods. Escape follows the same cancel path. The current floor is never reshaped by a new choice.

## Canonical Law registry

`data/mazeLaws.ts` contains JSON-shaped data only. Each definition has its stable ID, category, prerequisites, incompatibilities, bounded spawn/hazard budget, cue, card copy, trigger, modifier data, and `maxStack: 1`.

| Category | Law | Future-floor effect |
|---|---|---|
| ROOM | `hall_of_echoes` | Converts a combat chamber to an Elite echo chamber; adds an Echo Remnant with a guaranteed rare item. |
| ROOM | `vault_of_tyche` | Marks the sealed treasury for a sacrifice or disarm trial; a successful trial guarantees a rare item. |
| ROOM | `pillars_of_daedalus` | Adds a blocking pillar inside a combat chamber, marks the architectural hall, and adds a rare-reward guard. |
| CREATURE | `bronze_hounds` | Spawns two Bronze Hound variants in one chamber; one guarantees a Bronze Hound Tooth. They reuse the local Cretan Cave Rat sprite with a bronze tint. |
| CREATURE | `arachnes_kin` | Spawns two Arachne’s Brood spiders; the pack guarantees an Antidote Flask that removes poison. |
| CREATURE | `shades_of_styx` | Adds a Stygian Shade with a guaranteed Styx Soul Essence material. |
| CURSE | `oath_of_ares` | Shortens non-Guardian enemy recovery cadence; a successful shield parry restores extra stamina and deals bonus poise damage. Ares sigil and chthonic room lighting mark its chamber. |
| CURSE | `serpents_bargain` | Places one visible poison pool, applies bounded poison on a cooldown, and places a guaranteed Antidote Flask nearby. |
| CURSE | `broken_thread` | Adds a sealed side secret to floors that lack one, raises its search DC, allows one attempt, and charges health on failure; opening it guarantees a rare item. |

All nine IDs are in the initial draft pool. `services/lawDraft.ts` hashes floor seed, Guardian ID, floor level, and unlock-pool version; category order is fixed and results do not depend on `Math.random`. A generated offer is stored once in floor progress. The active set is unique and capped at three; history and manifestation counters are bounded. Cross-Law incompatibility is explicit in the registry and enforced when committing.

## World and combat changes

`world/LivingLabyrinth.ts` edits the existing R6A plan and spawn metadata; it does not introduce a second map generator. Room selection and side-branch placement are deterministic. The Broken Thread side pocket replaces only a previously solid leaf wall. The Daedalus pillar is placed only where the Guardian route remains reachable. A floor can carry at most five law-spawn slots (five enemies total) and one poison hazard; Guardian and exit placement stay unchanged.

All nine options manifest on the first generated floor after selection in the supported R6A layouts, including the new guaranteed secret pocket for Broken Thread. `manifestedLawIds` and each active Law’s first/last floor and count are persisted for inspection and invariant tests. Enemy variants use existing attack sets and local art. No runtime generation service or new engine was added.

## Save contract and compatibility

The expedition save advances from version 5 to version 6 under the existing save key. `FloorState.lawProgress` stores active Laws, a bounded choice history, and the current draft including whether the Loom is open, selected, or awaiting a replacement choice. `lawSpawns`, `lawHazards`, and `manifestedLawIds` are validated against room IDs, map bounds, stable IDs, and hard caps.

R6C version-5 saves migrate in memory to v6 without rewriting the source until the new save is written. If the old save already has a defeated Guardian and unlocked descent, migration creates the same deterministic, unopened draft from that floor’s seed and Guardian. R1, R2A, R4A, and R4B migrations now also emit v6 state. Inventory instance IDs, equipment, world map, XP, loot, Guardian reward flags, and combat state are retained. New saves normalize a missing Law state so valid pre-R6A floor shapes remain loadable.

Guardian death, opening/canceling/selecting the Loom, resolving a Law room choice, opening a secret gate, and floor descent persist the corresponding state. Loading with the Loom open restores the same three cards; loading after selection cannot select twice or descend automatically.

## Separate contracts

The future meta-unlock contract uses `maze_of_the_minotaur_meta_v1` and `MazeLawMetaUnlockState`. The nine pilot Laws remain available; future discoveries add draft options only. This wave does not store meta progression or grant permanent stats.

`data/minotaurLawContract.ts` defines a versioned, data-only limit of three Law modifiers for the future Minotaur. It does not add a Minotaur encounter. R6D2 adds bounded spatial route edits at prepared anchors; the Minotaur encounter remains future work.

## Review carryover

R6C PR #25 was reviewed before implementation. This wave carries three confirmed cleanup items into the focused branch: phase-transition locks now count down for non-poise bosses such as the Threadbound Warden; the frame-updating attack read is no longer an assertive live status; and stamina-cost abilities retain the `Ready` label when usable. A regression test covers the Warden phase lock.

## Files

- Law contract and draft: `types.ts`, `data/mazeLaws.ts`, `data/minotaurLawContract.ts`, `services/lawDraft.ts`, `world/LivingLabyrinth.ts`.
- Runtime, exits, rewards, hazards, and save versioning: `engine/FPSGameRuntime.ts`, `world/DungeonWorld.ts`, `world/EnemySpawner.ts`, `world/WorldGeometry.ts`, `enemies/EnemyBrain.ts`, `services/mazeSave.ts`, `services/dungeonSave.ts`, `services/fpsSave.ts`.
- UI, inventory remedy, and authored icons: `App.tsx`, `styles.css`, `services/uiInputPolicy.ts`, `player/PlayerProgression.ts`, `data/itemBases.ts`, `data/itemIconRegistry.ts`, `services/itemization.ts`.
- Regression coverage: `tests/lawDraftR6D1.test.ts` and updated save, Guardian progression, and input tests.

## Verification

- `npm run typecheck` — passed.
- `npm test` — passed: 294 tests across 31 files, including the new 6-test R6D1 suite.
- `npm run build` — passed. Vite reports the existing Three.js chunk at 540.04 kB and the application chunk at 616.59 kB, both above the 500 kB advisory threshold.
- `git diff --check` — passed on the exact proposed file set using a temporary index; no whitespace errors.
- Browser/WebGL rendering and gameplay feel/balance were not run; the user will perform the first-person playtest.

## Known limits

Bronze Hounds are a tinted variant of the existing quadruped rat sprite, not a newly authored sprite. The meta-unlock state is a contract only; it is not persisted in this wave. No Minotaur fight or unrestricted wall reshaping is present.
