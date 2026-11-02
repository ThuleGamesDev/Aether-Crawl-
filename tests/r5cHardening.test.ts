import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SkillUpgradeScreen from '../components/SkillUpgradeScreen';
import { abilityTooltip, getAbility } from '../combat/AbilityRegistry';
import { ACTION_SPEED_RULES, combineActionSpeedMultipliers, isValidEffectiveActionSpeedMultiplier, MAX_EFFECTIVE_ACTION_SPEED_MULTIPLIER } from '../combat/actionSpeed';
import { applyRealtimeStatus } from '../combat/StatusSystem';
import { UNIQUE_ITEMS, getUniqueItem, MAX_UNIQUE_EFFECT_STATE_COUNT, UNIQUE_EFFECT_STATE_SAFETY_LIMIT } from '../data/uniqueItems';
import { calculateDerivedStats } from '../player/DerivedStats';
import { createPlayerCharacter } from '../player/PlayerProgression';
import { FPSGameRuntime, formatLootDropToast } from '../engine/FPSGameRuntime';
import { InputSystem, type InputFrame } from '../engine/InputSystem';
import { loadMazeGame, MAZE_SAVE_KEY, isMazeRunSave } from '../services/mazeSave';
import { shouldReleasePointerLockForUi, type UiCursorState } from '../services/uiInputPolicy';
import { getItemBase } from '../data/itemBases';
import type { KeyValueStorage } from '../services/fpsSave';
import type { MazeRunSave } from '../services/mazeSave';
import type { ItemInstance } from '../types';

class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function emptyInput(overrides: Partial<InputFrame> = {}): InputFrame {
  return {
    movement: { forward: 0, strafe: 0, turn: 0 }, lookX: 0, lookY: 0, sprint: false,
    primaryPressed: false, secondaryPressed: false, secondaryDown: false, secondaryReleased: false,
    skillPressed: false, skillSlot: null, dodgePressed: false, interactPressed: false,
    inventoryPressed: false, mapPressed: false, pausePressed: false, ...overrides,
  };
}

function validSave(): MazeRunSave {
  const storage = new MemoryStorage();
  const runtime = new FPSGameRuntime('BARBARIAN');
  if (!runtime.save(storage)) throw new Error('Could not create a valid test save.');
  return JSON.parse(storage.getItem(MAZE_SAVE_KEY)!) as MazeRunSave;
}

function collectSkillButtons(node: React.ReactNode, result: Array<React.ReactElement<{ className?: string; onClick?: () => void }>> = []) {
  if (Array.isArray(node)) {
    node.forEach(child => collectSkillButtons(child, result));
    return result;
  }
  if (!React.isValidElement(node)) return result;
  if (node.type === 'button') result.push(node as React.ReactElement<{ className?: string; onClick?: () => void }>);
  React.Children.forEach((node.props as { children?: React.ReactNode }).children, child => collectSkillButtons(child, result));
  return result;
}

function cursorState(overrides: Partial<UiCursorState> = {}): UiCursorState {
  return { inventoryOpen: false, mapOpen: false, paused: false, levelUpOpen: false, roomOfferOpen: false, gameOver: false, ...overrides };
}

class EventSurface {
  private readonly listeners = new Map<string, Set<(event: any) => void>>();
  addEventListener(type: string, listener: (event: any) => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, listener: (event: any) => void) { this.listeners.get(type)?.delete(listener); }
  emit(type: string, event: Record<string, any> = {}) { for (const listener of this.listeners.get(type) ?? []) listener(event); }
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('R5C save, input, and hotpath hardening', () => {
  it('derives one shared action-speed bound from item and haste rules', () => {
    expect(combineActionSpeedMultipliers(ACTION_SPEED_RULES.derivedMaximum, 1 + ACTION_SPEED_RULES.maximumHasteBonus))
      .toBeCloseTo(MAX_EFFECTIVE_ACTION_SPEED_MULTIPLIER);
    expect(MAX_EFFECTIVE_ACTION_SPEED_MULTIPLIER).toBeCloseTo(2.3625);
    expect(isValidEffectiveActionSpeedMultiplier(MAX_EFFECTIVE_ACTION_SPEED_MULTIPLIER)).toBe(true);
    expect(isValidEffectiveActionSpeedMultiplier(0.5)).toBe(true);
    expect(isValidEffectiveActionSpeedMultiplier(MAX_EFFECTIVE_ACTION_SPEED_MULTIPLIER + 0.001)).toBe(false);
    expect(isValidEffectiveActionSpeedMultiplier(Number.NaN)).toBe(false);
    expect(isValidEffectiveActionSpeedMultiplier(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('round-trips an active max-speed HASTE action through the unchanged v4 save exactly once', () => {
    const runtime = new FPSGameRuntime('BARBARIAN');
    const weapon = runtime.player.equipment.weapon;
    if (!weapon) throw new Error('The boundary fixture requires the Barbarian starting weapon.');
    const maxSpeedWeapon: ItemInstance = {
      ...weapon,
      affixes: Array.from({ length: 15 }, () => ({ id: 'affix_swift_t1', value: 5, tier: 1 })),
    };
    runtime.player = {
      ...runtime.player,
      equipment: { ...runtime.player.equipment, weapon: maxSpeedWeapon },
      statusEffects: applyRealtimeStatus([], {
        statusId: 'HASTE', durationSeconds: 6, magnitude: ACTION_SPEED_RULES.maximumHasteBonus,
      }, 'r5c_speed_boundary'),
    };
    expect(calculateDerivedStats(runtime.player).attackSpeedMultiplier).toBeCloseTo(ACTION_SPEED_RULES.derivedMaximum);

    runtime.update(0.05, emptyInput({ primaryPressed: true }));
    for (let index = 0; index < 10 && runtime.getSnapshot().action?.phase !== 'ACTIVE'; index += 1) {
      runtime.update(0.01, emptyInput());
    }
    const active = runtime.getSnapshot().action;
    expect(active?.phase).toBe('ACTIVE');
    expect(active?.speedMultiplier).toBeCloseTo(MAX_EFFECTIVE_ACTION_SPEED_MULTIPLIER);

    const storage = new MemoryStorage();
    expect(runtime.save(storage)).toBe(true);
    const loaded = loadMazeGame(storage);
    expect(loaded.invalid).toBe(false);
    expect(loaded.save?.version).toBe(4);
    expect(loaded.save?.combat?.action).toEqual(active);

    const resumed = new FPSGameRuntime('BARBARIAN', loaded.save!);
    expect(resumed.getSnapshot().action).toEqual(active);
    resumed.update(0.01, emptyInput());
    expect(resumed.getSnapshot().action?.speedMultiplier).toBeCloseTo(MAX_EFFECTIVE_ACTION_SPEED_MULTIPLIER);
    expect(resumed.save(storage)).toBe(true);
    expect(loadMazeGame(storage).save?.combat?.action?.speedMultiplier).toBeCloseTo(MAX_EFFECTIVE_ACTION_SPEED_MULTIPLIER);
  });

  it('validates unique timers from each catalog entry and rejects malformed or unknown state', () => {
    expect(MAX_UNIQUE_EFFECT_STATE_COUNT).toBe(Math.min(UNIQUE_ITEMS.length, UNIQUE_EFFECT_STATE_SAFETY_LIMIT));
    const ember = getUniqueItem('promethean_ember')!;
    const laurel = getUniqueItem('laurel_asclepius')!;
    const save = validSave();
    const atCatalogBounds: MazeRunSave = {
      ...save,
      player: {
        ...save.player,
        uniqueEffectStates: [
          { effectId: ember.effectId, cooldownRemaining: ember.stateBounds.cooldownSeconds, durationRemaining: ember.stateBounds.durationSeconds, charges: ember.stateBounds.charges },
          { effectId: laurel.effectId, cooldownRemaining: laurel.stateBounds.cooldownSeconds, durationRemaining: laurel.stateBounds.durationSeconds, charges: laurel.stateBounds.charges },
        ],
      },
    };
    expect(isMazeRunSave(atCatalogBounds)).toBe(true);
    expect(isMazeRunSave({ ...atCatalogBounds, player: { ...atCatalogBounds.player, uniqueEffectStates: [{ ...atCatalogBounds.player.uniqueEffectStates![0], durationRemaining: ember.stateBounds.durationSeconds + 0.001 }] } })).toBe(false);
    expect(isMazeRunSave({ ...atCatalogBounds, player: { ...atCatalogBounds.player, uniqueEffectStates: [{ ...atCatalogBounds.player.uniqueEffectStates![1], cooldownRemaining: laurel.stateBounds.cooldownSeconds + 0.001 }] } })).toBe(false);
    expect(isMazeRunSave({ ...save, player: { ...save.player, uniqueEffectStates: [{ effectId: 'foreign_unique' as never, cooldownRemaining: 1, durationRemaining: 1, charges: 0 }] } })).toBe(false);
    expect(isMazeRunSave({ ...save, player: { ...save.player, uniqueEffectStates: [{ effectId: ember.effectId, cooldownRemaining: Number.NaN, durationRemaining: 1, charges: 1 }] } })).toBe(false);
    expect(isMazeRunSave({ ...atCatalogBounds, player: { ...atCatalogBounds.player, uniqueEffectStates: [atCatalogBounds.player.uniqueEffectStates![0], atCatalogBounds.player.uniqueEffectStates![0]] } })).toBe(false);
  });

  it('releases cursor and held input for every blocking overlay, including an auto-opened level-up', () => {
    expect(shouldReleasePointerLockForUi(cursorState())).toBe(false);
    for (const key of ['inventoryOpen', 'mapOpen', 'paused', 'levelUpOpen', 'roomOfferOpen', 'gameOver'] as const) {
      expect(shouldReleasePointerLockForUi(cursorState({ [key]: true }))).toBe(true);
    }

    const seed = new FPSGameRuntime('BARBARIAN');
    const player = { ...seed.player, skillPoints: 1, skillProgressionVersion: 1 as const };
    const runtime = new FPSGameRuntime('BARBARIAN', {
      player, world: seed.world, enemies: seed.enemies, loot: [], combat: { cooldowns: {}, action: null },
    });
    const snapshot = runtime.getSnapshot();
    expect(snapshot.levelUpOpen).toBe(true);
    expect(shouldReleasePointerLockForUi(cursorState({ levelUpOpen: snapshot.levelUpOpen }))).toBe(true);
    const tree = SkillUpgradeScreen({
      player: snapshot.player,
      options: snapshot.skillUpgradeChoices,
      onChoose: abilityId => { runtime.chooseSkillUpgrade(abilityId); },
      onLater: () => runtime.deferSkillUpgrade(),
    });
    const choice = collectSkillButtons(tree).find(button => button.props.className === 'fps-skill-choice');
    expect(choice?.props.onClick).toBeTypeOf('function');
    choice?.props.onClick?.();
    expect(runtime.player.skillPoints).toBe(0);
    expect(runtime.getSnapshot().levelUpOpen).toBe(false);
    expect(shouldReleasePointerLockForUi(cursorState())).toBe(false);
  });

  it('lets Escape defer a level-up without changing an already-paused run state', () => {
    const seed = new FPSGameRuntime('BARBARIAN');
    const runtime = new FPSGameRuntime('BARBARIAN', {
      player: { ...seed.player, skillPoints: 1, skillProgressionVersion: 1 },
      world: seed.world, enemies: seed.enemies, loot: [], combat: { cooldowns: {}, action: null },
    });
    runtime.paused = true;
    runtime.update(0.05, emptyInput({ pausePressed: true }));
    expect(runtime.getSnapshot().levelUpOpen).toBe(false);
    expect(runtime.paused).toBe(true);
    expect(runtime.player.skillPoints).toBe(1);
    runtime.paused = false;
    expect(shouldReleasePointerLockForUi(cursorState({ paused: runtime.paused }))).toBe(false);
  });

  it('unlocks pointer and clears held mouse and movement state during UI handoff', () => {
    const browserWindow = new EventSurface();
    let exitCount = 0;
    const browserDocument = Object.assign(new EventSurface(), {
      pointerLockElement: null as unknown as HTMLCanvasElement | null,
      exitPointerLock() { exitCount += 1; this.pointerLockElement = null; },
    });
    const canvas = Object.assign(new EventSurface(), {
      clientWidth: 200,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }),
      setPointerCapture: () => undefined,
      requestPointerLock: () => Promise.resolve(),
    });
    vi.stubGlobal('window', browserWindow);
    vi.stubGlobal('document', browserDocument);
    const input = new InputSystem(canvas as unknown as HTMLCanvasElement, () => 0.0025);
    browserDocument.pointerLockElement = canvas as unknown as HTMLCanvasElement;
    browserWindow.emit('keydown', { code: 'KeyW', repeat: false, preventDefault: () => undefined });
    canvas.emit('mousedown', { button: 0, clientX: 10, clientY: 10 });
    canvas.emit('mousedown', { button: 2, clientX: 10, clientY: 10 });
    input.handoffToUi();
    expect(exitCount).toBe(1);
    expect(browserDocument.pointerLockElement).toBeNull();
    expect(input.readFrame()).toMatchObject({
      movement: { forward: 0, strafe: 0 }, primaryPressed: false, secondaryPressed: false,
      secondaryDown: false, secondaryCanceled: true,
    });
    browserWindow.emit('mouseup', { button: 0 });
    expect(input.readFrame().primaryPressed).toBe(false);
    input.dispose();
  });

  it('keeps loot prompt singular/plural, chain counts, fan angles, and status timing accurate', () => {
    expect(formatLootDropToast(1)).toBe('Loot dropped. Press E to collect it.');
    expect(formatLootDropToast(2)).toBe('Loot dropped. Press E to collect them.');
    expect(abilityTooltip(getAbility('sorcerer_storm_invocation')!)).toContain('two additional foes');
    expect(abilityTooltip(getAbility('ranger_volley')!)).toContain('11° total fan');
    const stagger = abilityTooltip(getAbility('barbarian_ground_slam')!);
    expect(stagger).toContain('stagger · 0.7s');
    expect(stagger).not.toContain('per tick');
    expect(abilityTooltip(getAbility('rogue_venomous_cut')!)).toContain('2 per tick');
  });

  it('performs only one necessary looked-at-loot search per active snapshot', () => {
    const runtime = new FPSGameRuntime('BARBARIAN');
    const subject = runtime as unknown as { getLookedAtLoot: () => null };
    const scan = vi.spyOn(subject, 'getLookedAtLoot').mockReturnValue(null);
    const snapshot = runtime.getSnapshot() as unknown as Record<string, unknown>;
    expect(scan).toHaveBeenCalledTimes(1);
    expect('targetLoot' in snapshot).toBe(false);
  });

  it('hoists item-tag lookup without changing derived equipment statistics', () => {
    const base = getItemBase('bronze_signet')!;
    const affixes = [
      { id: 'affix_swift_t1', value: 5, tier: 1 },
      { id: 'affix_tempered_t1', value: 4, tier: 1 },
    ];
    const signet: ItemInstance = { ...base, instanceId: 'r5c_signet', itemLevel: 1, rarity: 'MAGIC', affixes, quantity: 1 };
    const player = createPlayerCharacter('BARBARIAN');
    const withSignet = { ...player, equipment: { ...player.equipment, accessory: signet } };
    const derived = calculateDerivedStats(withSignet);
    expect(derived.attackSpeedMultiplier).toBeCloseTo(1.05);
    expect(derived.cooldownMultiplier).toBeCloseTo(0.96);
    expect(withSignet.equipment.accessory?.affixes).toEqual(affixes);
  });
});
