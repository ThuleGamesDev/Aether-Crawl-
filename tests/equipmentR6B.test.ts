import React from 'react';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getAbility } from '../combat/AbilityRegistry';
import { calculatePlayerDamage } from '../combat/DamageSystem';
import { offhandVisuals, weaponVisuals, collectAssetPaths } from '../data/assetRegistry';
import { ITEM_BASES, ITEM_BASE_BY_ID } from '../data/itemBases';
import { createUniqueInstance } from '../services/uniqueItems';
import { createPlayerCharacter, createItemInstance, refreshPlayerDerivedCaps, splitInventoryStack, tryEquipItem } from '../player/PlayerProgression';
import { PlayerCombat } from '../player/PlayerCombat';
import { createWeaponPresentationPoseState, getWeaponPresentationPose } from '../presentation/WeaponPresenter';
import { loadMazeGame, MAZE_SAVE_KEY, saveMazeGame } from '../services/mazeSave';
import { createEmptyEquipment, EQUIPMENT_SLOTS, MAX_INVENTORY_INSTANCES, validateEquipmentLoadout } from '../services/equipmentRules';
import { syncInventoryGrid } from '../services/inventoryGrid';
import { FPSGameRuntime } from '../engine/FPSGameRuntime';
import { EquipmentSlotCard, default as InventoryPanel } from '../components/InventoryPanel';
import type { EquipmentTransactionResult } from '../services/equipmentRules';
import type { ItemInstance, PlayerCharacter } from '../types';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const item = (baseId: string, instanceId: string, level = 1, value?: number): ItemInstance => {
  const base = ITEM_BASE_BY_ID[baseId];
  if (!base) throw new Error('Missing item base ' + baseId);
  const instance = createItemInstance({ ...base, quantity: 1 }, instanceId, level);
  return value === undefined ? instance : { ...instance, value };
};

function emptyLegacySave(accessory: ItemInstance) {
  const runtime = new FPSGameRuntime('PALADIN');
  const equipment = createEmptyEquipment();
  equipment.mainHand = item('xiphos', 'v4-main', 1, 20);
  equipment.offHand = item('aspis', 'v4-shield');
  equipment.head = item('bronze_helm', 'v4-helm', 2);
  const accessorySlot = accessory.baseId === 'serpent_ring' || accessory.baseId === 'bronze_signet' ? 'ring1' : 'neck';
  equipment[accessorySlot] = accessory;
  const ringInBag = accessorySlot === 'neck' ? item('serpent_ring', 'v4-bag-ring') : null;
  const unknown: ItemInstance = {
    id: 'future_relic', baseId: 'future_relic', instanceId: 'v4-unknown', name: 'Uncatalogued relic',
    description: 'An item from later content.', type: 'ACCESSORY', value: 0, quantity: 1, itemLevel: 1,
    rarity: 'RARE', affixes: [],
  };
  const inventory = [unknown, ...(ringInBag ? [ringInBag] : [])];
  runtime.player = refreshPlayerDerivedCaps({
    ...runtime.player,
    equipment,
    inventory,
    inventoryGrid: syncInventoryGrid(inventory),
  });
  const storage = new MemoryStorage();
  if (!runtime.save(storage)) throw new Error('Could not create canonical save fixture.');
  const legacy = JSON.parse(storage.getItem(MAZE_SAVE_KEY)!) as Record<string, any>;
  const canonical = legacy.player.equipment;
  legacy.version = 4;
  legacy.player.equipment = {
    weapon: canonical.mainHand,
    armor: canonical.head,
    offhand: canonical.offHand,
    accessory,
  };
  return { legacy, storage };
}

describe('R6B canonical equipment rules', () => {
  it('uses eleven authored slots and validates base compatibility and two-hand occupancy', () => {
    expect(EQUIPMENT_SLOTS).toEqual(['mainHand', 'offHand', 'head', 'torso', 'arms', 'legs', 'feet', 'neck', 'ring1', 'ring2', 'divineSigil']);
    expect(ITEM_BASES.every(base => Array.isArray(base.equipmentSlots))).toBe(true);
    expect(new Set(ITEM_BASES.flatMap(base => base.equipmentSlots))).toEqual(new Set(EQUIPMENT_SLOTS));
    expect(validateEquipmentLoadout(createEmptyEquipment())).toBe(true);

    const twoHanded = createEmptyEquipment();
    twoHanded.mainHand = item('labrys', 'rules-labrys');
    expect(validateEquipmentLoadout(twoHanded)).toBe(true);
    twoHanded.offHand = item('aspis', 'rules-shield');
    expect(validateEquipmentLoadout(twoHanded)).toBe(false);
    twoHanded.mainHand = item('xiphos', 'rules-xiphos');
    twoHanded.offHand = item('kopis', 'rules-kopis');
    expect(validateEquipmentLoadout(twoHanded)).toBe(true);
    twoHanded.head = item('xiphos', 'rules-wrong-slot');
    expect(validateEquipmentLoadout(twoHanded)).toBe(false);
  });

  it('equips a focus or shield in the off hand and reports level and two-hand conflicts without mutation', () => {
    const paladin = createPlayerCharacter('PALADIN');
    const focus = item('sun_focus', 'r6b-focus', 3);
    const ready = { ...paladin, stats: { ...paladin.stats, level: 3 }, inventory: [focus] };
    const focusResult = tryEquipItem(ready, focus.instanceId);
    expect(focusResult.ok).toBe(true);
    expect(focusResult.player.equipment.offHand?.instanceId).toBe(focus.instanceId);
    expect(focusResult.player.inventory.some(entry => entry.baseId === 'aspis')).toBe(true);

    const lockedBracers = item('bronze_bracers', 'r6b-locked-bracers');
    const lockedPlayer = { ...paladin, inventory: [lockedBracers] };
    const lockedResult = tryEquipItem(lockedPlayer, lockedBracers.instanceId);
    expect(lockedResult.ok).toBe(false);
    expect(lockedResult.errorCode).toBe('LEVEL_REQUIREMENT');
    expect(lockedResult.player).toBe(lockedPlayer);

    const twoHander = createPlayerCharacter('BARBARIAN');
    const blockedFocus = item('sun_focus', 'r6b-blocked-focus', 3);
    const blocker = { ...twoHander, stats: { ...twoHander.stats, level: 3 }, inventory: [blockedFocus] };
    const blocked = tryEquipItem(blocker, blockedFocus.instanceId);
    expect(blocked.ok).toBe(false);
    expect(blocked.errorCode).toBe('TWO_HAND_CONFLICT');
    expect(blocked.player).toBe(blocker);
  });

  it('moves both replaced hand items back safely or rejects the whole two-hand transaction', () => {
    const base = createPlayerCharacter('PALADIN');
    const main = item('xiphos', 'r6b-replaced-main');
    const off = item('kopis', 'r6b-replaced-off');
    const twoHander = item('labyrinth_spear', 'r6b-two-hander', 4);
    const inventory = [twoHander];
    const dual = {
      ...base,
      stats: { ...base.stats, level: 4 },
      equipment: { ...base.equipment, mainHand: main, offHand: off },
      inventory,
      inventoryGrid: syncInventoryGrid(inventory),
    };
    const equipped = tryEquipItem(dual, twoHander.instanceId);
    expect(equipped.ok).toBe(true);
    expect(equipped.player.equipment.mainHand?.instanceId).toBe(twoHander.instanceId);
    expect(equipped.player.equipment.offHand).toBeNull();
    expect(equipped.player.inventory.map(entry => entry.instanceId)).toEqual(expect.arrayContaining([main.instanceId, off.instanceId]));
    expect(validateEquipmentLoadout(equipped.player.equipment)).toBe(true);

    const fullBag = Array.from({ length: MAX_INVENTORY_INSTANCES - 1 }, (_, index) => item('healing_draught', 'r6b-full-' + index));
    const capped = { ...dual, inventory: [...fullBag, twoHander], inventoryGrid: [] };
    const failed = tryEquipItem(capped, twoHander.instanceId);
    expect(failed.ok).toBe(false);
    expect(failed.errorCode).toBe('INVENTORY_CAPACITY');
    expect(failed.player).toBe(capped);
    expect(failed.player.equipment.mainHand?.instanceId).toBe(main.instanceId);
    expect(failed.player.equipment.offHand?.instanceId).toBe(off.instanceId);
    expect(failed.player.inventory).toHaveLength(MAX_INVENTORY_INSTANCES);

    const reservedFailure = tryEquipItem(dual, twoHander.instanceId, [main.instanceId]);
    expect(reservedFailure.ok).toBe(false);
    expect(reservedFailure.errorCode).toBe('INVALID_IDENTITY');
    expect(reservedFailure.player).toBe(dual);
  });

  it('does not split a stack past the safe inventory instance limit', () => {
    const base = createPlayerCharacter('PALADIN');
    const stack = { ...item('healing_draught', 'r6b-full-stack'), quantity: 2 };
    const inventory = [...Array.from({ length: MAX_INVENTORY_INSTANCES - 1 }, (_, index) => item('healing_draught', 'r6b-full-stack-fill-' + index)), stack];
    const player = { ...base, inventory, inventoryGrid: syncInventoryGrid(inventory) };
    expect(splitInventoryStack(player, stack.instanceId)).toBeNull();
    expect(player.inventory).toHaveLength(MAX_INVENTORY_INSTANCES);
    expect(player.inventory.at(-1)).toMatchObject({ instanceId: stack.instanceId, quantity: 2 });
  });

  it('alternates one-hit melee actions between two one-handed weapons and persists the selected hand', () => {
    const base = createPlayerCharacter('PALADIN');
    const main = item('xiphos', 'r6b-combat-main', 1, 20);
    const off = item('kopis', 'r6b-combat-off', 1, 2);
    const player: PlayerCharacter = { ...base, equipment: { ...base.equipment, mainHand: main, offHand: off } };
    const ability = getAbility('barbarian_cleave')!;
    expect(calculatePlayerDamage(player, ability, 1, 1, 'mainHand')).toBeGreaterThan(calculatePlayerDamage(player, ability, 1, 1, 'offHand'));

    const combat = new PlayerCombat();
    expect(combat.start(player, 'barbarian_cleave').ability).toBeTruthy();
    expect(combat.action?.weaponSlot).toBe('mainHand');
    const saved = combat.snapshot();
    expect(saved.nextMeleeWeaponSlot).toBe('offHand');
    const restored = new PlayerCombat();
    restored.restore(saved);
    expect(restored.action?.weaponSlot).toBe('mainHand');
    const firstHitIndices: number[] = [];
    for (let index = 0; index < 30 && restored.action; index += 1) firstHitIndices.push(...restored.update(0.05).activeHitIndices);
    expect(firstHitIndices).toEqual([0]);
    expect(restored.start(player, 'barbarian_heavy_strike').ability).toBeTruthy();
    expect(restored.action?.weaponSlot).toBe('offHand');
  });
});

describe('R6B first-person equipment presentation', () => {
  const pose = (options: Partial<Parameters<typeof getWeaponPresentationPose>[0]> = {}) => getWeaponPresentationPose({
    weapon: 'sword', moving: false, guarding: false, hasShield: false, elapsedSeconds: 1, ...options,
  });

  it('animates dual wield, two-hand grip, shield guard/bash, bow draw, staff cast, kick, dodge, recoil, and item use', () => {
    const idle = pose({ offHandPose: 'weapon' });
    const offHandSwing = pose({ offHandPose: 'weapon', actionHand: 'offHand', abilityId: 'barbarian_cleave', phase: 'ACTIVE', remainingSeconds: 0.08 });
    expect(offHandSwing.weaponX).toBe(idle.weaponX);
    expect(offHandSwing.offHandX).toBeGreaterThan(idle.offHandX);

    const grip = pose({ weapon: 'axe', offHandPose: 'twoHandGrip', abilityId: 'barbarian_heavy_strike', phase: 'WINDUP', remainingSeconds: 0.2 });
    expect(grip.offHandX).toBeGreaterThan(0);
    const guard = pose({ offHandPose: 'shield', hasShield: true, guarding: true });
    const bash = pose({ offHandPose: 'shield', hasShield: true, abilityId: 'paladin_smite', phase: 'ACTIVE', remainingSeconds: 0.05 });
    expect(guard.shieldVisible).toBe(true);
    expect(guard.shieldZ).toBeGreaterThan(-1.12);
    expect(bash.shieldVisible).toBe(true);
    const bow = pose({ weapon: 'bow', offHandPose: 'bowDraw', abilityId: 'ranger_shortbow', phase: 'WINDUP', remainingSeconds: 0.05 });
    expect(bow.offHandX).toBeGreaterThan(-0.24);
    const cast = pose({ weapon: 'staff', offHandPose: 'twoHandGrip', abilityId: 'sorcerer_arcane_bolt', phase: 'ACTIVE', remainingSeconds: 0.02 });
    expect(cast.offHandRotationZ).not.toBe(0.1);
    const kick = pose({ abilityId: 'monk_flying_kick', phase: 'ACTIVE', remainingSeconds: 0.05 });
    expect(kick.weaponX).toBeGreaterThan(0.68);
    expect(pose({ viewmodelEvent: 'DODGE', viewmodelEventProgress: 1 }).weaponX).toBeGreaterThan(idle.weaponX);
    expect(pose({ viewmodelEvent: 'HIT_RECOIL', viewmodelEventProgress: 1 }).weaponY).toBeLessThan(idle.weaponY);
    expect(pose({ viewmodelEvent: 'ITEM_USE', viewmodelEventProgress: 1 }).weaponX).toBeLessThan(idle.weaponX);

    const target = createWeaponPresentationPoseState();
    expect(getWeaponPresentationPose({ weapon: 'sword', moving: false, guarding: false, hasShield: false, elapsedSeconds: 0 }, target)).toBe(target);
    expect(getWeaponPresentationPose({ weapon: 'sword', moving: true, guarding: false, hasShield: false, elapsedSeconds: 1 }, target)).toBe(target);
  });

  it('registers every separately authored left-hand asset as a local static file', () => {
    const registered = Object.values(offhandVisuals);
    expect(registered).toHaveLength(8);
    for (const path of registered) expect(existsSync(resolve(process.cwd(), 'public', path.replace(/^\//, ''))), path).toBe(true);
    for (const path of [...registered, ...Object.values(weaponVisuals)]) {
      const png = readFileSync(resolve(process.cwd(), 'public', path.replace(/^\//, '')));
      expect([png.readUInt32BE(16), png.readUInt32BE(20)], path).toEqual([128, 160]);
    }
    const shield = readFileSync(resolve(process.cwd(), 'public/assets/maze/hands/aspis.png'));
    expect([shield.readUInt32BE(16), shield.readUInt32BE(20)]).toEqual([128, 128]);
    expect(collectAssetPaths()).toEqual(expect.arrayContaining(registered));
  });
});

describe('R6D2 v4 to v8 migration and paperdoll', () => {
  it('maps old armor/accessories by base metadata, preserves unique and unknown items, and is idempotent after saving', () => {
    const uniqueAmulet = createUniqueInstance('ariadnes_thread', 'v4-unique-amulet', 2);
    const { legacy, storage } = emptyLegacySave(uniqueAmulet);
    const source = JSON.stringify(legacy);
    storage.setItem(MAZE_SAVE_KEY, source);
    const migrated = loadMazeGame(storage);
    expect(migrated.invalid).toBe(false);
    expect(migrated.migratedFromR4B).toBe(true);
    expect(migrated.migrationRequired).toBe(true);
    expect(storage.getItem(MAZE_SAVE_KEY)).toBe(source);
    expect(migrated.save?.version).toBe(8);
    expect(migrated.save?.player.equipment.head?.instanceId).toBe('v4-helm');
    expect(migrated.save?.player.equipment.neck).toMatchObject({ instanceId: uniqueAmulet.instanceId, uniqueEffectId: 'ariadnes_thread', rarity: 'UNIQUE' });
    expect(migrated.save?.player.inventory.map(entry => entry.instanceId)).toEqual(expect.arrayContaining(['v4-unknown', 'v4-bag-ring']));
    const all = [...migrated.save!.player.inventory, ...Object.values(migrated.save!.player.equipment).filter((entry): entry is ItemInstance => Boolean(entry)), ...migrated.save!.loot.map(drop => drop.item)];
    expect(new Set(all.map(entry => entry.instanceId)).size).toBe(all.length);

    const ringFixture = emptyLegacySave(item('serpent_ring', 'v4-equipped-ring'));
    ringFixture.storage.setItem(MAZE_SAVE_KEY, JSON.stringify(ringFixture.legacy));
    const ringMigration = loadMazeGame(ringFixture.storage);
    expect(ringMigration.invalid).toBe(false);
    expect(ringMigration.save?.player.equipment.ring1?.instanceId).toBe('v4-equipped-ring');

    expect(saveMazeGame(migrated.save!, storage)).toBe(true);
    const resumed = loadMazeGame(storage);
    expect(resumed.migrationRequired).toBe(false);
    expect(resumed.save?.player.equipment.neck?.uniqueEffectId).toBe('ariadnes_thread');
  });

  it('leaves a duplicate-ID v4 source untouched instead of creating overlapping item references', () => {
    const { legacy, storage } = emptyLegacySave(createUniqueInstance('ariadnes_thread', 'v4-duplicate-unique', 2));
    legacy.player.inventory[0].instanceId = legacy.player.equipment.weapon.instanceId;
    const source = JSON.stringify(legacy);
    storage.setItem(MAZE_SAVE_KEY, source);
    const result = loadMazeGame(storage);
    expect(result.invalid).toBe(true);
    expect(result.save).toBeNull();
    expect(storage.getItem(MAZE_SAVE_KEY)).toBe(source);
  });

  it('renders all eleven paperdoll slots and labels two-handed hand reservation and dual-wield equipment', () => {
    const base = createPlayerCharacter('PALADIN');
    const twoHanded: PlayerCharacter = { ...base, equipment: { ...createEmptyEquipment(), mainHand: item('labrys', 'paperdoll-2h') } };
    const result: EquipmentTransactionResult = { ok: false, player: twoHanded, message: 'Cannot equip.' };
    const html = renderToStaticMarkup(React.createElement(InventoryPanel, {
      player: twoHanded, onEquip: () => result, onUnequip: () => result,
      onUse: () => undefined, onMove: () => false, onSplit: () => false, onDrop: () => false,
    }));
    for (const label of ['Main Hand', 'Off Hand', 'Head', 'Torso', 'Arms', 'Legs', 'Feet', 'Neck', 'Ring 1', 'Ring 2', 'Divine Sigil']) expect(html).toContain(label);
    expect(html).toContain('Reserved · 2H');
    expect(html).toContain('2H');

    const dual: PlayerCharacter = { ...base, equipment: { ...base.equipment, mainHand: item('xiphos', 'paperdoll-main'), offHand: item('kopis', 'paperdoll-off') } };
    const dualCard = renderToStaticMarkup(React.createElement(EquipmentSlotCard, { slot: 'mainHand', player: dual, selectedId: null, onSelect: () => undefined, onUnequip: () => undefined }));
    expect(dualCard).toContain('Dual Wield · 1H');
  });
});
