# Dungeon Gameplay 2.0 — rooms, secrets, risk and reward

## Floor ownership

The existing 12×12 recursive maze generator remains the foundation. `generateDungeon(biome, seed, level)` uses the small local `floorRandom` helper for maze, loops, decorations and gameplay placement. Combat/ordinary loot randomness is not rewritten. Saved maps and room plans are loaded verbatim, never regenerated.

`dungeonPlan.ts` finds the existing exit route, assigns a guardian threshold and camp, prefers off-route reward anchors, and groups remaining walkable cells into logical route areas of up to eight cells. Special nodes are gameplay anchors, not a claim that each tile is an architectural room. Normal areas may contain a final single-cell remainder. Node IDs include level and floor seed; labels and stories live separately in `data/dungeonRooms.ts`.

Locked/secret chambers are carved only into previously solid side walls with a single connection to the reachable maze. Prefer a two-cell gate/chamber; a sealed one-cell alcove plus its approach is the fallback on dense maps. No old corridor or start/exit tile becomes a gate. Every primary route remains traversable without a key or secret discovery. A treasure/camp/threshold and two marked patrols are always placed on the generated early maps. The first-five-floor budget is intentionally small:

| Floor | Common nodes | Additional decisions |
| --- | --- | --- |
| 1 | Treasure, Rest, Locked, 2 patrols, threshold/guardian, Normal routes | Lost expedition Event |
| 2 | Same common budget | Blood Shrine, one Hazard |
| 3 | Same common budget | Aether Shrine, one Elite, one Secret, Event |
| 4 | Same common budget | Fortune Shrine, one Elite, one Secret, one Hazard |
| 5 | Same common budget | Blood Shrine, one Elite, one Secret, Event |

Later biome identity uses existing bone/mist, moss/spores, frost/vent, gilded/vault and obsidian/rune content. This is not a complete later-biome content expansion. Early elite/hazard counts stay at most one; no unbounded danger stacking is added.

## Room classifications and decisions

| Type | Question / behavior |
| --- | --- |
| NORMAL | Route area for exploration memory; no forced menu |
| COMBAT | A visible patrol starts on entering its anchor or can be challenged with E. Cleared once. Can a different route or fleeing preserve resources? |
| ELITE | Challenge the control/guard/striker alliance for better equipment, or preserve the party? Requires explicit E and confirmation. |
| TREASURE | Choose guaranteed GOOD equipment or two HP potions +10 scrap. No random empty crate or repeated claim. |
| SHRINE | Blood/Aether/Fortune trade-offs below; leave and return later if the cost is unattractive. |
| TRAP | Inspect per-hero stat/DC chances; attempt the existing hazard checks for 15 scrap, or pay 8 scrap for safe tools to salvage 15 without damage (net +7), or pass without searching. |
| SECRET | Inspect the cold-draft stone seam, then choose a cursed relic or safe salvage. Not shown as a secret on the minimap before discovery. |
| REST | Choose HP recovery, MP recovery or preparation. One action at that camp, not all three. Returning only helps if it remains unused. |
| LOCKED | Spend a found floor key, 15 scrap, or risk one STR check; keep going without the optional vault if the price is too high. |
| EVENT | Read the warning/leave offerings for preparation, or scavenge a key and scrap. Local biome story, no generated narrative. |
| BOSS_ANTECHAMBER | A quiet threshold and nearby one-use camp: prepare now, seek more supplies or challenge the guardian? No free full heal. |
| BOSS | E deliberately starts the guardian; after victory E descends. Victory does not force descent, so remaining side content and an unused camp can still be visited. |

No Merchant, puzzle engine, quest engine, hub, enemy navigation or projectile physics is added.

## Prices, rewards and statuses

- Treasure: GOOD existing-category gear **or** 2 Health Potions +10 scrap.
- Elite: two complementary enemies on floor 3 (Spider + Skeleton), then Orc + Cultist + Skeleton. Uses their existing control, guard, buff and heavy intents at normal level scale; not doubled HP. Victory grants one guaranteed GOOD item +15 scrap instead of the ordinary per-enemy random loot. XP is unchanged; summons still grant no rewards. Fleeing grants nothing and leaves the node unresolved for a later challenge.
- Blood: every living hero loses 20% maximum HP for a RARE Strength sigil. Disabled if any living hero would die. No dead-hero cost/revival trick.
- Aether: restores 40% maximum MP to living heroes and prepares −3 attack damage Weakness for three own cycles, starting in the next encounter.
- Fortune: pay 20 scrap and select one of three distinct GOOD equipment categories. Previewed rewards are deterministic; the other choices vanish with the claim.
- Rest: recover 25% max HP **or** 35% max MP **or** prepare +3 Strength. Event respect gives +2 Strength instead of its key/+8 scrap option.
- Locked: found Iron Key, 15 scrap, or strongest living STR against DC `12 + floor(level/2)`. Show the exact success percentage. The check is seeded and allowed once; failure costs 8% maximum HP, clamped to keep living heroes alive. Key/scrap alternatives remain after failure. Unlocking and claiming the RARE sigil are separate; neither repeats.
- Secret: reveal has no cost/modal/reward. Then choose RARE sigil + a next-encounter Weakness preparation **or** 15 scrap without curse. Both claim choices add one floor key, capped at three.
- Trap: uses `resolveCharacterCheck` / `applyRoomEventToParty` and the existing modifiers/critical consequences. Each hero's actual success chance is computed over the 20 possible rolls before committing. Results are seeded by floor/room/hero, cannot reroll the resolved node, and use the existing results modal. Surviving attempts salvage 15 scrap; safe tools cost 8 and recover 15 scrap (net +7) without hazard consequences.

Floor keys start at zero, are earned in Event/Secret decisions, never enter the regular item inventory, and expire on descent. A key has a real opportunity cost through the choice that earns it. The tier wrapper is deliberately small: NORMAL uses the existing floor tier, GOOD adds one, RARE adds two. The new items use existing equipment/accessory/consumable rules; no affix/rarity economy overhaul.

Preparations are consumed from the floor once on encounter start. Status duration follows existing own-action-cycle semantics, not wall time: remaining cycles can survive a very short encounter, as other existing statuses do. The floor does not regrant the preparation on another fight. Preparations of the same status refresh the strongest value/duration rather than stacking or downgrading it. Existing skill damage, status arithmetic and combat timing remain unchanged.

## Interaction and presentation

E is the only world interaction key. Context prompts name the actual action. Rooms use the existing static crate/barrel/bones/biome-prop assets, plus small code-rendered icon/text markers with line-of-sight occlusion; no new bitmap or runtime generation is needed. Sealed vaults use the existing door texture; secret gates use the ordinary wall texture with a nearby cold-draft cue and contextual Inspect prompt. Secrets do not require clicking a single pixel.

Entry messages occur once per visited special area. Only actual choices open a dialog. The exploration loop and mouse look stop, pointer lock is released, and stale movement input is cleared while a choice/results dialog is open. Revealing a secret instead gives a short log/audio cue and updates the map immediately.

The minimap distinguishes visited walkable cells from seen cells, masks undiscovered secret interiors, and marks only discovered nodes. R = Rest, S = Shrine, B = Guardian, ! = Elite, ? = discovered Secret; resolved nodes become subdued. Seen rooms are reconciled when starting/loading, without re-triggering an encounter. The full map includes a legend and the current floor-key count.

## Floor memory and saves

`FloorState` v1 is optional within the existing save key/schema and stores seed/level/biome, room definitions, discovered/visited/resolved flags, attempted lock checks, visited cells, key count and unconsumed preparations. Opened gates are represented by the saved map plus an unlocked/discovered room flag; loading reconciles the physical map from that flag even if a save captured an earlier React map snapshot. A vault's reward claim is a separate resolved flag. COMBAT/ELITE nodes resolve only on victory. Claims commit to the authoritative ref before UI feedback/combat dispatch, so double clicks cannot claim again.

Mid-combat saves remain unsupported. Saving with a pending floor encounter is rejected even before React phase publication; malformed floor state or pending encounters are rejected on load. Normal saves retain room state, gates, keys and statuses. No timer, callback or generated image enters the floor state.

Old saves lacking floor state keep their map, decorations and cleared path. A deterministic anchor-only migration adds decisions without carving gates or inserting new patrols into a partially played floor. Existing guardian defeat flags reconcile the boss node. New locked/secret content is available on subsequent generated floors. This avoids altering old traversable geometry or granting a fresh reward for an old cleared patrol.

## Architecture and validation

- `floorRandom.ts`: local deterministic RNG/hash.
- `dungeonPlan.ts`: topology queries, bounded placement, logical clusters, legacy migration.
- `dungeonGameplay.ts`: pure decision/reward/check/visit/claim/encounter settlement and preparation rules.
- `dungeonSave.ts`: serialized floor validation.
- `useDungeonGameplay.ts`: authoritative floor ref, UI decisions/results, atomic player/map commits and encounter callbacks.
- `DungeonDecision.tsx`, existing `RoomEventModal.tsx`, Viewport and Minimap: presentation.
- App: level generation/load/save and encounter/reward coordination; room policy is outside App.

## Floors 1–5 hardening status (2026-10-15)

The first-person collision audit found that ordinary `DOOR` tiles looked closed and had an E interaction, but movement treated them as floor. Closed doors now share the blocking-tile rule used by floor reachability; the look ray still selects a door so E can open it. Mobile stick/look inputs reset and unmount while a room decision or map overlay is open, preventing a held touch from resuming movement after the overlay closes.

Validation on this branch:

- `npm test`: 116/116 tests pass across ten suites, including 1,000 seeded Floors 1–5 map checks and the closed-door regression case.
- `npm run typecheck`: pass. This also fixes a test cleanup callback whose returned `VitestUtils` value broke the repository-wide check.
- `npm run build`: pass with Vite 5.4.21 and TypeScript 5.9.3.
- Full browser/manual run: not performed. No local Chromium is installed, and the remote browser cannot reach this isolated local dev server. The first-run Floors 1–5 flow, touch behavior on a real device, pacing and reward balance remain open playtest items.

The earlier saved-fixture smoke checks recorded for Dungeon Gameplay 2.0 are useful subsystem evidence, but do not replace a normal new-party expedition through the fifth-floor guardian. See [the roadmap](ROADMAP.md) for the remaining acceptance work and the deferred combat sequence.

## 2026-10-18 integration follow-up

A real ordinary-start five-floor browser expedition has now completed; the earlier unavailable-browser note is historical. It exercised actual choices, equipment, elites, guardians and six save/reload comparisons. The current interaction ray lets an ordinary closed door ahead take priority over an unresolved optional choice underfoot, so declining a room does not trap the main route. Details, seeds, evidence and remaining limits are in [the run acceptance record](RUN_ACCEPTANCE.md).
