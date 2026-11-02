import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import atlasManifest from '../data/generated/mythicVfxAtlas.json';
import { getEnemyAttackTelegraphDescriptor, getGuardianTelegraphEffect } from '../data/enemyAttackTelegraph';
import { ENEMY_ATTACK_SETS } from '../data/enemyAttacks';
import { VFXSystem } from '../presentation/VFXSystem';
import {
  chooseVfxSlot,
  getEnemyVfxSurface,
  getTileVfxSurface,
  getVfxModeCount,
  getVfxPoolCapacity,
  isValidVfxLayerTiming,
  resolveSurfaceEffect,
  VFX_DEFINITIONS,
  type VFXInstance,
} from '../presentation/vfxDefinitions';
import { AssetManager } from '../presentation/AssetManager';
import { updateProjectiles, isVisibleProjectileImpact } from '../combat/ProjectileSystem';
import { FPSGameRuntime } from '../engine/FPSGameRuntime';
import type { InputFrame } from '../engine/InputSystem';
import { TileType, type WorldProjectile } from '../types';

describe('R3B mythic VFX definitions and runtime', () => {
  it('registers the twelve required families with valid static atlas frames and lifetimes', () => {
    const required = [
      'bronze_slash', 'dory_thrust', 'aspis_impact', 'blood_hit', 'arachne_venom', 'web_snare',
      'promethean_flame', 'stone_shockwave', 'oracle_spark', 'chthonic_bolt', 'guardian_sigil', 'guardian_death',
    ];
    for (const id of required) expect(VFX_DEFINITIONS[id as keyof typeof VFX_DEFINITIONS], id).toBeDefined();
    for (const definition of Object.values(VFX_DEFINITIONS)) {
      expect(definition.maxCount).toBeGreaterThan(0);
      expect(definition.layers.length).toBeGreaterThan(0);
      for (const layer of definition.layers) {
        expect(isValidVfxLayerTiming(layer.lifetimeSeconds, layer.size), definition.id).toBe(true);
        expect(atlasManifest.frames[layer.frame as keyof typeof atlasManifest.frames], definition.id + '.' + layer.frame).toBeDefined();
      }
    }
    expect(Object.values(VFX_DEFINITIONS).flatMap(definition => definition.layers).some(layer => layer.kind === 'LINGERING_AREA')).toBe(false);
  });

  it('rejects zero, negative, and non-finite visual lifetimes or sizes', () => {
    expect(isValidVfxLayerTiming(0.2, 0.4)).toBe(true);
    expect(isValidVfxLayerTiming(0, 0.4)).toBe(false);
    expect(isValidVfxLayerTiming(-0.1, 0.4)).toBe(false);
    expect(isValidVfxLayerTiming(Number.POSITIVE_INFINITY, 0.4)).toBe(false);
    expect(isValidVfxLayerTiming(0.2, Number.NaN)).toBe(false);
  });

  it('keeps mobile and desktop capacities fixed and scales reduced-mode budgets', () => {
    expect(getVfxPoolCapacity(true)).toBe(24);
    expect(getVfxPoolCapacity(false)).toBe(48);
    expect(getVfxModeCount('reduced', 7, 'ordinary_hit')).toBe(4);
    expect(getVfxModeCount('reduced', 0, 'ordinary_hit')).toBe(0);
    expect(getVfxModeCount('reduced', 4, 'ambience')).toBe(0);
    expect(getVfxModeCount('off', 4, 'critical_hit')).toBe(0);
    expect(getVfxModeCount('reduced', 1, 'guardian_telegraph')).toBe(1);
  });

  it('replaces ambience before ordinary and critical hits while preserving higher-priority slots', () => {
    const slots = [
      { active: true, priority: 'critical_hit' as const, age: 5 },
      { active: true, priority: 'ordinary_hit' as const, age: 2 },
      { active: true, priority: 'ambience' as const, age: 1 },
    ];
    expect(chooseVfxSlot(slots, 'critical_hit')).toBe(2);
    expect(chooseVfxSlot(slots, 'guardian_telegraph')).toBe(2);
    expect(chooseVfxSlot(slots.slice(0, 2), 'ordinary_hit')).toBe(1);
    expect(chooseVfxSlot([{ active: true, priority: 'guardian_telegraph', age: 4 }], 'critical_hit')).toBe(-1);
  });

  it('maps only known enemy and tile materials to specific impact effects', () => {
    expect(getEnemyVfxSurface('guardian_bronze_gatekeeper')).toBe('metal');
    expect(getEnemyVfxSurface('guardian_cyclopean_mason')).toBe('stone');
    expect(getEnemyVfxSurface('giant_rat')).toBe('organic');
    expect(getTileVfxSurface(TileType.DOOR)).toBe('metal');
    expect(getTileVfxSurface(TileType.WALL)).toBe('stone');
    expect(getTileVfxSurface(undefined)).toBe('stone');
    expect(resolveSurfaceEffect('metal')).toBe('metal_sparks');
    expect(resolveSurfaceEffect('stone')).toBe('stone_chips');
    expect(resolveSurfaceEffect('water')).toBe('water_splash');
  });

  it('matches Guardian attack warning geometry to the actual damage radius and target center', () => {
    const cone = ENEMY_ATTACK_SETS.serpent_priestess.find(attack => attack.id === 'priestess_fang_cone')!;
    const coneDescriptor = getEnemyAttackTelegraphDescriptor(cone);
    expect(coneDescriptor.kind).toBe('arc');
    expect(coneDescriptor.radius).toBe(cone.range + 0.28);
    expect(coneDescriptor.arcRadians).toBe(cone.arcRadians);

    const slam = ENEMY_ATTACK_SETS.cyclopean_mason.find(attack => attack.id === 'mason_shockwave')!;
    expect(getEnemyAttackTelegraphDescriptor(slam).radius).toBe(slam.radius);

    const sigil = ENEMY_ATTACK_SETS.threadbound_warden.find(attack => attack.id === 'warden_thread_sigil')!;
    expect(getEnemyAttackTelegraphDescriptor(sigil)).toMatchObject({ center: 'target', radius: sigil.radius, groundProjection: true });
  });

  it('selects the authored tell for the Serpent, Cyclopean, Lamia, and Warden windups', () => {
    expect(getGuardianTelegraphEffect('serpent_priestess', ENEMY_ATTACK_SETS.serpent_priestess.find(attack => attack.id === 'priestess_fang_cone')!)).toBe('serpent_cone');
    expect(getGuardianTelegraphEffect('cyclopean_mason', ENEMY_ATTACK_SETS.cyclopean_mason.find(attack => attack.id === 'mason_shockwave')!)).toBe('cyclopean_shockwave');
    expect(getGuardianTelegraphEffect('lamia', ENEMY_ATTACK_SETS.lamia.find(attack => attack.id === 'lamia_lunge')!)).toBe('lamia_lunge_trace');
    expect(getGuardianTelegraphEffect('threadbound_warden', ENEMY_ATTACK_SETS.threadbound_warden.find(attack => attack.id === 'warden_thread_sigil')!)).toBe('warden_delayed_sigil');
  });

  it('emits one material-specific projectile wall impact and suppresses range expiry visuals', () => {
    const map: number[][] = Array.from({ length: 7 }, (_, z) => Array.from({ length: 7 }, (_, x) => x === 0 || z === 0 || x === 6 || z === 6 ? TileType.WALL : TileType.EMPTY));
    map[2][2] = TileType.DOOR;
    const projectile: WorldProjectile = {
      id: 7,
      position: { x: 1.5, y: 0.72, z: 2.5 },
      velocity: { x: 18, y: 0, z: 0 },
      radius: 0.1,
      damage: 8,
      remainingSeconds: 1,
      sourceAbilityId: 'sorcerer_arcane_bolt',
      color: '#efd18a',
      faction: 'PLAYER',
    };
    const contact = updateProjectiles([projectile], [], map, 0.05);
    expect(contact.impacts).toHaveLength(1);
    expect(contact.impacts[0]).toMatchObject({ kind: 'world', surface: 'metal' });
    expect(isVisibleProjectileImpact(contact.impacts[0])).toBe(true);
    expect(updateProjectiles(contact.projectiles, [], map, 0.05).impacts).toHaveLength(0);

    const expired = updateProjectiles([{ ...projectile, position: { x: 3.5, y: 0.72, z: 3.5 }, velocity: { x: 0, y: 0, z: 0 }, remainingSeconds: 0.01 }], [], map, 0.05);
    expect(expired.impacts).toHaveLength(1);
    expect(expired.impacts[0].kind).toBe('range');
    expect(isVisibleProjectileImpact(expired.impacts[0])).toBe(false);
  });

  it('emits an enemy death and reward release once across later simulation ticks', () => {
    const runtime = new FPSGameRuntime('PALADIN');
    const map: number[][] = Array.from({ length: 9 }, (_, z) => Array.from({ length: 9 }, (_, x) => x === 0 || z === 0 || x === 8 || z === 8 ? TileType.WALL : TileType.EMPTY));
    runtime.world = { ...runtime.world, map };
    runtime.player = { ...runtime.player, position: { x: 3.5, y: 0, z: 3.5 }, rotation: { ...runtime.player.rotation, yaw: 0, pitch: 0 } };
    const target = runtime.enemies[0];
    runtime.enemies = [{
      ...target,
      id: 'r3b-one-shot-target',
      definitionId: 'giant_rat',
      visualId: 'giant_rat',
      position: { x: 4, y: 0, z: 3.5 },
      health: 1,
      maxHealth: 12,
      state: 'RECOVER',
      stateTimer: 5,
      attackCooldown: 99,
      rewardGranted: false,
      lootTier: 'GUARDIAN',
      isBoss: false,
    }];
    runtime.projectiles = [{
      id: 900,
      position: { x: 3.5, y: 0.72, z: 3.5 },
      velocity: { x: 6, y: 0, z: 0 },
      radius: 0.1,
      damage: 9,
      remainingSeconds: 1,
      sourceAbilityId: 'sorcerer_arcane_bolt',
      color: '#efd18a',
      faction: 'PLAYER',
    }];
    const input: InputFrame = {
      movement: { forward: 0, strafe: 0, turn: 0 }, lookX: 0, lookY: 0, sprint: false,
      primaryPressed: false, secondaryPressed: false, secondaryDown: false, secondaryReleased: false,
      skillPressed: false, skillSlot: null, dodgePressed: false, interactPressed: false,
      inventoryPressed: false, mapPressed: false, pausePressed: false,
    };

    runtime.update(0.05, input);
    const firstEvents = runtime.getRenderState().events;
    expect(firstEvents.filter(event => event.kind === 'enemyDeath')).toHaveLength(1);
    expect(runtime.loot.some(drop => drop.position.x === 4 && drop.position.z === 3.5)).toBe(true);
    runtime.update(0.05, input);
    expect(runtime.getRenderState().events.filter(event => event.kind === 'enemyDeath')).toHaveLength(0);
    expect(runtime.enemies.find(enemy => enemy.id === 'r3b-one-shot-target')?.rewardGranted).toBe(true);
  });

  it('uses a bounded, world-space pool, freezes on pause, clears on floor changes, and honors Off', () => {
    const scene = new THREE.Scene();
    const assets = new AssetManager();
    const system = new VFXSystem(scene, assets, 3);
    const internal = system as unknown as {
      slots: Array<{ mesh: THREE.Mesh; instance: VFXInstance | null }>;
      slotSnapshots: Array<{ active: boolean; priority: string; age: number }>;
    };
    const position = { x: 4, y: 0.7, z: 8 };
    const snapshotArray = internal.slotSnapshots;
    const snapshotObjects = snapshotArray.slice();
    const slotMap = vi.spyOn(internal.slots, 'map');

    for (let index = 0; index < 12; index += 1) {
      system.emit('blood_hit', position, { ownerId: 'enemy-1', sourceId: 'spear' });
    }
    expect(slotMap).not.toHaveBeenCalled();
    expect(internal.slotSnapshots).toBe(snapshotArray);
    expect(internal.slotSnapshots.every((snapshot, index) => snapshot === snapshotObjects[index])).toBe(true);
    slotMap.mockRestore();
    expect(internal.slots).toHaveLength(3);
    expect(scene.children).toHaveLength(3);
    expect(internal.slots.every(slot => slot.instance?.space === 'world')).toBe(true);
    expect(internal.slots.some(slot => slot.instance?.ownerId === 'enemy-1')).toBe(true);
    const activeBeforePause = internal.slots.find(slot => slot.instance)!;
    const lifetimeBeforePause = activeBeforePause.instance!.remainingSeconds;
    const positionBeforePause = activeBeforePause.mesh.position.clone();
    system.update(0.05, 0.4, true);
    expect(activeBeforePause.instance!.remainingSeconds).toBe(lifetimeBeforePause);
    expect(activeBeforePause.mesh.position.equals(positionBeforePause)).toBe(true);
    system.update(0.05, 0.4, false);
    expect(activeBeforePause.instance!.remainingSeconds).toBeLessThan(lifetimeBeforePause);

    system.clear();
    expect(internal.slots.every(slot => slot.instance === null && !slot.mesh.visible)).toBe(true);
    system.setMode('off');
    system.emit('guardian_death', position);
    expect(internal.slots.every(slot => !slot.mesh.visible)).toBe(true);

    system.dispose();
    expect(scene.children).toHaveLength(0);
    assets.dispose();
  });

  it('returns a texture fallback when the local atlas image API is unavailable', () => {
    const assets = new AssetManager();
    const texture = assets.vfxTexture('blood_hit');
    expect(texture).toBeInstanceOf(THREE.Texture);
    assets.dispose();
  });

  it('keeps reduced-mode projectile trails readable and prunes clocks for expired projectiles', () => {
    const scene = new THREE.Scene();
    const assets = new AssetManager();
    const system = new VFXSystem(scene, assets, 8);
    const internal = system as unknown as { slots: Array<{ instance: VFXInstance | null }>; trailTimes: Map<number, number> };
    system.setMode('reduced');
    system.trail(1, { x: 2, y: 0.8, z: 3 }, '#a7efff', 'oracle_spark');
    expect(internal.slots.some(slot => slot.instance?.priority === 'ordinary_hit')).toBe(true);

    for (let projectileId = 2; projectileId <= 40; projectileId += 1) {
      system.trail(projectileId, { x: projectileId, y: 0.8, z: 3 }, '#a7efff', 'oracle_spark');
    }
    expect(internal.trailTimes.size).toBe(40);
    system.retainProjectileTrails(new Set([40]));
    expect([...internal.trailTimes.keys()]).toEqual([40]);

    system.dispose();
    assets.dispose();
  });
});
