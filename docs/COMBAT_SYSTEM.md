# Combat System

Combat is a turn-based party fight. The party acts one living character at a time, then each living enemy resolves the action already shown by its intent. Enemy decisions are local TypeScript rules; no runtime AI service or generated asset is involved.

## Turn flow

1. `startCombat` creates a boss or a curated encounter and plans an intent for every living enemy.
2. Each living party member resolves turn-start status effects and takes one action. A stunned character loses that action.
3. Each enemy that was alive at the start of the enemy phase is checked in current combat state, then resolves its stored intent. Enemies summoned during the phase wait until the next enemy phase.
4. If combat continues, cooldowns and available abilities are checked and the next intents are planned before the next party phase.
5. When all enemies are defeated, summoned enemies grant no XP or loot. Encounter enemies grant the established rewards and combat returns to exploration or level-up.

## Intent lifecycle and display

`Enemy.intent` contains an intent type, display name, compact label, icon, optional raw damage range, description, ability ID, and interrupt flag. `planEnemyIntents` writes intents before the party phase. `resolveEnemyIntent` looks up that ability ID and performs its effect; it does not roll a replacement action during the enemy phase.

Every living enemy shows a compact badge above its sprite. Basic attacks show an approximate damage range. Named actions show their icon and short name. The selected enemy panel provides the longer explanation and indicates when Stun can interrupt an action or when a boss resists Stun. Damage ranges show the attacker's expected raw strength; Dexterity, Defend, armor, shield, and guard can reduce final damage.

Supported intent types:

| Type | Typical meaning |
| --- | --- |
| `ATTACK` | Single-target attack with a damage estimate |
| `HEAVY_ATTACK` | Strong attack, usually telegraphed or conditional |
| `DEFEND` | Adds temporary guard |
| `BUFF` | Improves living enemy allies |
| `DEBUFF` | Applies an existing status effect to a party member |
| `HEAL` | Restores health, sometimes by consuming a summon |
| `SPECIAL` | Non-damage action such as stealing scrap |
| `PREPARE` | Announces a later action and creates a combat flag |
| `SUMMON` | Adds bounded enemies to the encounter |

The canvas badge is intentionally brief. Longer intent text is shown only for the selected enemy so mobile combat keeps its usable view area.

## Ability registry and behavior

`data/enemyAbilities.ts` is the ability registry. Definitions include identity, intent label and icon, weight, optional cooldown, damage multiplier, phase/health/flag requirements, interrupt behavior, and a typed effect. `data/enemies.ts` assigns canonical ability IDs and a design role to each pilot enemy. Enemies outside the pilot use the registered `basic_attack` ability until given a custom ability set.

`services/enemyAI.ts` owns intent selection, generic effect resolution, enemy phase transitions, theft refunds, summons, and the enemy cap. Selection uses weighted candidates after checking phase, health, flags, resources, summons, and cooldowns. A required combat flag or matching follow-up takes priority over weighted choice. If an enemy has only one valid ability, it may repeat that ability instead of falling back to a different action.

For a new behavior pattern, first express eligibility with `minHpRatio` / `maxHpRatio`, phase bounds, cooldowns, and combat flags. A prepared sequence should have a prepare ability that sets a flag and a follow-up ability that requires it; use `cancelFlagOnInterrupt` when Stun must cancel the sequence. Add a small `activateEnemyPhases` rule only for a real phase transition. Extend the typed effect union and resolver once when a mechanic cannot be represented by the existing effects, then reuse that effect in data rather than adding a branch to the turn loop.

## Pilot enemies

| Enemy | Role | Tactical question |
| --- | --- | --- |
| Giant Rat | Striker | Can the party finish it before its low-health desperate bite? |
| Acid Spider | Controller | Is Poison worth taking, or should the spider be focused first? |
| Goblin Scavenger | Disruptor | Can it be defeated before it takes up to three scrap? |
| Skeleton Warrior | Tank | Should the party spend attacks breaking its guard? |
| Orc Brute | Scaler / heavy striker | Can the party interrupt the wind-up or defend against Crushing Blow? |
| Dark Cultist | Support | Is it more important to remove the enemy-wide Strength buff for the next two enemy actions? |
| Green Slime | Scaler | Can the party burst it down before it completes its one-time split? |
| The Necromancer | Boss support | Should the party focus the boss, manage skeletons, or interrupt Mass Raise? |

Early and mid encounters use small curated combinations through level 6. Above level 6 the existing broad random roster remains in place; this pass does not author bespoke abilities for every enemy in the catalog.

## Status effects and guard

Combat reuses `POISON`, `BURN`, `REGEN`, `SHIELD`, `STRENGTH`, `WEAKNESS`, and `STUN`. Applying a status refreshes the same type rather than stacking unlimited duplicates. Poison and Burn damage, Regeneration, and durations are processed at the affected character's or enemy's turn start. Stun is checked before its duration is consumed, so a one-turn Stun actually cancels the next eligible action.

Enemy guard is a temporary combat value separate from status effects. It absorbs incoming player damage before HP and is consumed by damage. Defend continues to halve incoming attack damage before armor and shield values are applied, so it provides a useful response to the Orc's telegraphed heavy hit.

## Cooldowns, interrupts, and randomness

Ability cooldowns count down when that enemy takes a later turn. Weighted choices cannot override required follow-up flags. The Orc's sequence is fixed: `Wind Up` sets a flag, `Crushing Blow` consumes it and sets a recover flag, and `Recover` consumes that flag. Stun during the charged action removes the wind-up flag and cancels the blow.

Stun cancels ordinary enemy actions. Bosses have 50% Stun resistance, shown in the selected enemy panel. A boss only loses an action to Stun when its current intent is explicitly marked interruptible; an uninterruptible boss action continues and reports the resistance. The Necromancer's Mass Raise sequence is interruptible, so the player can stop the skeletons from appearing.

## Summons and boss phases

There can be at most five living enemies in one fight. Summons use existing canonical enemy IDs and their registered static visuals. Summoned enemies have no XP or loot value and do not recursively split.

The Necromancer enters Phase II at 60% HP. Phase II forces a telegraphed Mass Raise preparation, followed by a summon of up to two skeletons. It can later use Soul Harvest to consume one of its own summons and heal up to 24 HP. Killing the summons removes that healing option; Stun can interrupt the Mass Raise intent. The boss receives the usual XP/loot once, regardless of summon count.

## Adding an enemy ability

1. Add a typed effect and display definition in `data/enemyAbilities.ts`. Prefer existing status types and existing resolver effects.
2. Add the new ability ID to the canonical enemy definition in `data/enemies.ts` and assign its role if appropriate.
3. Use flag or phase requirements for guaranteed follow-ups. Avoid name checks in `App.tsx` and avoid adding per-enemy branches to the turn loop.
4. Add a combat test for intent selection, resolution, and its counterplay. Add a new effect handler only when no existing typed effect fits.
5. Run `npm test`, `npm run typecheck`, and `npm run build`. Keep visuals in the existing static asset registry and local PNG pipeline.

## Scope and follow-up

This pilot changes the Giant Rat, Acid Spider, Goblin Scavenger, Skeleton Warrior, Orc Brute, Dark Cultist, Green Slime, and first biome boss. Other enemies currently communicate their fallback attack intent but retain their previous simple attack behavior. A later content pass can add authored behaviors to the remaining catalog after the pilot's pacing and mobile badge readability are play-tested.
