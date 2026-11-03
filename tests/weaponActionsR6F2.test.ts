import { describe, expect, it } from 'vitest';
import { getAbility } from '../combat/AbilityRegistry';
import { calculatePlayerDamage } from '../combat/DamageSystem';
import { getClassSkillKit } from '../data/classSkillKits';
import { ITEM_BASE_BY_ID } from '../data/itemBases';
import { validateWeaponActionRegistry, getWeaponFamilyForItem } from '../data/weaponActionRegistry';
import type { InputFrame } from '../engine/InputSystem';
import { FPSGameRuntime } from '../engine/FPSGameRuntime';
import { PlayerCombat } from '../player/PlayerCombat';
import { createItemInstance, createPlayerCharacter } from '../player/PlayerProgression';
import { getWeaponPresentationPose, getWeaponVisualTypeForPlayer } from '../presentation/WeaponPresenter';
import { resolveActionLoadout } from '../services/actionLoadout';
import { createEmptyEquipment, isTwoHandedItem } from '../services/equipmentRules';
import { syncInventoryGrid } from '../services/inventoryGrid';
import { loadMazeGame, MAZE_SAVE_KEY } from '../services/mazeSave';
import type { ItemInstance, PlayerCharacter } from '../types';
import { TileType } from '../types';

const CLASSES = ['BARBARIAN', 'PALADIN', 'SORCERER', 'ROGUE', 'RANGER', 'CLERIC', 'MONK', 'NECROMANCER'] as const;
const BASES = ['xiphos', 'labyrinth_bow', 'dory_spear', 'oracle_staff'] as const;

const input = (overrides: Partial<InputFrame> = {}): InputFrame => ({
  movement: { forward: 0, strafe: 0, turn: 0 }, lookX: 0, lookY: 0, sprint: false,
  primaryPressed: false, secondaryPressed: false, secondaryDown: false, secondaryReleased: false,
  skillPressed: false, skillSlot: null, dodgePressed: false, interactPressed: false,
  inventoryPressed: false, mapPressed: false, pausePressed: false, ...overrides,
});

const item = (baseId: string, instanceId: string): ItemInstance => {
  const base = ITEM_BASE_BY_ID[baseId];
  if (!base) throw new Error('Missing item base ' + baseId);
  return createItemInstance({ ...base, quantity: 1 }, instanceId);
};

const openMap = (size = 16): number[][] => Array.from({ length: size }, (_, z) => Array.from({ length: size }, (_, x) =>
  x === 0 || z === 0 || x === size - 1 || z === size - 1 ? TileType.WALL : TileType.EMPTY));

function prepareRuntime(classId: PlayerCharacter['classId'], mainHand: ItemInstance | null = null, offHand: ItemInstance | null = null): FPSGameRuntime {
  const runtime = new FPSGameRuntime(classId);
  runtime.world = { ...runtime.world, map: openMap() };
  runtime.enemies = [];
  const equipment = createEmptyEquipment();
  equipment.mainHand = mainHand;
  equipment.offHand = offHand;
  const kit = getClassSkillKit(classId)!;
  runtime.player = {
    ...runtime.player,
    equipment,
    inventory: [],
    inventoryGrid: [],
    position: { x: 2.5, y: 0, z: 2.5 },
    rotation: { yaw: 0, pitch: 0 },
    stats: { ...runtime.player.stats, level: 6, hp: runtime.player.stats.maxHp, mp: runtime.player.stats.maxMp, stamina: 100, staminaRegenDelaySeconds: 0 },
    skills: kit.skills.map(skill => ({ abilityId: skill.abilityId, rank: 1 })),
    skillPoints: 0,
    skillProgressionVersion: 1,
  };
  return runtime;
}

function tick(runtime: FPSGameRuntime, frame: InputFrame = input(), count = 1): void {
  for (let index = 0; index < count; index += 1) runtime.update(0.05, frame);
}

function equipInventory(runtime: FPSGameRuntime, inventory: ItemInstance[]): void {
  runtime.player = { ...runtime.player, inventory, inventoryGrid: syncInventoryGrid(inventory) };
}

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('R6F2 equipment-driven action contract', () => {
  it('validates every canonical weapon family and resolves by base metadata rather than class or item name', () => {
    expect(validateWeaponActionRegistry()).toEqual([]);
    const xiphos = { ...item('xiphos', 'r6f2-xiphos-name'), name: 'A Hunter Bow' };
    expect(getWeaponFamilyForItem(xiphos)).toBe('XIPHOS');
    expect(getWeaponVisualTypeForPlayer({ ...createPlayerCharacter('RANGER'), equipment: { ...createEmptyEquipment(), mainHand: { ...xiphos, visualType: 'bow' } } })).toBe('sword');

    const legacy = { ...xiphos, id: 'old_sword', baseId: undefined, visualType: 'sword' } as ItemInstance;
    expect(getWeaponFamilyForItem(legacy)).toBe('XIPHOS');
    const malformed = { ...legacy, baseId: 'missing_base' } as ItemInstance;
    expect(getWeaponFamilyForItem(malformed)).toBeNull();
  });

  it('resolves the same equipment attacks for every class and keeps all four class skills independent', () => {
    const expected = {
      xiphos: 'weapon_xiphos_slash',
      labyrinth_bow: 'weapon_bow_arrow_shot',
      dory_spear: 'weapon_dory_thrust',
      oracle_staff: 'weapon_staff_focus_bolt',
    } as const;
    for (const classId of CLASSES) {
      const kit = getClassSkillKit(classId)!;
      for (const baseId of BASES) {
        const player = createPlayerCharacter(classId);
        const loadout = resolveActionLoadout({
          ...player,
          equipment: { ...player.equipment, mainHand: item(baseId, `${classId}-${baseId}`), offHand: null },
        });
        expect(loadout.primary.abilityId).toBe(expected[baseId]);
        expect(loadout.classSkills.map(skill => skill.abilityId)).toEqual(kit.skills.map(skill => skill.abilityId));
        expect(loadout.classSkills.every(skill => skill.source === 'CLASS_SKILL')).toBe(true);
      }
      const emptyHand = resolveActionLoadout({ ...createPlayerCharacter(classId), equipment: createEmptyEquipment() });
      expect(emptyHand.primary.abilityId).toBe('weapon_unarmed_fist_strike');
      expect(emptyHand.secondary.abilityId).toBe('weapon_unarmed_heavy_palm');
      expect(emptyHand.classSkills).toHaveLength(4);
    }
  });

  it('starts every class skill at rank 5 with Xiphos, Bow, Dory, Staff and unarmed', () => {
    const weaponByBase = Object.fromEntries(BASES.map(baseId => [baseId, item(baseId, `r6f2-skill-${baseId}`)])) as Record<typeof BASES[number], ItemInstance>;
    for (const classId of CLASSES) {
      const kit = getClassSkillKit(classId)!;
      const rankFiveSkills = kit.skills.map(skill => ({ abilityId: skill.abilityId, rank: 5 }));
      for (const baseId of BASES) {
        const basePlayer = createPlayerCharacter(classId);
        const player = {
          ...basePlayer,
          stats: { ...basePlayer.stats, level: 6, mp: 100, maxMp: 100, stamina: 100 },
          skills: rankFiveSkills,
          equipment: { ...basePlayer.equipment, mainHand: weaponByBase[baseId], offHand: null },
        };
        const loadout = resolveActionLoadout(player);
        expect(loadout.classSkills.map(skill => skill.rank)).toEqual([5, 5, 5, 5]);
        for (const skill of loadout.classSkills) {
          const result = new PlayerCombat().start(player, skill.abilityId, 0, { source: 'CLASS_SKILL' });
          expect(result.error).toBeUndefined();
          expect(result.ability?.id).toBe(skill.abilityId);
        }
      }
      const unarmedBase = createPlayerCharacter(classId);
      const unarmedPlayer = {
        ...unarmedBase,
        stats: { ...unarmedBase.stats, level: 6, mp: 100, maxMp: 100, stamina: 100 },
        skills: rankFiveSkills,
        equipment: createEmptyEquipment(),
      };
      for (const skill of resolveActionLoadout(unarmedPlayer).classSkills) {
        const result = new PlayerCombat().start(unarmedPlayer, skill.abilityId, 0, { source: 'CLASS_SKILL' });
        expect(result.error).toBeUndefined();
        expect(result.ability?.id).toBe(skill.abilityId);
      }
    }
  });

  it('uses Xiphos for a Hunter and a real bow projectile for the Hunter or Myrmidon with a bow', () => {
    const hunterSword = prepareRuntime('RANGER', item('xiphos', 'r6f2-hunter-sword'));
    expect(hunterSword.getSnapshot().primaryAbilityId).toBe('weapon_xiphos_slash');
    tick(hunterSword, input({ primaryPressed: true }));
    expect(hunterSword.getSnapshot().action).toMatchObject({ abilityId: 'weapon_xiphos_slash', actionSource: 'WEAPON', weaponSlot: 'mainHand' });
    tick(hunterSword, input(), 20);
    expect(hunterSword.projectiles).toHaveLength(0);

    for (const classId of ['RANGER', 'BARBARIAN'] as const) {
      const bow = prepareRuntime(classId, item('labyrinth_bow', `r6f2-${classId}-bow`));
      expect(bow.getSnapshot().primaryAbilityId).toBe('weapon_bow_arrow_shot');
      tick(bow, input({ primaryPressed: true }));
      tick(bow, input(), 9);
      expect(bow.projectiles.some(projectile => projectile.sourceAbilityId === 'weapon_bow_arrow_shot')).toBe(true);
      const events = bow.getRenderState().events;
      expect(events.some(event => event.sourceId === 'weapon_bow_arrow_shot' && event.effectId === 'arrow_trail')).toBe(true);
    }
  });

  it('gives Oracle a Dory attack while Oracle skills stay castable, and Hoplite has no phantom shield', () => {
    const oracle = prepareRuntime('SORCERER', item('dory_spear', 'r6f2-oracle-dory'));
    expect(oracle.getSnapshot().primaryAbilityId).toBe('weapon_dory_thrust');
    tick(oracle, input({ skillPressed: true, skillSlot: 1 }));
    expect(oracle.getSnapshot().action).toMatchObject({ abilityId: 'sorcerer_fireburst', actionSource: 'CLASS_SKILL' });

    const hoplite = prepareRuntime('PALADIN', item('dory_spear', 'r6f2-hoplite-dory'));
    tick(hoplite, input({ secondaryPressed: true, secondaryDown: true }));
    expect(hoplite.getSnapshot().action?.abilityId).toBe('weapon_dory_driving_thrust');
    expect(hoplite.getSnapshot().guarding).toBe(false);
    expect(hoplite.getSnapshot().resolvedActionLoadout.secondary.family).toBe('DORY');
  });

  it('preserves shield guard/bash/parry and gives a focus a separate off-hand support action', () => {
    const shield = prepareRuntime('PALADIN', item('xiphos', 'r6f2-shield-sword'), item('aspis', 'r6f2-shield'));
    tick(shield, input({ secondaryPressed: true, secondaryDown: true }));
    expect(shield.getSnapshot().action).toMatchObject({ abilityId: 'offhand_shield_bash', actionSource: 'WEAPON', weaponSlot: 'offHand' });
    expect(shield.getSnapshot().guarding).toBe(true);
    tick(shield, input({ parryPressed: true }));
    expect(shield.getSnapshot().parryWindowSeconds).toBeGreaterThan(0);

    const focus = prepareRuntime('SORCERER', item('xiphos', 'r6f2-focus-sword'), item('sun_focus', 'r6f2-sun-focus'));
    expect(focus.getSnapshot().secondaryAbilityId).toBe('offhand_focus_attune');
    tick(focus, input({ secondaryPressed: true }));
    expect(focus.getSnapshot().action).toMatchObject({ abilityId: 'offhand_focus_attune', actionSource: 'OFFHAND' });
    expect(focus.getSnapshot().guarding).toBe(false);
    expect(focus.getSnapshot().resolvedActionLoadout.secondary.family).toBe('FOCUS');
  });

  it('alternates one-handed attacks only for valid dual wield and keeps two-handed slots locked', () => {
    const dual = prepareRuntime('ROGUE', item('xiphos', 'r6f2-dual-main'), item('kopis', 'r6f2-dual-off'));
    expect(dual.getSnapshot().resolvedActionLoadout.primary).toMatchObject({ abilityId: 'weapon_xiphos_slash', weaponSlot: 'mainHand', alternatesHand: true });
    tick(dual, input({ primaryPressed: true }));
    expect(dual.getSnapshot().action?.weaponSlot).toBe('mainHand');
    expect(dual.getSnapshot().resolvedActionLoadout.primary).toMatchObject({ abilityId: 'weapon_kopis_hooking_cut', weaponSlot: 'offHand' });
    tick(dual, input(), 15);
    tick(dual, input({ primaryPressed: true }));
    expect(dual.getSnapshot().action).toMatchObject({ abilityId: 'weapon_kopis_hooking_cut', weaponSlot: 'offHand', alternatesHand: true });

    const bow = item('labyrinth_bow', 'r6f2-twohand-bow');
    expect(isTwoHandedItem(bow)).toBe(true);
    const twoHanded = prepareRuntime('RANGER', bow);
    expect(twoHanded.getSnapshot().resolvedActionLoadout.primary.alternatesHand).toBe(false);
    expect(twoHanded.player.equipment.offHand).toBeNull();
  });

  it('cancels charge and windup/recovery projectiles atomically on gear swaps while preserving stamina and cooldown', () => {
    const bow = item('labyrinth_bow', 'r6f2-swap-bow');
    const xiphos = item('xiphos', 'r6f2-swap-xiphos');
    const charge = prepareRuntime('RANGER', bow);
    equipInventory(charge, [xiphos]);
    tick(charge, input({ secondaryPressed: true, secondaryDown: true }));
    tick(charge, input({ secondaryDown: true }));
    expect(charge.getSnapshot().chargeProgress).toBeGreaterThan(0);
    expect(charge.equip(xiphos.instanceId).ok).toBe(true);
    expect(charge.getSnapshot().chargeProgress).toBe(0);
    tick(charge, input({ secondaryReleased: true }));
    tick(charge, input(), 12);
    expect(charge.projectiles).toHaveLength(0);
    expect(charge.getSnapshot().primaryAbilityId).toBe('weapon_xiphos_slash');

    const windupBow = item('labyrinth_bow', 'r6f2-windup-bow');
    const windupXiphos = item('xiphos', 'r6f2-windup-xiphos');
    const windup = prepareRuntime('RANGER', windupBow);
    equipInventory(windup, [windupXiphos]);
    const staminaBefore = windup.player.stats.stamina!;
    tick(windup, input({ primaryPressed: true }));
    expect(windup.getSnapshot().action?.phase).toBe('WINDUP');
    const cooldownBeforeSwap = windup.getSnapshot().primaryCooldown;
    expect(windup.equip(windupXiphos.instanceId).ok).toBe(true);
    expect(windup.getSnapshot().action).toBeNull();
    expect(windup.player.stats.stamina).toBeLessThan(staminaBefore);
    const returnedBow = windup.player.inventory.find(candidate => candidate.baseId === 'labyrinth_bow')!;
    expect(windup.equip(returnedBow.instanceId).ok).toBe(true);
    expect(windup.getSnapshot().primaryCooldown).toBeCloseTo(cooldownBeforeSwap);
    tick(windup, input(), 12);
    expect(windup.projectiles).toHaveLength(0);

    const recoveryBow = item('labyrinth_bow', 'r6f2-recovery-bow');
    const recoveryXiphos = item('xiphos', 'r6f2-recovery-xiphos');
    const recovery = prepareRuntime('RANGER', recoveryBow);
    equipInventory(recovery, [recoveryXiphos]);
    tick(recovery, input({ secondaryPressed: true, secondaryDown: true }));
    tick(recovery, input({ secondaryDown: true }), 9);
    tick(recovery, input({ secondaryReleased: true }));
    for (let frame = 0; frame < 12 && recovery.getSnapshot().action?.phase !== 'RECOVERY'; frame += 1) tick(recovery, input());
    expect(recovery.getSnapshot().action?.phase).toBe('RECOVERY');
    expect(recovery.projectiles.length).toBeGreaterThan(0);
    const chargedCooldown = recovery.getSnapshot().secondaryCooldown;
    expect(recovery.equip(recoveryXiphos.instanceId).ok).toBe(true);
    expect(recovery.getSnapshot().action).toBeNull();
    expect(recovery.projectiles).toHaveLength(0);
    const returnedRecoveryBow = recovery.player.inventory.find(candidate => candidate.baseId === 'labyrinth_bow')!;
    expect(recovery.equip(returnedRecoveryBow.instanceId).ok).toBe(true);
    expect(recovery.getSnapshot().secondaryCooldown).toBeCloseTo(chargedCooldown);
  });

  it('keeps skill rank saves stable and prevents class skills from borrowing weapon base power', () => {
    const noWeapon = createPlayerCharacter('RANGER');
    const geared: PlayerCharacter = {
      ...noWeapon,
      equipment: { ...noWeapon.equipment, mainHand: { ...item('labrys', 'r6f2-damage-labrys'), value: 99 } },
    };
    const skill = getAbility('ranger_volley')!;
    expect(calculatePlayerDamage(geared, skill, 1, 1, 'mainHand', false)).toBe(calculatePlayerDamage(noWeapon, skill, 1, 1, 'mainHand', false));

    const runtime = new FPSGameRuntime('RANGER');
    runtime.player = { ...runtime.player, stats: { ...runtime.player.stats, level: 6 }, skills: [{ abilityId: 'ranger_volley', rank: 5 }, { abilityId: 'ranger_piercing_hunt', rank: 2 }], skillProgressionVersion: 1 };
    const storage = new MemoryStorage();
    expect(runtime.save(storage)).toBe(true);
    const loaded = loadMazeGame(storage);
    expect(loaded.invalid).toBe(false);
    expect(loaded.save?.version).toBe(8);
    expect(loaded.save?.player.skills).toEqual([{ abilityId: 'ranger_volley', rank: 5 }, { abilityId: 'ranger_piercing_hunt', rank: 2 }]);
    expect(JSON.parse(storage.getItem(MAZE_SAVE_KEY)!).version).toBe(8);
  });

  it('uses a weapon-neutral viewmodel gesture for class projectiles and preserves weapon-specific bows', () => {
    const neutralSkill = getWeaponPresentationPose({
      weapon: 'sword', animationProfile: 'CLASS_SKILL', abilityId: 'ranger_volley', phase: 'WINDUP', remainingSeconds: 0.1,
      moving: false, guarding: false, hasShield: false, elapsedSeconds: 0, offHandPose: 'empty',
    });
    const bowDraw = getWeaponPresentationPose({
      weapon: 'bow', animationProfile: 'BOW', abilityId: 'weapon_bow_arrow_shot', phase: 'WINDUP', remainingSeconds: 0.1,
      moving: false, guarding: false, hasShield: false, elapsedSeconds: 0, offHandPose: 'bowDraw',
    });
    expect(neutralSkill.weaponZ).toBe(-1.05);
    expect(bowDraw.weaponScaleX).toBeGreaterThan(0.72);
  });

  it('keeps the captured off-hand swing distinct between Kopis and Daggers', () => {
    const offhandPose = (abilityId: string, animationProfile: 'KOPIS' | 'DAGGERS') => getWeaponPresentationPose({
      weapon: 'dagger', abilityId, phase: 'WINDUP', remainingSeconds: 0, moving: false,
      guarding: false, hasShield: false, elapsedSeconds: 1, actionHand: 'offHand', animationProfile,
    });
    const kopis = offhandPose('weapon_kopis_hooking_cut', 'KOPIS');
    const daggers = offhandPose('weapon_daggers_quick_stab', 'DAGGERS');
    expect(kopis.offHandRotationZ).not.toBe(daggers.offHandRotationZ);
    expect(kopis.offHandY).not.toBe(daggers.offHandY);
  });
});
