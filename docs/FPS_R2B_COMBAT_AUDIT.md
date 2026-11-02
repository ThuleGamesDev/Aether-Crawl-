# FPS-R2B combat audit and implementation

## Pre-R2B audit

The active R2A route already had a continuous `FPSGameRuntime`, fixed-step `GameLoop`, mouse/touch `InputSystem`, collision-safe solo controller, Three.js/WebGL 2 scene, direct player actions, world projectiles, world-space enemy billboards, and floor Guardian persistence. Melee and area damage used world-space range and line-of-sight checks; projectiles were sub-stepped against the dungeon grid. Those were retained as the reliable action foundation.

The combat gaps were concentrated in the rules around those foundations:

- `EnemyBrain` mostly approached and used a small, repeated attack pattern. Role-specific retreat and reposition were incomplete, and ranged enemies needed a more explicit line-of-sight gate.
- `InputSystem` already read skill keys 1–4, but the runtime exposed one functional skill slot.
- Status ideas from the old turn-based combat were not real-time effects in the solo FPS path. Shield block, damage-over-time ticks, interruption, weapon-specific attack shapes, and phase-two Guardian behavior were missing or incomplete.
- Enemy sprites already had depth-tested billboard rendering and a limited state bob, but windup, recoil, stagger, and death poses were not distinguished enough for action combat.
- R2A used local Greek pixel art and a bounded VFX pool. Combat-specific directional VFX and sound cues were limited.

Legacy initiative combat remains isolated and is not used by `App.tsx` or the active FPS runtime. No second rendering engine or behavior-tree dependency is introduced.

## Runtime ownership

`FPSGameRuntime` remains the single owner of mutable game state and the fixed-step simulation sequence. React continues to render menus, HUD, inventory, and map snapshots. `SceneRenderer` renders the world outside React's update cycle.

| Concern | Runtime module | R2B responsibility |
| --- | --- | --- |
| Input and movement | `engine/InputSystem.ts`, `player/PlayerController.ts` | One input frame for desktop and touch; collision-safe movement, dodge cooldown/i-frames, shield guard, status slow |
| Player actions | `combat/AbilityRegistry.ts`, `player/PlayerCombat.ts` | Stable ability IDs and data-driven windup, active, recovery, cooldown, mana, weapon shape, and effects; four prepared skill slots |
| Hit resolution | `combat/DamageSystem.ts`, `combat/ProjectileSystem.ts` | Melee arc and range, wall line-of-sight, armor/Guard/Weakness, pooled world projectiles, one-hit consumption, status delivery |
| Enemy decisions | `enemies/EnemyBrain.ts`, `data/enemyAttacks.ts` | Small state machine, timed attacks, cooldowns, distance bands, role behavior, cached grid path steps, telegraph data |
| State and settlement | `engine/FPSGameRuntime.ts`, `player/PlayerProgression.ts` | Status ticking, hit reactions, Warden phase transition, once-only XP/reward, Guardian descent unlock |
| Presentation | `engine/SceneRenderer.ts`, `presentation/*`, `services/audioService.ts` | Floor telegraphs, pixel effect families, weapon pose, state animation, combat audio cues |

There is no initiative, turn timeline, detached combat screen, or combat-specific React state machine. The fixed gameplay delta remains capped at 50 ms; status and enemy timers are simulation-time values and do not catch up while the tab is hidden.

## Player weapons and actions

The eight class IDs and existing starter equipment rules stay save-stable. The Myrmidon uses the broad Labrys swing and heavy windup; a successful dodge through an incoming hit primes a short 30% melee counter bonus. The Hoplite's Dory action has longer reach and a narrow thrust arc; the Aspis can block while RMB is held and its secondary bash staggers. The Oracle uses direct Spark projectiles, a held charged bolt, and a mana-costing Fireburst. Existing class actions remain available for Trickster, Hunter, Asclepiad, Pankratiast, and Shadebinder. The other three skill slots are explicitly empty and do not produce broken actions.

Actions are keyed by stable registry IDs. They carry timing, range, arc/radius, projectile, mana, cooldown, and status metadata. Tooltips read these definitions. Melee and projectile impacts resolve against the same collision grid as movement; a solid wall or closed door blocks the hit.

## Enemy roles and patterns

`WorldEnemy` stores its world position, stable definition/attack IDs, role, attack state, phase, real-time statuses, and cached navigation data. The AI retains a short fixed state machine: idle/alert, chase, retreat/reposition, windup, active, recovery, hurt/stagger, and death. Path steps refresh on a short interval rather than every frame. A failed retreat path now falls back to direct wall-sliding movement, so a nearby Skirmisher does not step toward its cell center when the target cell is blocked.

| Family | Role and teaching pattern |
| --- | --- |
| Cretan Cave Rat | Fast bite and coiled leap with short recovery |
| Bronze Revenant | Guard, Xiphos slash, prepared shield bash |
| Arachne's Brood | Poison fang, slow web projectile, side lunge |
| Bull-Cult Enforcer | Broad cleave, long-windup charge, weakening roar |
| Chthonic Acolyte | Underworld bolt, curse, limited ward; prefers space |
| Tomb Plunderer | Quick Kopis, Javelin at range, bounded retreat |

Ranged attacks require line of sight at selection and execution. Strong actions use an authored windup, shared cooldown, and deterministic pattern rotation to avoid random instant hits and repeated high-damage spam. A dead enemy is filtered from decisions and projectiles.

## Guardian encounters

The five R2A Guardian IDs are retained. Their attack sets have distinct windups, shapes, ranges, recoveries, and cooldowns: the Gatekeeper guards and sweeps; the Priestess throws venom and uses a cone; the Mason slams, throws a boulder, and sends a shockwave; the Lamia lunges, drains at range, and retreats; the Warden bolts, raises a ritual guard, then uses delayed sigils and a curse in phase II.

The Threadbound Warden enters phase II at or below half health. The transition is one-time, logged and presented with a boss VFX/audio cue, does not heal, cancels the current telegraph, and preserves phase data on the existing R2A save. The same once-only reward flag continues to guard XP, loot, and the descent state. The exit remains an explicit E interaction after the defeat.

## Status, animation, and feedback

Poison and Burn deal one bounded damage tick per second and expire on simulation time. Slow scales movement, Weakness lowers outgoing damage, Guard reduces incoming damage, Stagger interrupts an enemy windup, and the Myrmidon's short Counter bonus is consumed by the next melee action. Reapplying an effect refreshes duration/magnitude instead of stacking an unbounded list. Boss stagger is shortened.

`SpriteAnimator` now expresses idle breathing, locomotion gait, attack anticipation/follow-through, hit recoil, stagger, status tint, and a death collapse from the existing local sprites. `WeaponPresenter` distinguishes thrust, bash, swing, cast, and held shield poses. `VFXSystem` reuses a bounded particle pool for slash, thrust, shield, blood, poison, web, fire, stone, chthonic, and boss-death effects; `AssetManager` caches the pixel textures. Existing oscillator audio is reused for blade, spear, shield, projectile, poison, boss, dodge, pickup, heal, and level cues.

## Save compatibility

The R2A namespace `maze_of_the_minotaur_fps_r2a_save_v2` and version 2 remain unchanged. R2B adds optional combat fields to the existing enemy/status data and does not reinterpret a three-hero party save. The R2A validator accepts and checks optional AI phase, role, path cache, telegraph position, and status tick data; old R2A fields remain valid. The separate R1 namespace is still validated and migrated only by the existing explicit in-memory migration. Invalid save data is rejected without being overwritten.

## Validation and limits

Local validation on the R2B branch: `npm run typecheck` passed; `npm test` passed (18 files, 166 tests); `npm run build` passed. Vite reports the existing Three.js bundle above its 500 kB advisory limit. The R2B tests cover Dory arc/range, timed Poison/Burn, one-hit projectile resolution and wall occlusion, shield mitigation, perfect-dodge counter, dodge collision/cooldown, ranged line of sight, retreat/player collision, pilot attack data, windup interruption, dead-enemy behavior, bounded AI simulation, and one-time Warden phase transition across save/load. R1/R2A tests continue to cover save migration, floor reward-once, descent, and class/loadout continuity.

The browser smoke could not be completed here: `npm run test:run` stopped because Playwright's Chromium headless executable is not installed, and the available remote browser rejected the workspace's local Vite URL with `ERR_CONNECTION_REFUSED`. No rendered gameplay or mobile touch result is claimed.

The enemy figures remain billboard sprites rather than skeletal 3D actors. Charge movement is a bounded, collision-checked dash, not a full rigid-body rush. Boss attack variety is data-driven but not a reusable multi-stage boss graph. Static local art and procedural transforms cover this wave; a complete segmented sprite rig and authored frame library remain FPS-R3. Browser/WebGL performance still requires an actual browser/device pass when the environment supplies a usable Chromium/WebGL 2 runtime.
