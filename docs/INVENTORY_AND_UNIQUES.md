# FPS-R4B — Inventory, character stats, uniques, and loot UX

R4B extends the R4A item model and its derived-stat pipeline. It adds a positional bag, safe overflow storage, eight authored unique effects, item-specific dungeon drops, and a dedicated character-stats screen. The game remains a solo, real-time first-person action RPG; React renders controls and state, while `FPSGameRuntime` owns gameplay changes.

## Existing item and save contract

An item is one `ItemInstance` with a stable `instanceId`, an R4A `baseId`, item level, rarity, rolled affixes, and a quantity. The player owns four stable equipment slots (`weapon`, `armor`, `offhand`, and `accessory`), an inventory list, and world loot is stored separately as `WorldLootDrop[]`. R4A's `calculateDerivedStats` is the only place that calculates active equipment and unique bonuses. UI comparisons call that same function before and after an equipment transaction.

The solo save continues to use `maze_of_the_minotaur_fps_r2a_save_v2`; the envelope is now version 4. `PlayerCharacter.inventoryGrid` stores stable item-instance coordinates. Items that cannot be placed remain in the inventory list and are surfaced in the overflow panel. Runtime pickups and rewards enter the same safe-add path, so a full bag never deletes a floor drop or blocks a Guardian reward.

## Bag layout and actions

The bag is 10 columns by 5 rows. Footprints are deterministic:

| Item | Footprint |
| --- | ---: |
| Potion, scroll, accessory | 1 × 1 |
| Armor, shield | 2 × 2 |
| Staff | 1 × 3 |
| Dagger and other weapons | 1 × 2 |
| Labrys, bow, spear, axe, mace, Cyclopean hammer | 2 × 3 |

Saved valid placements are kept. Missing or invalid placements are packed in row-major order; items that still do not fit remain in overflow in their original item list. Moving onto a different occupied item performs a swap only when both complete footprints fit. A failed move leaves the original layout intact. Overflow items can be selected and placed into an open cell when space becomes available.

Matching potions and scrolls auto-stack to 20. Different base, level, rarity, effect, or affix data does not merge. Equipment is always represented by separate one-item instances. A stack can be split in half, one potion can be consumed, and one item can be dropped nearby. Splits, drops, equips, and unequips retain stable instance identity and rebuild the grid deterministically. Replaced or two-handed-conflicting equipment returns to inventory.

Desktop users can click to select, click a target cell to move, double-click or right-click an item to quick-equip, and use the visible action buttons. Touch users use the same select-then-tap flow; no essential stats depend on hover. The item detail pane shows the base, required level, active affixes, unique rules, and derived-stat changes from equipping the selected item.

## Character Stats screen

The inventory has separate **Inventory & Equipment** and **Character Stats** tabs. The stats screen shows the character's level and XP progress, current and maximum health/mana, attributes, armor and weapon power, damage and speed modifiers, critical stats, ailment chance/power, cooldown and mana-cost reductions, life on hit/kill, equipped items, active effects, and any equipped unique rules. Every item-derived value comes from `calculateDerivedStats`; the screen does not maintain a second stat calculation.

## Mythic unique library

Unique effect IDs are stable save/content identifiers. Each trigger is resolved by the pure `resolveUniqueTrigger` function; the runtime applies returned results through its existing damage and status systems. Timers advance only with the simulation tick and pause with inventory/map overlays.

| Effect ID / unique | Trigger and effect | Cooldown and cap | Passive / fallback |
| --- | --- | --- | --- |
| `ariadnes_thread` — Ariadne's Thread | A successfully started dodge grants +25% movement for 2.25 s. | 8 s; one movement surge. | +4% movement. |
| `aspis_bronze_gate` — Aspis of the Bronze Gate | A facing attack blocked while guarding returns 35% of blocked damage. | 4 s; one counter, maximum 12 damage. | +2 armor. |
| `serpent_queen_fang` — Serpent Queen's Fang | A poison application gets +35% magnitude. | 5 s; one empowered application per cooldown. | +15% poison power. |
| `promethean_ember` — Promethean Ember | Applying burn stores one charge; the next fire ability deals +25% damage. | 8 s; one charge, expires after 8 s. | +15% fire power. |
| `stygian_seal` — Stygian Seal | A Necromancer ability grants 20% damage reduction for 2.5 s. | 10 s; one non-stacking ward. | Other classes retain the accessory's base stats and see the class restriction. |
| `artemis_mark` — Artemis' Mark | A player projectile hit stores a charge; the next projectile deals +20% damage. | 3 s; one charge, expires after 6 s. | +8% projectile damage and +2 percentage points critical chance. |
| `cyclopean_mallet` — Cyclopean Mallet | A melee action with at least 1.3× action power sends a shockwave from the first target. | 10 s; one shockwave per attack, 45% hit damage, 1.35 m radius. | +8% physical damage. |
| `laurel_asclepius` — Laurel of Asclepius | A self-healing ability grants 25% damage reduction for 3 s. | 12 s; one non-stacking ward. | +4 maximum health. |

Shockwave secondary hits exclude the original hit set and do not call the on-hit proc resolver again. Other effects use their own cooldown state, one charge at most, and do not recursively trigger themselves. Proc state is saved with the character and expires on the simulation clock. A class-restricted unique remains a valid item when equipped by another class; its effect is inactive and the UI shows the fallback.

## Drop policy and presentation

Normal and elite loot retain their existing seeded drop and rarity rules. An elite item drop on floor 2 or deeper has a 1% unique roll, rising by one percentage point per floor and capped at 4%. Guardian rewards remain the existing authored guaranteed rare bases and are not converted into uniques.

The local pixel icon registry draws item-specific drop silhouettes and rarity borders without remote assets or runtime image generation. Unique drops receive the strongest glow and size treatment; rare drops are also enlarged. At most one pickup prompt is shown at a time. The looked-at drop is selected within pickup distance and line of sight, with rarity contributing to target priority. The player still presses **E** to collect; a full bag routes an accepted item to overflow and the world drop disappears only after the item has been safely stored.

## Controls and modal behavior

`I` opens/closes inventory, `Tab` opens the map, and `Esc` closes an overlay or pauses. Opening inventory/map/pause releases Pointer Lock and clears held gameplay inputs; closing an overlay leaves pointer capture released, so its close click cannot also attack. A fresh click on the viewport re-locks the pointer. With Pointer Lock, mouse movement looks and left/right buttons attack or guard. If Pointer Lock is missing or denied, dragging the left mouse button looks and a stationary left click attacks. Touch controls keep their existing move/look regions and now include a direct bag button.

## Migration and validation

R4A version-3 saves migrate in memory to version 4. Valid item IDs and Guardian/world loot are preserved, the old inventory is deterministically packed, oversized legacy consumable stacks are split into stacks of at most 20, and non-stackable quantities become individual item instances with deterministic IDs. Overflow remains visible and saved. A failed validation does not overwrite the original save. R2A version-2 and R1 saves continue through their existing migration paths and now produce version 4 directly.

Automated coverage includes footprint and collision validation, atomic swaps, deterministic overflow, stack merge/split/drop, equipment comparison and two-handed returns, unique trigger caps and class fallback, Guardian reward policy, full-bag pickup persistence, R4A v3 migration, mouse drag-look fallback, and touch-pointer cancellation. Run `npm run typecheck`, `npm test`, `npm run build`, and `git diff --check` before review. Browser/WebGL interaction is reported separately and is not inferred from the unit suite.
