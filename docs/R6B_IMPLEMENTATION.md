# FPS R6B — Equipment, dual wield, and two-hand viewmodels

## Baseline and scope

Implemented on the R6A `main` baseline at `c20406dcf8b5b963265108028eba505ce19227b8` (merged PR #23). R6B extends the active solo first-person runtime: `FPSGameRuntime` owns gameplay changes, and React renders equipment and inventory UI. It adds the equipment model, safe hand transactions, first-person hand animation, save migration, and the related tests. It does not add pacts, skill kits, crafting, or balance simulation.

## Canonical equipment model

`EquipmentSlot` has eleven stable keys: `mainHand`, `offHand`, `head`, `torso`, `arms`, `legs`, `feet`, `neck`, `ring1`, `ring2`, and `divineSigil`. Each item base authors its compatible slots in `ItemBaseDefinition.equipmentSlots`; runtime code does not infer a slot from the display name. `services/equipmentRules.ts` owns slot resolution, requirements, shield/focus/two-hand classification, dual-wield checks, loadout validation, and inventory identity/capacity checks.

One-handed weapons can occupy either hand. Shields and foci occupy the off hand. Two-handed weapons occupy `mainHand` and require `offHand` to be empty. Armor and accessories use their authored slot metadata. Rings are assigned to the first free ring slot. Main-hand and off-hand weapon power are calculated separately, so equipping an off-hand weapon does not silently add its power to every hit. A shield contributes armor; a focus keeps its accessory stats.

`tryEquipItem` and `tryUnequipItem` return explicit success or failure results. Replacing a two-handed weapon returns its old main-hand and off-hand items to the bag in the same transaction. If capacity or item identity checks fail, the original player value is returned unchanged with a visible error. Runtime loot IDs can be reserved during a transaction to prevent an item from appearing in both the world and equipment/inventory. Persisted inventory and overflow are capped at 1,024 instances.

`PlayerCombat` alternates the captured hand for each melee action only when both hands contain one-handed weapons. Each action retains one hit sequence and its selected `weaponSlot`; hit resolution calculates damage from that weapon. Existing action cooldowns remain in effect. A successful equipment transaction cancels an in-flight action while preserving its cooldown, so an off-hand action cannot resolve after its weapon has been moved.

## Paperdoll and item feedback

The inventory screen shows a pixel hero silhouette with all eleven equipment slots, separate hand power, and before/after derived-stat values. It marks the off hand as reserved when the main hand has a two-handed weapon, shows level requirements and compatible slots, and labels one-handed, two-handed, shield, focus, and dual-wield items. Quick-equip and unequip callbacks consume the actual transaction result; the UI only reports success when the runtime accepted the change. `CharacterStatsScreen` lists the same canonical slots and separates main-hand from off-hand weapon power.

## First-person viewmodels and local art

The viewmodel draws independent main-hand and left-hand sprites from local authored pixel art. The off-hand sprite sources are `offhand_empty`, `offhand_xiphos`, `offhand_kopis`, `offhand_dory`, `offhand_shield`, `offhand_focus`, `offhand_two_hand_grip`, and `offhand_bow_draw`. They are registered in `data/assetRegistry.ts` and included in active-floor preloads. The left-hand art is drawn in its own orientation instead of mirroring the right-hand arm.

`WeaponPresenter` animates idle breathing, movement bob, anticipation, active swings, recovery, off-hand swings, two-hand grips, bow draw/release, staff casts, shield guard/bash, monk kick, dodge, hit recoil, and item use. `AssetManager` caches the local textures; the presenter reuses its sprite materials, mutable pose state, and pose input on each frame. Gear changes update texture maps without rebuilding materials. The Python asset generator remains deterministic and offline.

The related unused wall-prop sprite materials are removed as recorded in [review resolution](COPILOT_REVIEW_RESOLUTION.md).

## Save version 5

New Maze saves use version 5. The version-4 migration maps legacy weapon, armor, off-hand, and accessory entries through their item base definitions. It places rings and neck/head accessories in the slot defined by their base, routes compatible armor to its authored slot, and returns conflicts to inventory. Known instance IDs, rarity, affixes, unique effect IDs/state, the inventory grid, and world loot are preserved. Unknown items remain in inventory and are not guessed into equipment slots.

Before migration, the loader checks instance IDs across inventory, equipment, and world loot. A duplicate or empty identity invalidates the source and leaves its serialized value untouched. The migration is in memory until a valid version-5 save is written; loading that saved version again does not migrate a second time. If the safe storage limit would be exceeded, migration or an equipment transaction fails without dropping items.

## Verification and manual coverage

Automated coverage in `tests/equipmentR6B.test.ts` checks slot metadata, focus/shield and requirement behavior, two-handed transfer and capacity failure, hand alternation and one-hit resolution, pose variants and reusable pose state, authored asset paths, v4-to-v5 mapping, unique/unknown item preservation, duplicate-ID rejection, migration idempotency, and paperdoll labels. Existing inventory, itemization, combat, save, asset-registry, and labyrinth tests cover adjacent systems.

Verification on this implementation: `npm run typecheck` passed; `npm test` passed all 277 tests across 29 files; `npm run build` completed; the local asset generator produced identical hashes on two consecutive runs across all 99 PNG files; the path-scoped R6B `git diff --check` passed. The production build reports that its two JavaScript chunks exceed Vite's 500 kB warning threshold (540.04 kB and 572.75 kB before gzip). The unscoped local `git diff --check` also sees the stale workspace baseline and reports blank lines in files outside the R6B change set.

Browser/WebGL playtests and direct gameplay testing are not represented by the automated suite; those remain manual checks.
