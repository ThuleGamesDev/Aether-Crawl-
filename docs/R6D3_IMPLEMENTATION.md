# R6D3 — Living Labyrinth Synergies, Minotaur Legacy Contract, and Chronicle

## Law synergies

`data/lawSynergies.ts` is the explicit registry for three stable Law combinations. A resolver accepts only up to three unique, known active Laws, rejects incompatible sets, and returns authored pairings rather than generating a cross-product.

| Synergy ID | Required Laws | Floor consequence | Bound |
|---|---|---|---|
| `echo_pack` | `hall_of_echoes` + `bronze_hounds` | One Echo Remnant and two Bronze Hounds share an Elite chamber. Each Law keeps its own once-only reward. | 3 Law enemies, 0 hazards |
| `ares_pillar_arena` | `oath_of_ares` + `pillars_of_daedalus` | A Daedalus guard fights among blocking pillars with Ares cadence; the existing successful-parry stamina and poise reward remains active. | 1 Law enemy, 0 hazards |
| `venom_nest` | `serpents_bargain` + `arachnes_kin` | Two Arachne's Brood guard one marked pool. One Antidote Flask is visibly offered beside the pool; the brood reward is suppressed for this pairing. | 2 Law enemies, 1 hazard |

`world/LivingLabyrinth.ts` applies these pairings to the existing deterministic floor plan and spawn data. It does not change Thread junctions, charges, route cells, or Thread transaction costs. Room and hazard records carry validated synergy IDs, and the local world renderer uses cues only for the changed chambers. The encounter budget counts Law-added enemies and hazards; it does not include the floor's ordinary roster.

## Maze Chronicle

The active FPS runtime owns the Chronicle. It records Guardian Law choices, encountered Law and synergy manifestations, successfully woven Thread Anchors and their costs, and discovered non-normal room and enemy families. Room families are recorded on discovery; enemy definitions are recorded only when alive and visible within the existing short range and line of sight. It does not enumerate undiscovered rooms or enemies.

`MazeChronicle` is version 1 and stores at most 64 ordered, deduplicated events in the run save. IDs derive from the event sequence, not wall-clock time. The Chronicle panel shows the active Laws and latest run discoveries; it does not create analytics or persistent account-level state. Event validation uses the current Law, synergy, room, and enemy registries.

## Future Minotaur data contract

`data/minotaurLawContract.ts` keeps the earlier three-Law modifier summary and adds `MinotaurInheritancePlan`, a data-only preparation contract. It accepts up to three unique, compatible Law IDs, selects at most three deterministic modifiers, collapses both venom Laws into one risk group, and includes required arena rules (`CLEAR_COMBAT_FLOOR`, `SINGLE_VISIBLE_ENTRY`, `NO_ROUTE_EDITS`), visual cues, bounded phase options, and a budget capped at six points, zero concurrent adds, one hazard, and one status proc per hit. The validator reconstructs and compares the canonical plan, so partial arena rules and noncanonical outputs fail validation.

No Minotaur enemy, boss encounter, clone, or executable boss behavior is introduced. The optional obscured reminder on Law cards reads `The Beast will remember this choice.`

## Save compatibility

The expedition save advances from version 7 to version 8. New saves require a valid Chronicle. R6D2 version-7 saves receive an empty version-1 Chronicle in memory; the existing map, rooms, Thread junctions, charges, choices, and topology revision are retained. Older supported R1–R6D1 migration paths now normalize to version 8 and initialize the Chronicle without regenerating the existing floor. The source save is rewritten only when the run is next saved.

## R6D2 review carryover

Two Copilot findings on merged R6D2 PR #27 are fixed in this wave:

- Ariadne's Thread flood fill now uses the same tile walkability contract as collision and reachability, so a closed `DOOR` does not create a false route.
- The center chamber is marked unsuitable for combat only on floors 2–5 where Thread anchors are enabled. Later floors remain eligible for normal room placement.

Regression assertions cover both cases. No additional pre-PR Copilot findings were known at implementation time; the new PR review is checked after opening.

## Main changed areas

- Law pairing data, deterministic manifestation, room cues, and validation: `data/lawSynergies.ts`, `world/LivingLabyrinth.ts`, `world/WorldGeometry.ts`, `services/dungeonSave.ts`, `types.ts`.
- Chronicle events, runtime discovery, UI, and run persistence: `services/mazeChronicle.ts`, `engine/FPSGameRuntime.ts`, `components/MazeChroniclePanel.tsx`, `App.tsx`, `styles.css`, `world/DungeonWorld.ts`, `services/mazeSave.ts`, `services/uiInputPolicy.ts`.
- Future Minotaur preparation contract: `data/minotaurLawContract.ts`.
- R6D2 review corrections and regression coverage: `services/ariadneThread.ts`, `services/labyrinthLayout.ts`, `tests/ariadneThreadR6D2.test.ts`, `tests/labyrinthR6A.test.ts`.
- Synergy, Chronicle, migration, determinism, bounded reward, Thread stability, and plan validation coverage: `tests/lawSynergiesR6D3.test.ts` plus updated save-version assertions in existing technical suites.

## Technical verification

- `npm run typecheck` — passed.
- `npm test` — passed: 313 tests across 33 files, including 8 R6D3 tests.
- `npm run build` — passed. Vite reports the Three.js chunk at 542.46 kB and the application chunk at 654.87 kB before gzip, above the 500 kB advisory threshold.
- `git diff --check` — passed for the proposed tracked files; added files were also checked against an empty index with no whitespace errors.
- Browser/WebGL smoke and first-person gameplay or balance review were not run. The workspace has no verified browser smoke result for this wave, and gameplay review is reserved for the user's playtest.

## Known limits

The Chronicle is a bounded run record, not a searchable history across runs. The Minotaur plan is a future-facing contract only; its cue and phase-option IDs are not consumed by an encounter. Pairing cues use existing local geometry and effects. First-person playability and balance remain for the user's playtest.
