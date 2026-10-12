# Combat System — 2.5B

Combat uses one simulated clock and independent actor timelines. The player controls the active hero and the optional inactive-hero Auto Basic toggle, which defaults OFF. No automatic skills are present. Enemy Intents, existing damage/equipment rules, static assets, boss phases, XP and loot are retained. Enemy sprites remain presentation targets rather than navigable world actors.

## Ownership and flow

- `services/combatRuntime.ts`: encounter clock, readiness, recovery, casts, guard expiry, actor lifecycle and terminal outcome latch.
- `services/combatActions.ts`: atomic player action validation/resolution using the established arithmetic.
- `services/combat.ts`: damage, armor/shields, status refresh and own-cycle status arithmetic.
- `services/enemyAI.ts`: advertised intent resolution, weighted next intent, ability-cycle cooldowns, flags, boss phase and summon rules.
- `data/combatTiming.ts` and `data/enemyAbilities.ts`: timing policy and authored ability values.
- `hooks/useCombatRuntime.ts`: a single RAF, runtime ref, 10 Hz UI snapshot and one-shot outcome delivery.
- `App.tsx`: encounter start, feedback, rewards and return to exploration. No turn handoffs, enemy sleeps or combat timeouts remain.

Previous flow was party index 0 → 1 → 2 → all enemies → party index 0, with fixed 420/350/330 ms wait chains. Current flow is each living actor charging independently. An actor becoming READY never blocks other actors. A hero stays READY until the player acts, a buffered skill executes, or explicitly enabled inactive-hero Auto Basic acts. An enemy begins its announced cast, resolves it once, picks its next intent and recovers.

## Clock and readiness

The clock stores `elapsedMs`, `timeScale` and `paused`. Delta time is applied in bounded 50 ms substeps; timers carry transition overflow so timing does not depend on render frequency. The browser bridge caps long frame deltas to 100 ms, drops hidden-tab catch-up and suspends on full options/map overlays. Timers do not advance while those overlays are open.

Each runtime record contains actor ID/side, remaining recovery, recovery duration, readiness, guard expiry and optional cast. It stores no callbacks and is separate from Character/Enemy gameplay data. Initial party readiness is staggered from 450 ms; enemies start from 1400 ms. Summons receive their own initial timer and never act in the resolving summoner's event.

Base hero recovery: Barbarian/Paladin/Cleric 1000 ms, Rogue 800 ms, Ranger 900 ms, Monk 850 ms, Sorcerer/Necromancer 1100 ms. Attack uses 90%, Defend 105%, potion 95%, Flee 110%. Skills use a small policy for normal/heavy/AoE recovery or an optional `Skill.recoveryMs` override. DEX still affects existing damage/crit/defense arithmetic, not timeline speed.

## Enemy Intents and casts

The ability registry contains cast and recovery milliseconds. `EnemyIntent` exposes these values and interrupt resistance. Every enemy shows its next action throughout recovery. At cast start the runtime freezes that intent; phase changes cannot replace it midway. The resolver executes that exact ability ID and only then plans the next intent.

Examples: Bite 400 ms, Venom Fang 700 ms, Dark Chant 1500 ms, Crushing Blow 2000 ms, Mass Raise 2500 ms. Cast values are finite and bounded to five seconds. Normal attacks have shorter preparation; heavy, summon and support actions have visible counterplay windows.

Existing PREPARE → follow-up sequences remain: Orc Wind Up → Crushing Blow → Recover; slime instability → one-time split; Necromancer Phase II ritual preparation → Mass Raise. Ability cooldowns count own resolved actions, not global turns or wall-clock seconds.

## Tactical controls

- Desktop: Space toggles pause; 1–4 or F1–F4 selects a living party member. Clicking a living party HUD card selects it, including during recovery.
- Touch: Attack, four quick skills, Guard, Potion, Target, Party cycle and Pause/Resume share the desktop quickbar; More holds All Skills, Bind Potion, Auto and Flee. Buttons are at least 44–48 px; no hover is needed.
- All Skills, potion binding and skill detail panels reduce simulated speed to 20%; direct party/target switching does not slow combat. Cancel/selection returns to normal speed. Slowdown and pause are independent.
- Pause freezes enemy casts, hero recovery and guard duration. Menus remain usable. A READY hero may execute one immediate action while paused; its recovery waits until resume. One manual skill buffer is available; no automatic party skill command system is present.
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

## Combat 2.5B — direct party control

The selected living hero stays active through readiness and recovery. Selection is independent of READY; no automatic jump to another hero follows an action. Defeated heroes cannot be selected. A recovering active hero receives a small `Recovering · …s` notice when an immediate action is attempted.

| Input | Combat action |
| --- | --- |
| LMB on the viewport | Basic attack with the active READY hero; clicking an enemy also selects that target |
| 1–4 / F1–F4 | Select the corresponding living party member, including during recovery |
| Q / E / R / F | Use the first four learned skills of the active hero |
| V | Timed Guard / Defend |
| G | Use the bound quick potion; default is an HP potion, otherwise the first usable potion |
| Tab / Shift+Tab | Cycle living targets forward / backward |
| Space | Tactical pause / resume |
| B | Toggle inactive-hero Auto Basic; defaults OFF at each encounter |
| Esc / right-click on the viewport | Cancel the active hero's buffered skill or close the tactical panel; Esc with nothing to cancel opens Options |

LMB acts only on the canvas, never when a HUD button is clicked. Pointer hit testing uses the displayed sprite bounds instead of dividing the screen into invisible target columns. Touch taps on a sprite select only; the large Attack button executes the active hero's attack. Empty touch taps do not replace the target.

### Quick skills and consumables

Quick slots follow the first four entries in each hero's existing learned skill list. Additional skills remain available under More → All Skills. No new skill data, rebalance, player cast or refund mechanic is introduced: current player skills resolve immediately. The cost, recovery, instant execution and actual resolver effect appear on desktop hover and in the touch detail panel. Soul Pact displays its custom HP-to-MP exchange; Ally heals identify the lowest-health target. This does not change existing group_heal/focus behavior despite their older authored descriptions. HP-cost skills display their HP cost rather than a misleading MP label. Holding a touch skill for 450 ms opens its details without using it; short tap uses it. The detail panel also offers an explicit Use button.

More → Bind Potion selects the consumable assigned to G / Potion. Binding does not consume an item or readiness. An explicitly bound exhausted potion leaves the slot empty instead of silently switching between HP and MP. Quick bindings are encounter-local; no save schema changes.

### Conservative automation and one-slot skill buffer

The actor runtime receives the active hero ID, current target ID and an encounter-local Auto Basic toggle. When ON, only inactive READY heroes basic-attack the selected living target. It never spends MP, consumes items or selects skills. There is no fallback to another target when the selected ID is invalid, no active-hero auto-attack, and no automatic action while paused. Auto Basic respects the same status, recovery and outcome rules as manual attacks. More's indicator shows whether it is enabled; B offers a direct toggle.

A quick skill may buffer only during the final 250 ms of the hero's simulated recovery. There is at most one command per actor; extra attempts cannot replace or stack it. LMB, Guard, potions and Flee do not buffer. MP/HP are validated at submission and again when READY, and are consumed only by successful execution. The chosen offensive target is retained: death of that target cancels the buffered skill instead of redirecting it. Stun, actor death, encounter completion, explicit cancel and switching away from that active hero clear its buffer. Pause freezes it; slowdown scales it with the same clock. The party gauge says BUFFERED. Accepting a buffered command closes tactical selection so normal speed can resume.

### Presentation and ownership

`services/combatInput.ts` owns the pure key/touch mapper, living character/target cycling and quick-command selection. `hooks/useCombatControls.ts` routes all combat UI commands through authoritative runtime checks and owns menu, quick binding, notice and auto state. `components/CombatHud.tsx` owns party/timeline/target presentation; `Controls.tsx` owns the shared responsive quickbar and details. `MobileControls.tsx` now owns exploration controls only. The old READY-only Party picker is removed. App coordinates the encounter and rewards rather than implementing these UI handlers.

`services/combatFeedback.ts` defines structured events. Action resolvers report actual HP damage/healing, absorbed enemy guard, player mitigation, criticals and status ticks; the runtime reports interruption and phase transitions once. `hooks/useCombatFeedback.ts` keeps at most 24 floating events for 1.1 wall-clock seconds and plays at most one sound per category in each batch. The canvas distinguishes damage, crit, healing, MP, block, poison/burn, stun, buffs, guard, interrupt and phase text with compact numbers/labels. Existing VFX assets remain; no image generation or new audio pipeline. Player/enemy hits, criticals, block, heal, interrupt and phase have distinct procedural audio cues. Feedback can finish while tactically paused and never advances or blocks the combat clock. No hitstop is added.

The combat dock is centered and capped at 760 px on ultrawide displays. Its party cards expose HP, MP, readiness/recovery, buffered/Guard state, important status icons and the active selection. The two main button rows contain Attack + four skills, then Guard, Potion, Target, Party cycle and Pause. More holds the less frequent options. Controls are 44–48 px tall and the landscape layout keeps them within the viewport. Enemy intent badges retain icon and text; HEAVY, SUMMON and support categories are distinct, and a heavy/summon cast under one second gains a mild outline pulse that stops during pause.

### Spatial preparation

An optional runtime `rangeBand` can hold `melee`, `near` or `far` for future presentation experiments. It is currently unset and unused. Later spatial work must define distance thresholds and movement ownership before applying reach/range rules. No dungeon coordinate, movement, damage, navigation, projectile or aggro behavior depends on these bands in 2.5B.
