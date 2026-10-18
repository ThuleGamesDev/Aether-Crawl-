# Aether Crawl roadmap

## Current boundary: Floors 1–5

**Normal-party automated browser expedition: completed. Human/physical-phone acceptance and broad balance: open.**

On 2026-10-18, a fresh Paladin/Ranger/Cleric party completed the five-floor chain with normal controls and earned resources. The run won 18 encounters including three optional elites and the Necromancer. Six save/Continue comparisons retained party, map and floor state. A genuine Floor-4 checkpoint was used to continue after a driver heading issue. See [the acceptance record, seeds, ledgers, screenshots and limitations](RUN_ACCEPTANCE.md).

Completed in this hardening pass:

- Pure loot/equip/scrap transactions: no state mutation or whole-stack equipment; reversible accessory stats.
- Real skill-rank power/effects and working SHIELD mitigation with matching descriptions/feedback.
- Ordinary doors remain usable when an optional choice underfoot is declined.
- Separate visible HP/MP lines on narrow combat cards.
- Reproducible opt-in browser driver; read-only diagnostics and normal game inputs, no stat/position overrides.
- 130 tests across 15 suites, typecheck and production build passed.
- Touch-emulated portrait/landscape combat, held-touch map cancellation, guardian victory and save/Continue passed; physical hardware was not tested.

Before calling the slice production-ready:

1. Play blind on a real phone: exploration, target/intention readability, inventory, rest and room choices.
2. Sample more seeds and parties. This expedition knew the map, deliberately equipped rewards, used meditation on all floors and chose Full Restore eight times.
3. Tune AoE/armor/MP sustain from evidence; early rats are easy, later elites and summons are more expensive. Avoid blanket HP inflation from a single sample.
4. Audit remaining ability/content consistency, including legacy group-heal/Focus behavior; exercise crafting, fleeing and defeat with ordinary parties.

## Existing foundations

- Static local assets; no runtime image generation or API key requirement.
- Fullscreen first-person exploration, continuous movement, minimap and mobile controls.
- Enemy intents, weighted authored abilities, statuses, phases, summons and rewards.
- Current combat: one action per actor per initiative round, unlimited hero decision time, visible order, Guard until next own turn. Rounds supersede the earlier Combat 2.5A/B clocks and PR #9 initiative-speed formula.
- Class/enemy initiative, equipment load and legacy-save migration.
- Painted first-five-floor wall/floor/gate and hand-specific weapon presentation. Other artwork remains partly legacy.
- Seeded room placement, treasure/elites/shrines/rest/locked/secret/boss areas, events/hazards and persistent room decisions.
- Closed-door collision and input cancellation while decisions/map are open.

Historical implementation notes: [initiative/art pass](INITIATIVE_AND_PAINTED_LOOK.md), [current combat](COMBAT_SYSTEM.md), [dungeon gameplay](DUNGEON_GAMEPLAY.md). Historical test counts and environment limitations in older records describe those earlier passes, not the current acceptance state.

## Deferred scope

- World-space enemy placement/projection/occlusion/range rules.
- Spatial approach/retreat/charge, line of sight and navigation after spatial ownership is defined.
- Full painted art conversion, true vaulted geometry and outside castle scenes.

These are separate waves. The current pass adds no combat system, enemy navigation, new class/ability or broad feature expansion.
