# FPS R6C — Combat mastery: stamina, parry, poise, and enemy reads

## Baseline and scope

- Repository: `ThuleGamesDev/Aether-Crawl-`
- Base: `main` at `ec6b9cddff4e98be21c9f4851123dd1c1840fc01`, after the R6B merge (PR #24).
- Scope: a combat pilot for the Cretan Cave Rat, Bronze Revenant, Bull-Cult Enforcer, and Bronze Gatekeeper. Other enemy attack sets keep their existing R5 behavior.
- Runtime boundary: `FPSGameRuntime` owns costs, defense resolution, hit timing, poise, and save state. `PlayerController` resolves movement and defensive windows. React displays the resulting snapshot. Scene telegraphs continue to use the shared attack descriptor.
- Save contract: Maze save version 5 remains unchanged. New stamina and pilot poise values are optional fields and are validated when present.
- No class, item, ability, or Guardian IDs were renamed. No external runtime assets, generation service, or gameplay simulation was added.

## Stamina and defensive actions

`SoloCharacterStats` stores `baseMaxStamina`, current `stamina`, and the remaining regeneration delay. Existing version-5 saves without these properties load with the derived maximum (100 by default) and zero delay. `DerivedStats` exposes `maxStamina` and `staminaRegenPerSecond`; the item stat union accepts `maxStaminaFlat` and `staminaRegenPercent`, but this wave adds no item rolls.

The default stamina rules are 100 maximum, 24 per second regeneration, and a 0.65 second delay after spending. The existing light primary attacks remain free. Deliberate secondary melee attacks carry visible authored costs: Heroic Strike costs 18, Aspis Bash 12, Hermes’ Feint 12, and Pankration Flurry 14. Class skill slots remain usable at zero stamina. MP costs, class passives, attack speed, and ordinary movement do not depend on stamina.

Dodge costs 22 stamina and retains its existing 0.18 second invulnerability and 1.1 second cooldown. The controller confirms actual movement before applying the cooldown or invulnerability; a fully blocked dodge refunds its cost. A dodge below 22 stamina reports the failure and continues ordinary movement. A successful dodge opens a 0.14 second perfect-dodge window. Only an incoming active hit that is actually avoided during that window grants one capped 18% melee counter for 1.1 seconds; the existing melee hit resolver consumes that counter once.

Shield guard remains a hold action. It drains 9 stamina per second and is removed when stamina reaches zero. Q (and the touch PARRY button while a shield is equipped) starts a parry costing 18 stamina, with a 0.20 second active window and 0.58 second recovery. A successful parry must also face the attacker and match an attack explicitly marked `parryable`; it negates that hit, restores 6 stamina, and applies bounded poise pressure to the attacker. A shield block remains available outside the parry window. Parry state is transient; the stamina spent is persisted.

After guard exhausts stamina, it stays disabled until the player releases and raises it again.

## Poise and stagger protection

Pilot enemies have independent optional `poise` and `maxPoise` values. Their authored maximums are 38 for the rat, 66 for the revenant, 86 for the enforcer, and 136 for the Gatekeeper. Poise recovers after a hit delay. A break creates a short stagger window; separate recovery and immunity timers reject further poise pressure, preventing repeated stagger procs. Boss poise pressure is reduced to 48% and the Gatekeeper’s break window is 0.52 seconds.

Melee poise pressure uses authored `poiseDamage` where provided, then distinguishes sweep, thrust, bash, and unarmed styles. Main-hand two-handed impact is multiplied by 1.5; off-hand dual-wield impact is reduced. Stagger-tagged hits use the poise gate for pilot enemies, including projectile impact paths, so an on-hit status or unique cannot create a stagger loop. Non-pilot enemies retain their previous stagger status behavior.

The Threadbound Warden’s existing one-time phase transition now has a 0.72 second transition lock. During the lock, attacks cannot replace recovery with hurt or stagger state; phase damage and the existing one-time `phaseTransitioned` guard remain intact.

## Pilot attack language and exact hit timing

| Pilot | Attack patterns | Shield parry |
|---|---|---|
| Cretan Cave Rat (`rat`) | Bite; Coiled Leap | Bite only |
| Bronze Revenant (`revenant`) | Xiphos Slash; Shield Guard; Prepared Shield Bash | Slash and bash |
| Bull-Cult Enforcer (`bull_enforcer`) | Heavy Cleave; Bull Charge; Oath-Roar | None |
| Bronze Gatekeeper (`gatekeeper`) | Shield Bash; Broad Sword Sweep; Short Guard | Bash and sweep |

Every pilot continues to use `EnemyAttackDefinition` for windup, active time, recovery, cooldown, range, and telegraph color. `enemyAttackContainsPoint` reads the same telegraph descriptor as `SceneRenderer`, and `resolveEnemyAttack` evaluates the original windup position and facing even when a leap/charge also moves the enemy at impact. The enemy AI emits the active hit only on the windup-to-active transition; loading an already active attack does not emit the hit again. Line of sight remains required for non-projectile strikes.

During windups, the HUD reports up to three visible attackers within 10 metres, their direction, remaining time, and either `Q PARRY` or `DODGE / BLOCK`. The focused pilot target exposes its remaining poise. A shield-ready/open/recovery hint, stamina bar, desktop Q input, and touch PARRY button keep the defense state visible.

## Save validation and compatibility

Version 5 remains the only active Maze save version. New player fields accept absent legacy values, but reject out-of-range stamina or regeneration delay. New enemy fields must be paired and bounded; malformed poise, break, immunity, or phase-lock values invalidate the save rather than being trusted. An active attack ID must match its authored set (including existing legacy aliases); a saved windup must retain the authored telegraph duration. A saved `ATTACK_ACTIVE` state resumes its remaining active timer without replaying its hit.

No equipment instance IDs, class IDs, ability IDs, Guardian IDs, or solo route changed. R4 and earlier migrations still feed into the existing version-5 shape.

## Changed areas

- `combat/CombatMastery.ts`, `combat/AbilityRegistry.ts`, `combat/DamageSystem.ts`, `combat/ProjectileSystem.ts`
- `data/enemyAttacks.ts`, `enemies/EnemyBrain.ts`, `player/PlayerController.ts`, `player/PlayerCombat.ts`, `player/PlayerProgression.ts`
- `engine/InputSystem.ts`, `engine/FPSGameRuntime.ts`, `services/fpsSave.ts`, `types.ts`
- `App.tsx`, `styles.css`
- `tests/combatMasteryR6C.test.ts`, `tests/inputSystemR4B.test.ts`
- `docs/ROADMAP.md`

## Technical verification

- `npm run typecheck` — passed.
- `npm test` — passed: 287 tests across 30 files. This includes the 9 R6C tests and the Q/touch parry input regression.
- `npm run build` — passed. Vite still reports chunks above 500 kB: Three.js 540.04 kB and the application bundle 587.65 kB before gzip.
- Path-scoped `git diff --check` across R6C files — passed. The unscoped workspace check still reports existing trailing blank lines in unrelated modified files (`README.md`, `components/Minimap.tsx`, `docs/DUNGEON_GAMEPLAY.md`, `services/dungeonGenerator.ts`, `services/dungeonPlan.ts`, `services/dungeonSave.ts`, `tests/assetRegistry.test.ts`, `world/DungeonWorld.ts`, and `world/EnemySpawner.ts`). Those paths are outside R6C and are not included in its PR.
- Browser/WebGL rendering and gameplay feel/balance — not run. The user will perform the first-person playtest.

## Review context

The R6B merge and its Copilot review were checked before implementation. The review’s split-stack ID collision finding is already fixed on `main`. R6C also corrects the off-hand shield read in `PlayerController` to use the canonical R6B equipment slot. Any review findings generated for the R6C pull request will be evaluated before handing it over; no PR exists yet to review.
