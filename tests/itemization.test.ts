import { describe, expect, it } from 'vitest';
import { calculateIncomingDamage, calculatePlayerDamage } from '../combat/DamageSystem';
import { getAbility } from '../combat/AbilityRegistry';
import { applyRealtimeStatus, tickRealtimeStatuses } from '../combat/StatusSystem';
import { ITEM_AFFIXES } from '../data/itemAffixes';
import { ITEM_BASES, getItemBase } from '../data/itemBases';
import { FPSGameRuntime } from '../engine/FPSGameRuntime';
import { createPlayerControllerState, updatePlayerController } from '../player/PlayerController';
import { PlayerCombat } from '../player/PlayerCombat';
import { rollItemStatusProc } from '../player/ItemCombatEffects';
import { calculateDerivedStats } from '../player/DerivedStats';
import { consumePotion, createItemInstance, createPlayerCharacter, equipItem, refreshPlayerDerivedCaps, unequipItem } from '../player/PlayerProgression';
import { createLootInstance, createEnemyDrop, describeItem, rollAffixes, rollItemBase, validateItemInstance } from '../services/itemization';
import { floorRandom } from '../services/floorRandom';
import { loadMazeGame, MAZE_SAVE_KEY, saveMazeGame } from '../services/mazeSave';
import type { ItemAffixInstance, ItemInstance, PlayerCharacter, WorldEnemy } from '../types';
import type { InputFrame } from '../engine/InputSystem';
import type { KeyValueStorage } from '../services/fpsSave';

function makeItem(baseId: string, instanceId: string, affixes: ItemAffixInstance[] = [], itemLevel = 4): ItemInstance {
  const base = getItemBase(baseId);
  if (!base) throw new Error('Missing fixture base ' + baseId);
  return { ...base, instanceId, itemLevel, rarity: affixes.length >= 3 ? 'RARE' : affixes.length ? 'MAGIC' : 'COMMON', affixes, quantity: 1 };
}

function inputFrame(overrides: Partial<InputFrame> = {}): InputFrame {
  return {
    movement: { forward: 0, strafe: 0, turn: 0 }, lookX: 0, lookY: 0, sprint: false,
    primaryPressed: false, secondaryPressed: false, secondaryDown: false, secondaryReleased: false,
    skillPressed: false, skillSlot: null, dodgePressed: false, interactPressed: false,
    inventoryPressed: false, mapPressed: false, pausePressed: false, ...overrides,
  };
}

function makeEnemy(overrides: Partial<WorldEnemy> = {}): WorldEnemy {
  return {
    id: 'loot_test_enemy', definitionId: 'giant_rat', name: 'Giant Rat', visualId: 'giant_rat',
    position: { x: 3, y: 0, z: 3 }, health: 10, maxHealth: 10, damage: 4, xpReward: 8,
    state: 'DEAD', stateTimer: 0, attackCooldown: 0, attackRange: 1.2, attackTelegraphSeconds: 0.5,
    rewardGranted: false, isBoss: false, ...overrides,
  };
}

class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('FPS-R4A itemization core', () => {
  it('defines at least 16 functional Greek bases and 24–32 data-driven affixes', () => {
    expect(ITEM_BASES.length).toBeGreaterThanOrEqual(16);
    expect(ITEM_AFFIXES.length).toBeGreaterThanOrEqual(24);
    expect(ITEM_AFFIXES.length).toBeLessThanOrEqual(32);
    expect(new Set(ITEM_BASES.map(base => base.baseId)).size).toBe(ITEM_BASES.length);
    expect(new Set(ITEM_AFFIXES.map(affix => affix.id)).size).toBe(ITEM_AFFIXES.length);
    expect(ITEM_AFFIXES.every(affix => affix.validItemTags.length && affix.group && affix.minValue <= affix.maxValue)).toBe(true);
  });

  it('rolls rarity counts, valid tags, tier ranges, exclusive groups, and seeded instances deterministically', () => {
    const kopis = getItemBase('kopis')!;
    expect(rollAffixes(kopis, 'COMMON', 4, floorRandom(1))).toEqual([]);
    for (const [rarity, minimum, maximum] of [['MAGIC', 1, 2], ['RARE', 3, 4]] as const) {
      const affixes = rollAffixes(kopis, rarity, 4, floorRandom(777));
      expect(affixes.length).toBeGreaterThanOrEqual(minimum);
      expect(affixes.length).toBeLessThanOrEqual(maximum);
      const definitions = affixes.map(affix => ITEM_AFFIXES.find(candidate => candidate.id === affix.id)!);
      expect(definitions.every(affix => affix.validItemTags.some(tag => kopis.tags.includes(tag)))).toBe(true);
      expect(new Set(definitions.map(affix => affix.group)).size).toBe(definitions.length);
      expect(affixes.every((affix, index) => affix.value >= definitions[index].minValue && affix.value <= definitions[index].maxValue)).toBe(true);
    }
    expect(rollAffixes(kopis, 'UNIQUE', 4, floorRandom(1))).toEqual([]);
    expect(rollAffixes(kopis, 'RARE', 1, floorRandom(45)).every(affix => affix.tier === 1)).toBe(true);
    expect(rollItemBase(floorRandom(5), { itemLevel: 1 }).requiredLevel).toBe(1);
    const first = createLootInstance('kopis', 'same-drop-id', 4, 'RARE', floorRandom(49));
    const second = createLootInstance('kopis', 'same-drop-id', 4, 'RARE', floorRandom(49));
    expect(second).toEqual(first);
    expect(first.instanceId).toBe('same-drop-id');
    expect(createLootInstance('kopis', 'early', 1, 'COMMON', floorRandom(1)).value).toBeLessThan(createLootInstance('kopis', 'later', 4, 'COMMON', floorRandom(1)).value);
  });

  it('formats names from prefix, base, and suffix data and safely retains unknown affixes', () => {
    const item = makeItem('kopis', 'name-instance', [
      { id: 'affix_strong_t1', value: 2, tier: 1 },
      { id: 'affix_swift_t1', value: 4, tier: 1 },
      { id: 'future_affix', value: 17 },
    ]);
    expect(describeItem(item)).toBe('Mighty Kopis Swift');
    const result = validateItemInstance(item);
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('Unknown affix future_affix is preserved but inactive.');
  });

  it('applies equipment and affixes to damage, crit, mitigation, and resource caps without accumulating cached values', () => {
    const basePlayer = createPlayerCharacter('BARBARIAN');
    const armor = makeItem('linothorax', 'vital-linen', [
      { id: 'affix_vital_t1', value: 12, tier: 1 },
      { id: 'affix_guarded_t1', value: 2, tier: 1 },
    ]);
    const weapon = makeItem('kopis', 'impact-kopis', [
      { id: 'affix_impact_t1', value: 2, tier: 1 },
      { id: 'affix_precise_t1', value: 3, tier: 1 },
    ]);
    const geared = refreshPlayerDerivedCaps({ ...basePlayer, inventory: [armor, weapon] });
    const withArmor = equipItem(geared, armor.instanceId);
    const withWeapon = equipItem(withArmor, weapon.instanceId);
    const stats = calculateDerivedStats(withWeapon);
    expect(stats.maxHealth).toBeGreaterThan(basePlayer.stats.maxHp);
    expect(stats.armor).toBeGreaterThan(0);
    expect(calculateIncomingDamage(makeEnemy({ damage: 12 }), withWeapon)).toBeLessThan(calculateIncomingDamage(makeEnemy({ damage: 12 }), basePlayer));
    const cleave = getAbility('barbarian_cleave')!;
    expect(calculatePlayerDamage(withWeapon, cleave, 1, 0.99)).toBeGreaterThan(calculatePlayerDamage(basePlayer, cleave, 1, 0.99));
    expect(calculatePlayerDamage(basePlayer, cleave, 1, 0.07)).toBeCloseTo(calculatePlayerDamage(basePlayer, cleave, 1, 0.99));
    expect(calculatePlayerDamage(withWeapon, cleave, 1, 0.07)).toBeGreaterThan(calculatePlayerDamage(withWeapon, cleave, 1, 0.99));
    const bronzeArmor = makeItem('bronze_cuirass', 'medium-bronze');
    expect(calculateDerivedStats({ ...basePlayer, equipment: { ...basePlayer.equipment, torso: bronzeArmor } }).movementSpeedMultiplier).toBeCloseTo(0.96);
    const once = refreshPlayerDerivedCaps(withWeapon);
    const twice = refreshPlayerDerivedCaps(once);
    expect(twice.stats.maxHp).toBe(once.stats.maxHp);
    expect(twice.stats.baseMaxHp).toBe(once.stats.baseMaxHp);
    expect(unequipItem(withWeapon, 'torso').stats.armor).toBe(0);
  });

  it('clamps pathological affixes and ignores unknown, negative, or out-of-range modifiers', () => {
    const player = createPlayerCharacter('SORCERER');
    const pathological = makeItem('chthonic_staff', 'pathological-staff', [
      { id: 'affix_oracular_t2', value: 999_999, tier: 2 },
      { id: 'affix_scorching_t1', value: -999, tier: 1 },
      { id: 'not_in_registry', value: 50_000 },
    ]);
    const derived = calculateDerivedStats({ ...player, equipment: { ...player.equipment, mainHand: pathological } });
    expect(Number.isFinite(derived.spellDamageMultiplier)).toBe(true);
    expect(derived.spellDamageMultiplier).toBe(1);
    expect(derived.fireChance).toBe(0);
    expect(getItemBase('constructor')).toBeUndefined();
    expect(Number.isFinite(calculatePlayerDamage(player, getAbility('sorcerer_arcane_bolt')!, Number.POSITIVE_INFINITY))).toBe(true);
    expect(Number.isFinite(calculatePlayerDamage(player, getAbility('sorcerer_arcane_bolt')!, Number.NaN))).toBe(true);
  });

  it('prevents stacked and two-handed/offhand equipment states', () => {
    const player = createPlayerCharacter('PALADIN');
    const stack = createItemInstance({ id: 'labrys', name: 'Labrys', description: 'Two-handed axe.', type: 'WEAPON', value: 5, visualType: 'axe', quantity: 3 }, 'labrys-stack');
    const equipped = equipItem({ ...player, inventory: [stack] }, stack.instanceId);
    expect(equipped.equipment.mainHand?.quantity).toBe(1);
    expect(equipped.inventory[0].quantity).toBe(2);
    expect(equipped.inventory[0].instanceId).not.toBe(equipped.equipment.mainHand?.instanceId);
    expect(equipped.equipment.offHand).toBeNull();
    const shield = equipped.inventory.find(item => item.type === 'SHIELD');
    if (shield) expect(equipItem(equipped, shield.instanceId)).toBe(equipped);
  });

  it('uses potion identity and declared effect rather than display names', () => {
    const player = createPlayerCharacter('SORCERER');
    const manaPotion = createItemInstance({ id: 'nectar_flask', name: 'A misleading healing draught', description: 'Restores focus.', type: 'POTION', value: 20, consumableEffect: 'HEALTH', quantity: 1 }, 'mana-by-base-id');
    const healthPotion = createItemInstance({ id: 'healing_draught', name: 'A misleading nectar flask', description: 'Restores health.', type: 'POTION', value: 20, quantity: 1 }, 'health-by-base-id');
    const injured = { ...player, stats: { ...player.stats, hp: player.stats.hp - 10, mp: player.stats.mp - 10 }, inventory: [manaPotion, healthPotion] };
    const afterMana = consumePotion(injured, manaPotion.instanceId)!;
    expect(afterMana.stats.hp).toBe(injured.stats.hp);
    expect(afterMana.stats.mp).toBeGreaterThan(injured.stats.mp);
    const afterHealth = consumePotion(afterMana, healthPotion.instanceId)!;
    expect(afterHealth.stats.hp).toBeGreaterThan(afterMana.stats.hp);
    const unknownPotion = { ...manaPotion, id: 'unmapped_potion', baseId: 'unmapped_potion_base', instanceId: 'unknown-potion', consumableEffect: undefined };
    expect(consumePotion({ ...afterHealth, inventory: [unknownPotion] }, unknownPotion.instanceId)).toBeNull();
  });

  it('applies movement, speed, cooldown, mana-cost, and bleed effects in active systems', () => {
    const player = createPlayerCharacter('SORCERER');
    const charm = makeItem('serpent_ring', 'caster-ring', [
      { id: 'affix_channeling_t1', value: 5, tier: 1 },
      { id: 'affix_tempered_t1', value: 4, tier: 1 },
      { id: 'affix_economical_t1', value: 4, tier: 1 },
      { id: 'affix_wandering_t1', value: 4, tier: 1 },
    ]);
    const geared = refreshPlayerDerivedCaps({ ...player, equipment: { ...player.equipment, ring1: charm } });
    const combat = new PlayerCombat();
    const started = combat.start(geared, 'sorcerer_fireburst');
    expect(started.error).toBeUndefined();
    expect(started.player.stats.mp).toBeCloseTo(player.stats.mp - 17.28);
    expect(combat.snapshot().action?.remainingSeconds).toBeCloseTo(0.36 / 1.05);
    expect(combat.getCooldown('sorcerer_fireburst')).toBeCloseTo(6 * 0.96);

    const map = Array.from({ length: 12 }, (_, z) => Array.from({ length: 12 }, (_, x) => x === 0 || z === 0 || x === 11 || z === 11 ? 1 : 0));
    const movementInput = inputFrame({ movement: { forward: 1, strafe: 0, turn: 0 } });
    let base = createPlayerCharacter('BARBARIAN');
    let baseState = createPlayerControllerState();
    let faster: PlayerCharacter = { ...base, equipment: { ...base.equipment, ring1: charm } };
    let fasterState = createPlayerControllerState();
    for (let index = 0; index < 6; index += 1) {
      const baseStep = updatePlayerController(base, baseState, movementInput, map, 0.05);
      const fastStep = updatePlayerController(faster, fasterState, movementInput, map, 0.05);
      base = baseStep.player; baseState = baseStep.state;
      faster = fastStep.player; fasterState = fastStep.state;
    }
    expect(faster.position.x).toBeGreaterThan(base.position.x);

    const bleeding = applyRealtimeStatus([], { statusId: 'BLEED', durationSeconds: 2, magnitude: 3 });
    let bleedTick = { statuses: bleeding, damage: 0 };
    for (let index = 0; index < 4; index += 1) {
      const tick = tickRealtimeStatuses(bleedTick.statuses, 0.25);
      bleedTick = { statuses: tick.statuses, damage: bleedTick.damage + tick.damage };
    }
    expect(bleedTick.damage).toBe(3);
  });

  it('rolls item status procs once per hit and applies life-on-hit and life-on-kill in the runtime', () => {
    const procPlayer = createPlayerCharacter('BARBARIAN');
    const statusCharm = makeItem('serpent_ring', 'status-charm', [
      { id: 'affix_bloodletting_t1', value: 9, tier: 1 },
      { id: 'affix_gaping_t1', value: 18, tier: 1 },
    ]);
    const procStats = calculateDerivedStats({ ...procPlayer, equipment: { ...procPlayer.equipment, ring1: statusCharm } });
    expect(rollItemStatusProc(procStats, () => 0.08)?.statusId).toBe('BLEED');
    expect(rollItemStatusProc(procStats, () => 0.99)).toBeNull();

    const makeRuntimeWithRecovery = (enemyHealth: number, affixId: 'affix_sanguine_t1' | 'affix_predatory_t1') => {
      const runtime = new FPSGameRuntime('BARBARIAN');
      const openMap = Array.from({ length: 10 }, (_, z) => Array.from({ length: 10 }, (_, x) => x === 0 || z === 0 || x === 9 || z === 9 ? 1 : 0));
      runtime.world = { ...runtime.world, map: openMap };
      const ring = makeItem('serpent_ring', 'recovery-ring', [{ id: affixId, value: affixId === 'affix_sanguine_t1' ? 3 : 6, tier: 1 }]);
      runtime.player = refreshPlayerDerivedCaps({
        ...runtime.player,
        position: { x: 2.5, y: 0, z: 2.5 },
        equipment: { ...runtime.player.equipment, ring1: ring },
        stats: { ...runtime.player.stats, hp: 4 },
      });
      runtime.enemies = [makeEnemy({
        id: 'recovery-test-target', position: { x: 3.5, y: 0, z: 2.5 }, health: enemyHealth, maxHealth: Math.max(1, enemyHealth),
        state: 'STAGGER', stateTimer: 10, attackCooldown: 10,
      })];
      runtime.projectiles = [{ id: 901, position: { x: 3.5, y: 0.72, z: 2.5 }, velocity: { x: 0, y: 0, z: 0 }, radius: 0.2, damage: enemyHealth > 1 ? 1 : 100, remainingSeconds: 1, sourceAbilityId: 'ranger_shortbow', color: '#fff', faction: 'PLAYER' }];
      return runtime;
    };
    const onHit = makeRuntimeWithRecovery(100, 'affix_sanguine_t1');
    onHit.update(0.01, inputFrame());
    expect(onHit.player.stats.hp).toBe(7);
    const onKill = makeRuntimeWithRecovery(1, 'affix_predatory_t1');
    onKill.update(0.01, inputFrame());
    expect(onKill.enemies[0].rewardGranted).toBe(true);
    expect(onKill.player.stats.hp).toBe(10);
  });

  it('applies projectile-speed affixes and keeps enemy loot chance tiered with Guardian guarantees', () => {
    const runtime = new FPSGameRuntime('RANGER');
    const openMap = Array.from({ length: 12 }, (_, z) => Array.from({ length: 12 }, (_, x) => x === 0 || z === 0 || x === 11 || z === 11 ? 1 : 0));
    runtime.world = { ...runtime.world, map: openMap };
    runtime.enemies = [];
    runtime.player = { ...runtime.player, position: { x: 2.5, y: 0, z: 2.5 }, rotation: { yaw: 0, pitch: 0 } };
    const charm = makeItem('serpent_ring', 'projectile-ring', [
      { id: 'affix_feathered_t1', value: 9, tier: 1 },
      { id: 'affix_flight_t1', value: 7, tier: 1 },
    ]);
    runtime.player = equipItem({ ...runtime.player, inventory: [charm] }, charm.instanceId);
    const frame = inputFrame({ primaryPressed: true });
    runtime.update(0.05, frame);
    for (let index = 0; index < 7 && runtime.projectiles.length === 0; index += 1) runtime.update(0.05, inputFrame());
    expect(runtime.projectiles[0]?.velocity.x).toBeGreaterThan(18);
    expect(createEnemyDrop(makeEnemy({ lootTier: 'NORMAL' }), 1, () => 0)).not.toBeNull();
    expect(createEnemyDrop(makeEnemy({ lootTier: 'NORMAL' }), 1, () => 0.99)).toBeNull();
    expect(createEnemyDrop(makeEnemy({ lootTier: 'ELITE' }), 1, () => 0)).not.toBeNull();
    const normalRolls = Array.from({ length: 500 }, (_, index) => createEnemyDrop(makeEnemy({ id: 'normal_' + index, lootTier: 'NORMAL' }), 1, floorRandom(index + 1))).filter(Boolean);
    const deepRolls = Array.from({ length: 500 }, (_, index) => createEnemyDrop(makeEnemy({ id: 'deep_' + index, lootTier: 'NORMAL' }), 5, floorRandom(index + 2001))).filter(Boolean);
    const eliteRolls = Array.from({ length: 500 }, (_, index) => createEnemyDrop(makeEnemy({ id: 'elite_' + index, lootTier: 'ELITE' }), 1, floorRandom(index + 1001))).filter(Boolean);
    expect(normalRolls.length).toBeGreaterThan(100);
    expect(normalRolls.length).toBeLessThan(170);
    expect(eliteRolls.length).toBeGreaterThan(320);
    expect(eliteRolls.filter(item => item?.rarity === 'RARE').length).toBeGreaterThan(normalRolls.filter(item => item?.rarity === 'RARE').length);
    expect(deepRolls.filter(item => item?.rarity === 'RARE').length).toBeGreaterThan(normalRolls.filter(item => item?.rarity === 'RARE').length);
    const guardian = createEnemyDrop(makeEnemy({ id: 'guardian-drop', definitionId: 'guardian_serpent_priestess', lootTier: 'GUARDIAN', isBoss: true }), 2, () => 0.99);
    expect(guardian?.baseId).toBe('serpent_fang');
    expect(guardian?.rarity).toBe('RARE');
  });

  it('migrates R2A saves once without changing item IDs or counting armor twice', () => {
    const storage = new MemoryStorage();
    const runtime = new FPSGameRuntime('PALADIN');
    const armor = makeItem('linothorax', 'old-linen', [], 1);
    const shield = makeItem('aspis', 'old-aspis', [], 1);
    runtime.player = refreshPlayerDerivedCaps({
      ...runtime.player,
      equipment: { ...runtime.player.equipment, torso: armor, offHand: shield },
      stats: { ...runtime.player.stats, armor: 5 },
    });
    expect(runtime.save(storage)).toBe(true);
    const v2 = JSON.parse(storage.getItem(MAZE_SAVE_KEY)!) as Record<string, any>;
    v2.version = 2;
    const canonicalEquipment = v2.player.equipment;
    v2.player.equipment = {
      weapon: canonicalEquipment.mainHand,
      armor: canonicalEquipment.torso,
      offhand: canonicalEquipment.offHand,
      accessory: canonicalEquipment.ring1 ?? canonicalEquipment.ring2 ?? canonicalEquipment.neck ?? null,
    };
    v2.player.inventory.push(v2.player.equipment.weapon);
    v2.player.equipment.weapon = makeItem('labrys', 'old-labrys', [], 1);
    delete v2.player.stats.baseMaxHp;
    delete v2.player.stats.baseMaxMp;
    delete v2.player.stats.baseArmor;
    v2.player.stats.armor = 5;
    for (const item of [...v2.player.inventory, ...Object.values(v2.player.equipment).filter(Boolean), ...v2.loot.map((drop: any) => drop.item)] as Array<Record<string, any>>) delete item.baseId;
    for (const enemy of v2.enemies) delete enemy.lootTier;
    const original = JSON.stringify(v2);
    storage.setItem(MAZE_SAVE_KEY, original);

    const loaded = loadMazeGame(storage);
    expect(loaded.invalid).toBe(false);
    expect(loaded.migratedFromR2A).toBe(true);
    expect(loaded.migrationRequired).toBe(true);
    expect(storage.getItem(MAZE_SAVE_KEY)).toBe(original);
    expect(loaded.save?.player.equipment.torso?.instanceId).toBe('old-linen');
    expect(loaded.save?.player.equipment.offHand).toBeNull();
    expect(loaded.save?.player.inventory.some(item => item.instanceId === 'old-aspis')).toBe(true);
    expect(loaded.save?.player.inventory.some(item => item.instanceId === 'player_paladin_paladin_weapon_start' && item.baseId === 'dory_spear')).toBe(true);
    expect(loaded.save?.player.stats.armor).toBe(3);
    expect(loaded.save?.player.stats.baseArmor).toBe(0);
    expect(saveMazeGame(loaded.save!, storage)).toBe(true);
    expect(loadMazeGame(storage).migrationRequired).toBe(false);
    expect(JSON.parse(storage.getItem(MAZE_SAVE_KEY)!).version).toBe(7);
  });
});
