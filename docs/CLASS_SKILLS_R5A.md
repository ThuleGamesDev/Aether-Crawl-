# FPS-R5A Class Skills and Buildcraft

R5A adds four active skill slots and one bounded class passive for Myrmidon, Hoplite, Oracle, and Trickster. The four existing class IDs remain stable: `BARBARIAN`, `PALADIN`, `SORCERER`, and `ROGUE`. Primary and secondary actions remain available alongside the numbered skill slots. The other four classes retain their existing R2B loadouts.

The simulation remains in `FPSGameRuntime`; skill data lives in `AbilityRegistry` and `classSkillKits`, progression rules live in `SkillProgression`, and React renders the level-up and skill-detail UI.

## Kits

The values below are the Rank 1 registry values. Damage is the ability's base damage before player stats, equipment, critical hits, status modifiers, or rank scaling. `CD` is cooldown; `W/A/R` are windup, active, and recovery time.

| Class / slot | Skill | Rank 1 values | Effect |
| --- | --- | --- | --- |
| Myrmidon 1 | Ares’ Quake | 24 damage, 0 MP, 5.0s CD, 0.42/0.20/0.38s W/A/R, 2.2m self radius | Staggers for 0.7s |
| Myrmidon 2 | Bronze Cyclone | 15 damage, 0 MP, 4.8s CD, 0.18/0.36/0.30s W/A/R, 1.9m reach | Three timed, full-circle hits at 0.38 damage multiplier each |
| Myrmidon 3 | Blood Oath | 8 MP, 12.0s CD, 0.16/0.08/0.20s W/A/R | For 6s, +25% physical damage and +25% incoming damage |
| Myrmidon 4 | Heroic Execution | 28 damage, 0 MP, 6.5s CD, 0.30/0.16/0.35s W/A/R, 2.4m reach | Deals 1.6× damage when target health is at or below 35% |
| Hoplite 1 | Phalanx Stand | 12 MP, 7.0s CD, 0.40/0.20/0.35s W/A/R | Self guard for 3.5s, magnitude 0.48 |
| Hoplite 2 | Dory Impale | 23 damage, 5 MP, 3.2s CD, 0.22/0.12/0.22s W/A/R, 3.2m narrow reach | Line-of-sight spear thrust; 0.22s stagger |
| Hoplite 3 | Bronze Reprisal | 6 MP, 8.0s CD, 0.12/0.08/0.18s W/A/R | Guard for 2.5s and empower one melee counter by up to 24% for 3s |
| Hoplite 4 | Aspis Charge | 25 damage, 7 MP, 7.0s CD, 0.12/0.12/0.30s W/A/R | Collision-safe 1.15m advance, then bash and stagger for 0.4s |
| Oracle 1 | Promethean Flame | 32 damage, 18 MP, 6.0s CD, 0.36/0.20/0.42s W/A/R, 9m aim / 2.1m radius | Burns for 4s, magnitude 3 |
| Oracle 2 | Storm Invocation | 22 damage, 16 MP, 7.5s CD, 0.34/0.12/0.32s W/A/R, 9m aim / 0.72m radius | Lightning chains to at most two additional foes within 3.2m; each jump starts at 45% damage |
| Oracle 3 | Prophetic Veil | 10 MP, 10.0s CD, 0.12/0.08/0.20s W/A/R | Collision-safe 1.1m step and 2.5s guard, magnitude 0.22 |
| Oracle 4 | Omenfall | 26 damage, 18 MP, 8.0s CD, 0.32/0.12/0.34s W/A/R, 10m aim / 1.35m radius | Precise arcane impact; 0.32s stagger |
| Trickster 1 | Kopis Fan | 16 damage, 10 MP, 4.5s CD, 0.32/0.08/0.30s W/A/R, 12m range | Crosshair-aimed knife projectile |
| Trickster 2 | Kopis Flurry | 18 damage, 6 MP, 3.8s CD, 0.12/0.36/0.22s W/A/R, 1.75m reach | Three timed cuts at 0.35 damage multiplier each |
| Trickster 3 | Venomous Cut | 12 damage, 4 MP, 3.0s CD, 0.08/0.12/0.16s W/A/R, 1.85m reach | Applies poison for 3s, magnitude 2, with 1s tick interval |
| Trickster 4 | Shadow Lunge | 22 damage, 8 MP, 5.5s CD, 0.12/0.12/0.24s W/A/R | Collision-safe 1.35m lunge, 1.3m strike reach; 0.24s stagger |

Hoplite retains `paladin_smite` / Aspis Bash as its RMB action. Aspis Charge fills the fourth numbered slot while preserving the original attack controls and stable IDs.

## Class passives and archetypes

| Class | Passive rule | Build directions |
| --- | --- | --- |
| Myrmidon — War Momentum | Each successful physical melee action adds one stack, up to five. Each stack gives +4% physical damage for 3s. A multi-hit action adds one stack, not one per hit or target. | Heavy Bruiser; Combo Berserker; Blood Warrior |
| Hoplite — Unbroken Line | A successful block opens one +18% melee counter for 3s. It can activate at most once every 4s and is consumed by a confirmed melee hit. | Defensive Counter; Reach Spear; Guard-Heavy Tank |
| Oracle — Omen Weaving | A cast whose school differs from the previous school gets +18% damage. Repeating a school does not add or refresh the bonus. Schools are Fire, Lightning, and Arcane. | Fire Explosion; Chain Lightning; Burst Cast / Defense |
| Trickster — Opportunist | A successful dodge primes one hit for +22% damage for 2.5s. A melee or targeted projectile can also qualify against a staggered or flanked enemy. A use starts a 2s cooldown. | Poison; Mobility Crit; Fast Combo |

## Progression and rank scaling

- Each level gained by an R5A class grants one skill point. A new level-up pauses the simulation and offers up to three deterministic choices. The player can defer; an unspent point remains available from the skill-point control.
- Skills unlock at levels 1, 2, 4, and 6. Each skill can be learned and raised to Rank 5. The level-up preview shows the current and next rank, effective mana cost, and effective cooldown.
- For rank step `s = rank - 1`: base damage scales by `1 + 0.15s`; range, radius, and dash distance by `1 + 0.06s`; status magnitude by `1 + 0.12s`; status duration by `1 + 0.05s`.
- Healing amount scales by 15% per step and is capped at 100% of maximum health. Guard magnitude is capped at 0.8 and duration at 12s. Finisher multiplier adds 0.1 per step, capped at 2.2. Chain damage multiplier adds 0.04 per step, capped at 0.7.
- Mana cost and cooldown do not change with skill rank. R4A derived stats still adjust actual mana cost, cooldown, cast/attack speed, and damage. The HUD and hover/touch detail use those effective values.
- Values are bounded before application. Multi-hit counts, chain jumps, status duration, magnitude, and repeated-hit windows have explicit caps; passive bonuses do not recursively trigger attacks or item procs.

## Save and migration

R5A keeps save key `maze_of_the_minotaur_fps_r2a_save_v2` and save version 4. It adds optional player fields for skill points, progression version, and class-passive state, plus bounded active-hit and passive-resolution data on an in-progress combat action. Existing version-4 saves remain readable. A version-4 character without the R5A progression marker receives one retained skill point for each level above 1, keeps a valid starter skill, and receives its class passive state. Invalid, duplicate, over-rank, wrong-class, or not-yet-unlocked skills are filtered during runtime normalization.

The R5A save validator checks class/slot membership, rank bounds, unlock level, passive identity and timer bounds, and active-action hit bounds. The inventory grid, uniques, stable item IDs, guardian state, and derived-stat validation remain owned by the R4B/R4A save path.

## Controls and presentation

Keyboard slots 1–4 and the four mobile skill buttons trigger learned skills. Locked or unlearned slots stay disabled and show their actual unlock level. Hover, keyboard focus, and touch selection show effect, rank, current/next rank preview, effective MP, and cooldown. Level-up choices use the same pause and overlay handoff rules as the other menus. Runtime effects reuse the existing VFX and sound event pipeline, with distinct sweep, thrust, shield, lightning, poison, and dash feedback.

## Verification and known limits

`tests/classSkillsR5A.test.ts` covers stable IDs and four slots, rank bounds and scaling, unlocks, point migration, passive isolation and caps, block/dodge windows, finisher/range/line of sight, chain caps and walls, timed multi-hit save restore, real poison/dash behavior, level-up pause/defer/save/load, and legacy R4B progression migration. The existing test suite retains the R4A/R4B item, save, input, and floor regressions.

No browser/WebGL smoke was performed: Chromium is not installed in the workspace. No large gameplay or balance simulation was run; the numerical values are technical starting points and still need the user's in-game feel review.

## R5B follow-up

R5B completes the remaining four kits through the same `CLASS_SKILL_KITS`, stable ability registry, and `ClassPassiveState` systems. The shared rank/choice UI, save validation, derived modifiers, timed-hit persistence, and collision helpers are reused. The version-4 save namespace remains unchanged. See [R5B class skill documentation](CLASS_SKILLS_R5B.md) for the combined eight-class catalog and validation status.
