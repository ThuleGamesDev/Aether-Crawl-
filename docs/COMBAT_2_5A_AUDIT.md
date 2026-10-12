# Combat 2.5A implementation audit

Baseline: main `d674594b25c2d66e712f074785cb979f4cb9f2f6`.

## Before implementation

- `App.tsx` owned `isPlayerTurn`, `activeCharIndex`, `combatMenu`, party/enemy state, selected enemy, VFX, and all turn handoffs. It also implemented player skills/items and status application.
- Encounter creation planned all enemy intents, waited 420 ms, then `startPlayerTurn(0)` ran each surviving party member in index order. Stun skipped a hero after another 350 ms timeout.
- Attack, Defend, skills and items resolved synchronously, then called `startPlayerTurn(index + 1)`. Flee also consumed the current turn on failure.
- `enemyTurn` was asynchronous: it captured living enemy IDs, slept 330 ms before each enemy, resolved the advertised intent, then replanned every intent and restarted party index 0. Newly summoned enemies waited for the next global enemy phase.
- `combat.ts` already contained attack/armor/guard arithmetic, skill scaling, status creation/refresh and status-cycle resolution. `enemyAI.ts` already contained intent planning, action cooldowns, typed enemy effects, boss phase activation, bounded summons and stolen-scrap settlement.
- Exploration movement already used a ref-driven RAF, continuous transforms and a separate grid-cell event boundary. Room events are separate from combat and remain intact.

## Decisions

- Reuse combat arithmetic and enemy resolvers. Replace handoffs and waits with one runtime clock and per-actor recovery/casts.
- Extract player action resolution into `combatActions.ts`; validate resources before committing an action. Keep XP, loot and exploration transitions in App.
- Preserve status durations as own actor cycles; Defend uses simulated-time guard expiry. READY heroes never act automatically.
- Keep enemy gameplay definitions separate from ephemeral timeline records. Runtime values never enter saves; saving is disabled during encounters.
- Share the compact quickbar between desktop and touch. Refresh timeline UI at 10 Hz; mutate timer records in the runtime without per-frame React state updates.

## Validation and existing gate issues

- Corrected a duplicate `export default Viewport` already present on main.
- Corrected App's grouped interaction-union access using an explicit property guard.
- Corrected an existing first-person test that passed fractional coordinates to a helper accepting grid cells; movement behavior is unchanged.
- Added the standard Vite client declaration for CSS imports.
- Exact declared npm dependency installation is blocked by unavailable network/cache metadata. Validation used the available TypeScript/Vite toolchain and a temporary Node assertion adapter for the Vitest-authored tests. The Tailwind 4 compatibility override and all adapters remain outside the PR.

## Completed validation

| Check | Result |
| --- | --- |
| Application typecheck | Pass with available TypeScript 7.0.2; test sources are bundled separately because Vitest is unavailable |
| All authored test cases | 75/75 pass across eight suites using Node 24 and a temporary assertion/mock adapter; includes 18 new timeline cases |
| Browser production bundle | Pass with available Vite 8.3.3 and a temporary Tailwind 4 compatibility override; 41 modules, ~350 kB JS / ~108 kB gzip |
| Desktop browser flow | Pass at 1366×768: exploration/exit interaction, Necromancer encounter, visible cast, Space pause, F-key/digit selection, skill, Party selection, Defend, potion, victory, XP/loot, floor 6, save |
| Emulated touch flow | Pass at 390×844: joystick, exit interaction, cast display, Pause/Resume, skill, Party selection, Defend, potion, victory, XP/loot, floor 6, save |
| Pause/resource/save checks | Active recovery/guard labels freeze; potion restores HP; combat Save is disabled; guards clear after encounter; no runtime clock in save |
| Browser errors | No page or console errors in the smoke flows |

The mobile party timeline is a compact row above the quickbar. The combat minimap is hidden on small screens and the selected enemy panel is moved below the top controls to expose cast information. Exploration HUD/layout remains intact.

The standard npm/Vitest commands with the declared dependency versions still require verification in an environment that can install those packages. Touch validation is browser emulation, not a physical-device pacing measurement. No compatibility config, binary, test adapter or dependency version change is committed.
