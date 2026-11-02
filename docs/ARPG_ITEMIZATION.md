# FPS-R4A — ARPG Itemization Core

## Data and migration audit

R4A keeps the active solo FPS runtime and the four existing equipment slots (`weapon`, `armor`, `offhand`, `accessory`). `ItemInstance` already carried an `instanceId`, item level, rarity, and affix array, but no base or affix registry existed. Equipment armor was cached directly into `player.stats.armor`, which made that cache unsafe to reuse as an input to later equipment calculations. Potion type was inferred from display text, and normal enemy rewards always produced a guaranteed item.

The new pipeline treats base definitions and affix definitions as immutable registries. Each generated instance stores a stable `baseId`, `instanceId`, and affix IDs with their rolled values. Item generation happens at a reward or room-choice event and is deterministic from the floor seed plus the stable event ID; rendering, loading, and equipping never roll again. Guardian reward IDs and their guaranteed reward mapping are retained.

The four-slot model stays in place for this wave. It already supports weapon, armor, shield, and accessory build choices. Changing slot identity together with the R4A stat migration would add another inventory mapping step before the R4B inventory and character-stats views need it. Two-handed weapons return any equipped shield to the bag; shields cannot be equipped while a two-handed weapon is active. Equipped items always have quantity one.

The existing `maze_of_the_minotaur_fps_r2a_save_v2` key is read as version 2 and migrated in memory to save version 3. Items keep their IDs, affixes, rarity, and unique-effect fields; missing base IDs are mapped from stable legacy item IDs and item type/weapon data. The old armor cache is converted to base armor by subtracting armor and shield values already present in equipment, then all derived caches are recomputed once. Invalid or conflicting saves are left in place. The original key is replaced only after a validated version-3 save succeeds. R1 saves continue through the existing geometry/Guardian migration and then use the same item normalization.

## Item bases and affixes

`data/itemBases.ts` defines 27 themed bases across weapons, armor, shields, accessories, and potions. Bases carry stable IDs, item tags, requirements, equipment rules, legacy ID mappings, and authored values. `data/itemAffixes.ts` defines 30 functional modifiers. The registry covers attributes, flat and percentage physical/spell damage, attack/cast speed, critical chance/damage, health/mana, armor, movement, cooldown and mana-cost reduction, projectile damage/speed, bleed/poison/fire chance and power, and life on hit/kill.

Rarity rolls are data-driven:

| Rarity | Affixes | R4A behavior |
| --- | ---: | --- |
| Common | 0 | Base item only |
| Magic | 1–2 | Rolls valid affixes with no repeated exclusive group |
| Rare | 3–4 | Rolls valid affixes with no repeated exclusive group |
| Unique | Reserved | Existing fields are preserved; R4A does not generate uniques |

Tier 1 affixes are available from item level 1. Tier 2 modifiers unlock at item level 4 and have higher ranges. Non-consumable base value grows slowly: one point every three levels for weapons/armor and every four levels for accessories. This keeps the first floors usable while allowing later drops to rise in value.

Normal enemies have a 27% drop chance. At floor 1, a successful normal drop is 72% Common, 26% Magic, and 2% Rare; the Rare share increases gradually through floor 5. Elite enemies have a 72% drop chance and a higher Magic/Rare share. Floor Guardians still guarantee their authored Rare reward. Regular enemy pools are constrained to bases associated with their creature or attack family.

## Derived stat formulas

`calculateDerivedStats(player)` is pure and is the source of truth for the active FPS path. Base progression caps live in `baseMaxHp` and `baseMaxMp`; `maxHp`, `maxMp`, and `armor` remain compatibility caches that are recomputed from those bases and the current equipment.

| Value | Formula |
| --- | --- |
| Maximum health | `(baseMaxHp + flat health) × (1 + health% / 100)` |
| Maximum mana | `(baseMaxMp + flat mana) × (1 + mana% / 100)` |
| Armor | `(base armor + equipped armor/shield + flat armor) × (1 + armor% / 100)` |
| Pre-mitigation damage | `ability damage + primary attribute × 0.62 + weapon power + damage bonus + matching flat damage` |
| Final damage | `max(1, round(pre-mitigation × charge × damage multiplier × projectile multiplier × critical × status × counter))` |

Strength is used for most melee attacks, Dexterity for Rogue/Ranger/Monk melee and Rogue/Ranger physical projectiles, and Intelligence for spell abilities. Spell classification follows stable ability IDs; weapon-style cleric strikes remain physical. Physical and spell percentage bonuses add as percentage points before multiplication. Critical chance starts at 5%; critical damage starts at 150%.

The safety caps are: health/mana/attributes at 100,000; armor at 100; physical/spell damage multipliers at 0.5–2.0; attack/cast speed and projectile multipliers at 0.5–1.75; critical chance at 65%; critical damage at 150–300%; movement speed at 0.6–1.5; cooldown recovery at 0–45%; mana-cost reduction at 0–50%; total damaging-status chance per hit at 60%; life on hit at 20; life on kill at 50. Unknown, malformed, wrong-tag, or out-of-range affixes remain preserved as data but do not affect stats.

Attack speed scales physical action timing, cast speed scales spell action timing, cooldown recovery scales cooldown duration, and mana-cost reduction scales the cost paid at action start. Movement speed affects walking, sprinting, and dodge travel; medium armor reduces movement by 4% and heavy armor by 8%. Projectile affixes affect player projectiles. A successful hit may roll at most one affix status; bleed, poison, and burn tick once per second and refresh rather than stacking unbounded copies. Life on hit heals per target hit; life on kill is granted only inside the one-time enemy reward path.

## Extension guide

1. Add an immutable base to `data/itemBases.ts`, including stable tags, legacy IDs, required level, and two-handed metadata when needed.
2. Add an affix to `data/itemAffixes.ts` only when its stat has a real consumer in `calculateDerivedStats` and the active runtime. Keep its values within an intentional tier range and choose an exclusive group.
3. Add or update the corresponding data, combat, migration, and save tests. Do not use item display names to drive combat behavior.
4. If a future wave changes slots or unique effects structurally, bump the save version and migrate from the last supported version without rerolling any stored item.
