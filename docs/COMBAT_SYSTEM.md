# Combat System — 2.5A

Combat uses one simulated clock and independent actor timelines. The player controls every party action; no party auto-attacks or automatic skills are present. Enemy Intents, existing damage/equipment rules, static assets, boss phases, XP and loot are retained. Enemy sprites remain presentation targets rather than navigable world actors.

## Ownership and flow

- `services/combatRuntime.ts`: encounter clock, readiness, recovery, casts, guard expiry, actor lifecycle and terminal outcome latch.
- `services/combatActions.ts`: atomic player action validation/resolution using the established arithmetic.
- `services/combat.ts`: damage, armor/shields, status refresh and own-cycle status arithmetic.
- `services/enemyAI.ts`: advertised intent resolution, weighted next intent, ability-cycle cooldowns, flags, boss phase and summon rules.
- `data/combatTiming.ts` and `data/enemyAbilities.ts`: timing policy and authored ability values.
- `hooks/useCombatRuntime.ts`: a single RAF, runtime ref, 10 Hz UI snapshot and one-shot outcome delivery.
- `App.tsx`: encounter start, feedback, rewards and return to exploration. No turn handoffs, enemy sleeps or combat timeouts remain.

Previous flow was party index 0 → 1 → 2 → all enemies → party index 0, with fixed 420/350/330 ms wait chains. Current flow is each living actor charging independently. An actor becoming READY never blocks other actors. A hero stays READY until the player acts. An enemy begins its announced cast, resolves it once, picks its next intent and recovers.

## Clock and readiness

The clock stores `elapsedMs`, `timeScale` and `paused`. Delta time is applied in bounded 50 ms substeps; timers carry transition overflow so timing does not depend on render frequency. The browser bridge caps long frame deltas to 100 ms, drops hidden-tab catch-up and suspends on full options/map overlays. Timers do not advance while those overlays are open.

Each runtime record contains actor ID/side, remaining recovery, recovery duration, readiness, guard expiry and optional cast. It stores no callbacks and is separate from Character/Enemy gameplay data. Initial party readiness is staggered from 450 ms; enemies start from 1400 ms. Summons receive their own initial timer and never act in the resolving summoner's event.

Base hero recovery: Barbarian/Paladin/Cleric 1000 ms, Rogue 800 ms, Ranger 900 ms, Monk 850 ms, Sorcerer/Necromancer 1100 ms. Attack uses 90%, Defend 105%, potion 95%, Flee 110%. Skills use a small policy for normal/heavy/AoE recovery or an optional `Skill.recoveryMs` override. DEX still affects existing damage/crit/defense arithmetic, not timeline speed.

## Enemy Intents and casts

The ability registry contains cast and recovery milliseconds. `EnemyIntent` exposes these values and interrupt resistance. Every enemy shows its next action throughout recovery. At cast start the runtime freezes that intent; phase changes cannot replace it midway. The resolver executes that exact ability ID and only then plans the next intent.

Examples: Bite 400 ms, Venom Fang 700 ms, Dark Chant 1500 ms, Crushing Blow 2000 ms, Mass Raise 2500 ms. Cast values are finite and bounded to five seconds. Normal attacks have shorter preparation; heavy, summon and support actions have visible counterplay windows.

Existing PREPARE → follow-up sequences remain: Orc Wind Up → Crushing Blow → Recover; slime instability → one-time split; Necromancer Phase II ritual preparation → Mass Raise. Ability cooldowns count own resolved actions, not global turns or wall-clock seconds.

## Tactical controls

- Desktop: Space toggles pause; 1–4 or F1–F4 selects a READY party member. Clicking a READY party HUD card also selects it.
- Touch: Attack, Defend, Skill, Item, Party, Pause/Resume and Flee share the desktop quickbar. Buttons are at least 44–48 px; no hover is needed.
- Skill, potion and Party selection reduce simulated speed to 20%. Cancel/selection returns to normal speed. Slowdown and pause are independent.
- Pause freezes enemy casts, hero recovery and guard duration. Menus remain usable. A READY hero may execute one immediate action while paused; its recovery waits until resume. There is no queued automatic party command system.
- LMB on the enemy presentation keeps the existing `selectedEnemyId`. Commands use that living target, or the next living enemy if it was defeated.

The viewport remains fullscreen. Party cards show READY or recovery seconds and a compact gauge. Enemy badges show cast time/progress; the selected enemy panel spells out interruptibility and boss resistance. There is no global ENEMY TURN screen.

## Interrupts and boss counterplay

Accepted STUN cancels an interruptible live cast immediately, consumes one Stun cycle, clears the corresponding preparation flag, suppresses immediate repetition and applies 650 ms recovery. Unrelated poison/burn/regen effects are not ticked a second time by interruption. A newly stunned READY hero loses readiness and recovers instead of bypassing Stun with a click.

An explicitly uninterruptible action completes even with Stun present. Ordinary enemy actions are interruptible unless explicitly disabled; boss actions require an authored interrupt flag. Bosses use ability-specific resistance where present: Soul Bolt 35%, Summon Dead 50%, Mass Raise 65%, with the established boss fallback otherwise. Bosses are not universally immune. Phase II activation is an instantaneous existing rule, not a newly invented cast; it preserves the currently announced cast and influences the next intent.

## Defend and statuses

Defend halves incoming damage before the existing armor/shield reduction for a 2800 ms simulated-time guard window. The window continues across the hero's recovery and is visibly marked GUARD. It freezes under tactical pause and expires automatically. All guard flags are cleared on encounter completion or escape.

Poison/Burn/Regeneration and status durations still count the affected actor's own action cycles: hero readiness transitions, enemy intent resolution. READY idle heroes do not continuously tick statuses or auto-act. Stun is checked before duration expiry. Identical status types refresh the strongest value/duration rather than stacking without limit. Enemy numeric guard remains the existing consumable damage absorption.

## Lifecycle, rewards and saves

Dead actors are removed from the timeline immediately; enemy gameplay records remain for XP/loot accounting. Summons are initialized once, use canonical IDs/static sprites, respect five living enemies, and grant no XP/loot. Necromancer phase flags and soul harvest remain in the existing resolver.

Victory, defeat and escape are latched; the hook delivers each encounter outcome once. App grants established XP/loot on victory, handles level-up or the next floor, and returns to the existing first-person exploration. Escape clears the encounter without granting victory rewards. A stopped/finished runtime cannot later execute delayed enemy actions.

Combat is not saved mid-encounter. Saving is disabled while fighting or in its Options overlay. No clock, cast, recovery or guard expiry values enter normal saves; the existing save key/schema and legacy transform migration remain.

## Tests and follow-up

`tests/combatRuntime.test.ts` covers independent readiness, duplicate-click rejection, pause, 20% slowdown, consistent casts, interrupts/noninterruptible actions, boss resistance, timed Defend, death/outcome latching, summons, boss phase continuity, resource validation, newly stunned READY heroes, frame-size equivalence and invalid cast bounds. Existing combat, enemy AI, dungeon, exploration, room events, save and asset tests remain.

Next wave should measure pacing and interrupt windows on actual touch hardware, then author timing overrides for more skills/enemies. Spatial combat, enemy navigation, projectile physics, party AI and large skill rebalance remain future work.
