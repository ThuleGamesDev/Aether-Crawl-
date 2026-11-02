# FPS-R5B Class Buildcraft II

R5B completes the eight stable class IDs with rankable kits for Hunter, Asclepiad, Pankratiast, and Shadebinder. Primary and secondary actions stay on their existing controls; each class has four separate numbered skill slots. The runtime remains the owner of combat state, while ability data, progression, passives, and UI stay in their existing R5A systems.

## New class skill catalog

Values are Rank 1 registry values. Base damage is before player stats, equipment, derived modifiers, critical hits, status effects, and rank scaling. W/A/R are windup, active, and recovery seconds. Skill mana and cooldown are further adjusted by the existing R4 derived-stat multipliers.

| Class / slot | Skill | Rank 1 values | Effect |
| --- | --- | --- | --- |
| Hunter 1 | Javelin Volley | 19 base damage, 12 MP, 5.5s CD, 0.38/0.08/0.34s W/A/R, 16m range | Three javelins fan across 11.5° total; each deals 62% of the calculated projectile damage. Uses the R3A spear throw pose during the cast. |
| Hunter 2 | Piercing Hunt | 30 base damage, 7 MP, 3.2s CD, 0.28/0.08/0.30s W/A/R, 22m range | One arrow pierces its first target and up to two additional targets. |
| Hunter 3 | Hunter’s Snare | 8 base damage, 10 MP, 6.5s CD, 0.26/0.12/0.28s W/A/R, 10m aim, 1.45m radius | Slows affected enemies by 28% for 3s. The point-targeted area follows the visible enemy nearest the aim line, otherwise it stops at the wall or skill range. |
| Hunter 4 | Moonlit Pursuit | 8 MP, 9.0s CD, 0.12/0.08/0.18s W/A/R | Move up to 0.8m through collision-safe space; gain 18% movement/action speed for 3s and 15% projectile damage for 4s. |
| Asclepiad 1 | Asclepius’ Grace | 10 MP, 8.0s CD, 0.40/0.08/0.18s W/A/R | Restore up to 30% of maximum health, clamped to missing health. |
| Asclepiad 2 | Serpent’s Renewal | 12 MP, 14.0s CD, 0.24/0.08/0.20s W/A/R | Restore 5 health at one-second intervals for 5s. Refreshes instead of stacking. |
| Asclepiad 3 | Purifying Rite | 8 MP, 9.0s CD, 0.20/0.08/0.18s W/A/R | Remove one poison, burn, bleed, slow, or weakness status. It does not remove stagger or unrelated mechanics. |
| Asclepiad 4 | Sacred Aegis | 10 MP, 11.0s CD, 0.18/0.08/0.18s W/A/R | Reduce incoming damage by 35% for 4s. |
| Pankratiast 1 | Olympian Kick | 32 base damage, 8 MP, 4.5s CD, 0.34/0.16/0.30s W/A/R, 2.4m reach | Advance up to 0.55m, then kick a normal foe back up to 0.65m and stagger for 0.3s. Bosses cannot be displaced. |
| Pankratiast 2 | Twin Palm | 24 base damage, 6 MP, 3.6s CD, 0.12/0.28/0.24s W/A/R, 1.7m reach | Two timed hit windows, each dealing 56% damage. One cast builds at most one Flow State stack. |
| Pankratiast 3 | Grappler’s Counter | 6 MP, 7.0s CD, 0.08/0.08/0.18s W/A/R | Must activate during dodge invulnerability or with an enemy windup within 3.2m. Grants 30% guard for 2s and +28% to one melee counter for 3s; interrupts nearby windups briefly. |
| Pankratiast 4 | Champion’s Rush | 8 MP, 10.0s CD, 0.12/0.08/0.18s W/A/R | Gain 20% movement/action speed for 4s. |
| Shadebinder 1 | Underworld Eruption | 28 base damage, 14 MP, 5.5s CD, 0.42/0.18/0.35s W/A/R, 8m aim, 2m radius | Chthonic area burst using the existing Underworld VFX. |
| Shadebinder 2 | Shade Mark | 11 base damage, 8 MP, 4.5s CD, 0.20/0.08/0.22s W/A/R, 18m range | Curse one foe for 5s; it takes 20% more damage. Bosses receive half duration and magnitude. |
| Shadebinder 3 | Death Burst | 25 base damage, 13 MP, 6.5s CD, 0.38/0.16/0.30s W/A/R, 8m aim, 2.1m radius | Cursed targets take a further 35% damage from this blast. |
| Shadebinder 4 | Soul Ward | 10 MP, 10.0s CD, 0.14/0.08/0.18s W/A/R | Reduce incoming damage by 28% for 3s. |

The existing signature controls remain: Artemis’ Arrow / Boar-Spear Arrow; Asclepiad Staff Strike / Temple Light; Pankration Strike / Pankration Flurry; Styx Shard / Hades’ Grasp. The old starter skill IDs remain the level-1 slot-1 skills, so their saved ranks are retained.

## Passives and build directions

| Class | Passive | Rule | Build directions |
| --- | --- | --- | --- |
| Hunter | Marked Prey | A direct projectile hit on the currently aimed target builds up to 3 focus stacks for 4s. The next projectile action aimed at that same target gains 6% damage per stack and consumes the focus. | Piercing Crit; Trapper; Mobile Hunter |
| Asclepiad | Measured Remedy | Actual healing that crosses from below 50% to at least 50% health grants 22% guard for 2.25s, at most once per 10s. | Sustain Fighter; Protective Priest; Sacred Damage |
| Pankratiast | Flow State | A successful physical melee action grants one stack, up to five. Each stack adds 3% physical damage for 1.6s. Timed hit windows and additional targets do not add more stacks for the same action. | Fast Combo; Counter Fighter; Mobility |
| Shadebinder | Soul Tribute | Every 3 newly rewarded kills grant one charge for 4s. The next spell gains 20% damage. At most one charge is held and the passive has a 10s cooldown. | Curse Burst; Drain Sustain; Soul Ward |

Summon Shade is deferred. The project has no bounded minion lifetime, targeting, or ownership model; this wave uses Death Burst and Soul Ward as the complete single-player substitute. No pet pathfinding or unbounded spawning was introduced.

## Rank and combat formulas

For skill rank `r` in the existing 1–5 progression, let `s = r - 1`:

- Ability base damage and healing scale by `1 + 0.15s`; healing remains capped at 100% of maximum health.
- Range, area radius, and dash distance scale by `1 + 0.06s`.
- Status magnitude scales by `1 + 0.12s`; status duration scales by `1 + 0.05s`.
- Skill cost and cooldown do not change with rank. R4 item-derived mana-cost, cooldown, attack/cast speed, projectile damage/speed, affixes, and unique triggers remain in the shared pipelines.
- Haste increases movement and action speed within explicit caps; it does not reduce cooldowns. Precision adds capped damage to projectile actions.
- CURSE increases enemy damage taken by up to 50%. Death Burst applies its separate 1.35 multiplier to cursed targets, then the shared curse vulnerability applies. Bosses receive half curse magnitude and duration; their existing stagger resistance and floor/guardian transitions remain intact.
- Projectile fans are capped at 7 projectiles per action and 64 live projectiles. Piercing is capped at 3 additional targets; Hunter’s Piercing Hunt uses 2. Each projectile remembers already-hit targets so it cannot repeatedly collide with one enemy.
- REGEN uses one-second ticks and refreshes rather than stacking. Health from Grace, regeneration, hit, and kill effects is clamped to derived maximum health. Measured Remedy checks actual restored health, preventing full-health and repeated-heal triggers.
- Purifying Rite removes one status from its explicit allowlist. Grappler’s Counter checks the dodge window or a nearby attack windup; a failed timing attempt spends the shown cost/cooldown but applies no counter effect.

Projectiles still pass through the R4 `applyPlayerOnHitEffects` pipeline. Affix status procs and R4 unique triggers remain bounded by their existing cooldowns. Shadebinder spells still trigger Stygian Seal; projectile impacts still interact with Artemis’ Mark; self-heals still use Laurel of Asclepius; and life-on-hit/kill and Hades’ Grasp now share the capped healing helper.

## Save and UI behavior

The save key and version-4 envelope are unchanged. The new passive state and realtime statuses are optional player fields within the existing save, with identity and timer bounds added to the validator. A valid old save receives safe class-passive defaults on runtime normalization; new skill progression retains one level-1 starter and the existing rank. Equipment, affixes, unique effect state, guardian state, and derived-stat caps stay on the R4 save path.

Class selection now previews each kit’s identity, passive, four skills, and archetype paths. Desktop slots show rank, effective mana cost, effective cooldown, and effect text. Touch uses the same four skills and tooltip data. Hunter’s volley switches to the local R3A spear throw pose during the cast and returns to the equipped bow when the action ends; other actions continue using their equipped weapon pose.

## Verification and remaining limits

`tests/classSkillsR5B.test.ts` covers all eight loadouts, stable starter migration, rank/cost rules, projectile pierce bounds, reduced boss curse, curse refresh and damage interaction, cleanse limits, regeneration ticks, haste, all four passives, aimed snare, counter timing/interruption, heal caps, and save/load of new passive/status fields. `tests/characterRigs.test.ts` covers the new javelin throw pose. The existing R4 and R5A item, unique, save, input, and combat suites remain in the full regression run.

The full regression run passes: `npm run typecheck`, `npm test` (249 tests across 26 files), `npm run build`, and `git diff --check`. The production build reports the existing Vite chunk-size advisory for two JavaScript chunks above 500 kB; the build completes successfully. Browser/WebGL smoke was not run because the configured Playwright Chromium executable is unavailable in this environment.

No summon system or simulated balance run is part of this wave. The numerical values are technical starting points; gameplay and feel still need hands-on validation.

## Next wave

FPS-R6 is the Floors 1–5 action-RPG vertical slice and quality pass: validate movement, enemy telegraphs, loot, class progression, room events, save/continue, and all five floor Guardians as one coherent run before expanding endgame content.
