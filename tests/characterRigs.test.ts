import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CHARACTER_RIG_MANIFEST, CHARACTER_RIG_VISUAL_IDS, getCharacterRigDefinition, sampleCharacterPose, validateCharacterRigManifest, type CharacterRigManifest } from '../data/characterRigs';
import { selectEnemyCharacterAnimation } from '../data/enemyCharacterAnimation';
import { getWeaponPresentationPose, getWeaponVisualTypeForPlayer, type WeaponPresentationPoseInput } from '../presentation/WeaponPresenter';
import { CharacterRigAnimator, shouldFlipCharacterForViewer } from '../presentation/CharacterRigAnimator';
import { createItemInstance, createPlayerCharacter } from '../player/PlayerProgression';
import type { WorldEnemy } from '../types';

const enemy = (overrides: Partial<WorldEnemy> = {}): WorldEnemy => ({
  id: 'rig_test_enemy', definitionId: 'skeleton_warrior', name: 'Bronze Revenant', visualId: 'bronze_revenant',
  position: { x: 2, y: 0, z: 2 }, collisionRadius: 0.28,
  health: 64, maxHealth: 64, damage: 10, xpReward: 20, state: 'IDLE', stateTimer: 0,
  attackCooldown: 0, attackRange: 1.65, attackTelegraphSeconds: 0.62, attackSetId: 'revenant',
  attackIndex: 0, rewardGranted: false, isBoss: false, statusEffects: [],
  ...overrides,
});

describe('FPS-R3A authored character rigs', () => {
  it('ships six complete local pilot rigs with checked atlas cells and fallbacks', () => {
    expect(CHARACTER_RIG_VISUAL_IDS).toEqual([
      'cretan_cave_rat', 'arachne_brood', 'bronze_revenant', 'bull_cult_enforcer', 'guardian_bronze_gatekeeper', 'chthonic_acolyte',
    ]);
    expect(validateCharacterRigManifest()).toEqual([]);
    expect(existsSync(resolve(process.cwd(), 'public', CHARACTER_RIG_MANIFEST.atlasPath.replace(/^\//, '')))).toBe(true);
    expect(existsSync(resolve(process.cwd(), CHARACTER_RIG_MANIFEST.contactSheetPath))).toBe(true);
    for (const rig of Object.values(CHARACTER_RIG_MANIFEST.rigs)) {
      expect(existsSync(resolve(process.cwd(), 'public', rig.fallbackSprite.replace(/^\//, '')))).toBe(true);
      expect(rig.layers.length).toBeGreaterThanOrEqual(9);
      expect(rig.clips.idle).toBeDefined();
      expect(rig.clips.run).toBeDefined();
      expect(rig.clips.death).toBeDefined();
    }
  });

  it('keeps the rat and spider anatomies distinct and gives the spider eight articulated legs', () => {
    const rat = getCharacterRigDefinition('cretan_cave_rat')!;
    const spider = getCharacterRigDefinition('arachne_brood')!;
    const acolyte = getCharacterRigDefinition('chthonic_acolyte')!;
    expect(rat.family).toBe('quadruped');
    expect(spider.family).toBe('arachnid');
    expect(acolyte.family).toBe('caster');
    expect(rat.layers.some(layer => layer.id === 'tail')).toBe(true);
    expect(spider.layers.filter(layer => /^[LR][1-4](Upper|Lower)$/.test(layer.id))).toHaveLength(16);
    expect(spider.layers.some(layer => layer.id === 'armUpperR')).toBe(false);
  });

  it('rejects an out-of-bounds atlas pivot and a broken clip reference', () => {
    const broken = JSON.parse(JSON.stringify(CHARACTER_RIG_MANIFEST)) as CharacterRigManifest;
    broken.rigs.cretan_cave_rat.layers[0].pivot = [64, 0];
    broken.rigs.cretan_cave_rat.clips.run[0].layers.missingLimb = { rotation: 0.2 };
    const issues = validateCharacterRigManifest(broken);
    expect(issues.some(issue => issue.includes('pivot is outside'))).toBe(true);
    expect(issues.some(issue => issue.includes('references unknown layer'))).toBe(true);
  });

  it('samples exact first and last pose endpoints without wrapping the first frame', () => {
    const clip = [
      { t: 0, layers: { armUpperR: { rotation: 0.3 } } },
      { t: 0.5, layers: { armUpperR: { rotation: 0.7 } } },
      { t: 1, layers: { armUpperR: { rotation: 1 } } },
    ];
    expect(sampleCharacterPose(clip, 0).armUpperR.rotation).toBeCloseTo(0.3);
    expect(sampleCharacterPose(clip, 0.25).armUpperR.rotation).toBeCloseTo(0.5);
    expect(sampleCharacterPose(clip, 1).armUpperR.rotation).toBeCloseTo(1);
  });

  it('uses death, stagger and hurt priority over the existing attack window', () => {
    const windup = enemy({ state: 'ATTACK_WINDUP', activeAttackId: 'revenant_xiphos', stateTimer: 0.31 });
    expect(selectEnemyCharacterAnimation(windup)).toMatchObject({ mode: 'WINDUP', clipName: 'melee_windup', progress: 0.5 });
    expect(selectEnemyCharacterAnimation({ ...windup, state: 'HURT', stateTimer: 0.1 })).toMatchObject({ mode: 'HURT', clipName: 'hurt', progress: 0.5 });
    expect(selectEnemyCharacterAnimation({ ...windup, state: 'STAGGER', stateTimer: 0.21 })).toMatchObject({ mode: 'STAGGER', clipName: 'stagger', progress: 0.5 });
    expect(selectEnemyCharacterAnimation({ ...windup, state: 'DEAD', health: 0, stateTimer: 0 })).toMatchObject({ mode: 'DEAD', clipName: 'death', progress: 1 });
  });

  it('tracks windup, active and recovery timers, and reconstructs the same visual after save/load', () => {
    const windup = enemy({ state: 'ATTACK_WINDUP', activeAttackId: 'revenant_xiphos', stateTimer: 0.31 });
    const impact = enemy({ state: 'ATTACK_ACTIVE', activeAttackId: 'revenant_xiphos', stateTimer: 0.06 });
    const recovery = enemy({ state: 'RECOVER', lastAttackId: 'revenant_xiphos', stateTimer: 0.28 });
    expect(selectEnemyCharacterAnimation(windup).progress).toBeCloseTo(0.5);
    expect(selectEnemyCharacterAnimation(impact)).toMatchObject({ mode: 'IMPACT', clipName: 'melee_impact', progress: 0.5 });
    expect(selectEnemyCharacterAnimation(recovery)).toMatchObject({ mode: 'RECOVERY', clipName: 'melee_recovery', progress: 0.5 });

    const snapshot = JSON.parse(JSON.stringify(impact)) as WorldEnemy;
    expect(selectEnemyCharacterAnimation(snapshot)).toEqual(selectEnemyCharacterAnimation(impact));
    const pose = sampleCharacterPose(getCharacterRigDefinition(snapshot.visualId)!.clips.melee_impact, 0.5);
    expect(pose.armUpperR.rotation).toBeGreaterThan(0);
  });

  it('interrupts attacks with Hurt/Stagger and leaves no attack pose after the gameplay state changes', () => {
    const interrupted = enemy({ state: 'HURT', stateTimer: 0.18, activeAttackId: 'revenant_xiphos' });
    expect(selectEnemyCharacterAnimation(interrupted).mode).toBe('HURT');
    expect(selectEnemyCharacterAnimation({ ...interrupted, state: 'CHASE', stateTimer: 0 }).mode).toBe('RUN');
  });

  it('faces the viewer upright and mirrors only when the saved facing points away', () => {
    const facingEast = enemy({ facingYaw: 0 });
    expect(shouldFlipCharacterForViewer(facingEast, new THREE.Vector3(6, 1.5, 2))).toBe(false);
    expect(shouldFlipCharacterForViewer(facingEast, new THREE.Vector3(-2, 1.5, 2))).toBe(true);
  });

  it('reuses one actor material and its prepared layer geometries, then releases only actor-owned resources', () => {
    const rig = getCharacterRigDefinition('guardian_bronze_gatekeeper')!;
    const atlas = new THREE.Texture();
    let atlasDisposed = false;
    atlas.addEventListener('dispose', () => { atlasDisposed = true; });
    const animator = new CharacterRigAnimator(enemy({ visualId: rig.visualId, isBoss: true }), rig, atlas, CHARACTER_RIG_MANIFEST.atlasWidth, CHARACTER_RIG_MANIFEST.atlasHeight, CHARACTER_RIG_MANIFEST.cellSize);
    const scene = new THREE.Scene();
    scene.add(animator.group);
    const meshes: THREE.Mesh[] = [];
    animator.group.traverse(object => { if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh); });
    const geometries = meshes.map(mesh => mesh.geometry);
    expect(meshes).toHaveLength(rig.layers.length);
    expect(new Set(meshes.map(mesh => mesh.material)).size).toBe(1);
    expect(meshes[0].material).toBe(animator.material);

    animator.update(enemy({ visualId: rig.visualId, isBoss: true, state: 'CHASE', position: { x: 2.04, y: 0, z: 2 } }), new THREE.Vector3(2, 1.5, 6), 0.2, 0.05);
    animator.update(enemy({ visualId: rig.visualId, isBoss: true, state: 'CHASE', position: { x: 2.1, y: 0, z: 2 } }), new THREE.Vector3(2, 1.5, 6), 0.25, 0.05);
    expect(meshes.map(mesh => mesh.geometry)).toEqual(geometries);
    let disposedGeometryCount = 0;
    for (const geometry of geometries) geometry.addEventListener('dispose', () => { disposedGeometryCount += 1; });
    animator.dispose();
    expect(scene.children).not.toContain(animator.group);
    expect(disposedGeometryCount).toBe(rig.layers.length);
    expect(atlasDisposed).toBe(false);
  });
});

describe('FPS-R3A first-person weapon poses', () => {
  const pose = (weapon: WeaponPresentationPoseInput['weapon'], abilityId: string, phase: 'WINDUP' | 'ACTIVE' | 'RECOVERY', remainingSeconds: number, extras: Partial<Parameters<typeof getWeaponPresentationPose>[0]> = {}) => getWeaponPresentationPose({
    weapon, abilityId, phase, remainingSeconds, moving: false, guarding: false, hasShield: false, elapsedSeconds: 1, ...extras,
  });

  it('gives Labrys, Kopis and Xiphos distinct anticipation and impact arcs', () => {
    const axe = pose('axe', 'barbarian_heavy_strike', 'WINDUP', 0.21);
    const dagger = pose('dagger', 'rogue_quick_stab', 'WINDUP', 0.04);
    const xiphos = pose('sword', 'barbarian_heavy_strike', 'WINDUP', 0.21);
    expect(new Set([axe.weaponRotationZ, dagger.weaponRotationZ, xiphos.weaponRotationZ]).size).toBe(3);
    expect(pose('axe', 'barbarian_heavy_strike', 'ACTIVE', 0.09).weaponRotationZ).toBeGreaterThan(0);
    expect(pose('dagger', 'rogue_quick_stab', 'ACTIVE', 0.06).weaponRotationZ).toBeLessThan(0);
  });

  it('keeps Dory centered and drives its thrust through camera depth', () => {
    const thrust = pose('spear', 'paladin_arming_sword', 'ACTIVE', 0.06);
    const windup = pose('spear', 'paladin_arming_sword', 'WINDUP', 0.075);
    expect(thrust.weaponX).toBe(0.61);
    expect(Math.abs(thrust.weaponRotationZ)).toBeLessThan(0.03);
    expect(thrust.weaponZ).toBeGreaterThan(windup.weaponZ);
  });

  it('separates bow draw, staff casting, Aspis guard and shield bash poses', () => {
    const bow = pose('bow', 'ranger_shortbow', 'WINDUP', 0.08);
    const cast = pose('staff', 'sorcerer_arcane_bolt', 'ACTIVE', 0.04);
    const guard = getWeaponPresentationPose({ weapon: 'sword', guarding: true, hasShield: true, moving: false, elapsedSeconds: 1 });
    const bash = pose('sword', 'paladin_smite', 'ACTIVE', 0.06, { hasShield: true });
    expect(bow.weaponScaleX).toBeGreaterThan(0.72);
    expect(cast.weaponX).toBe(0.68);
    expect(Math.abs(cast.weaponRotationZ)).toBeLessThan(0.04);
    expect(guard.shieldVisible).toBe(true);
    expect(bash.shieldX).toBeGreaterThan(guard.shieldX);
    expect(bash.shieldZ).toBeGreaterThan(guard.shieldZ);
  });

  it('uses a class skill cast pose for spirit volley without implying a carried spear', () => {
    const spiritVolleyPose = pose('spear', 'ranger_volley', 'WINDUP', 0.19, { animationProfile: 'CLASS_SKILL' });
    const spiritVolleyWithSword = pose('sword', 'ranger_volley', 'WINDUP', 0.19, { animationProfile: 'CLASS_SKILL' });
    expect(spiritVolleyPose.weaponRotationZ).toBe(spiritVolleyWithSword.weaponRotationZ);
    expect(spiritVolleyPose.weaponY).toBe(spiritVolleyWithSword.weaponY);
  });

  it('uses the currently equipped visual and falls back to unarmed when the hand is empty', () => {
    const player = createPlayerCharacter('BARBARIAN');
    const labrys = createItemInstance({ id: 'r3a_labrys', name: 'Labrys', description: 'Test axe', type: 'WEAPON', value: 8, quantity: 1, visualType: 'axe' }, 'r3a_labrys_instance');
    const kopis = createItemInstance({ id: 'r3a_kopis', name: 'Kopis', description: 'Test dagger', type: 'WEAPON', value: 5, quantity: 1, visualType: 'dagger' }, 'r3a_kopis_instance');
    expect(getWeaponVisualTypeForPlayer({ ...player, equipment: { ...player.equipment, mainHand: labrys } })).toBe('axe');
    expect(getWeaponVisualTypeForPlayer({ ...player, equipment: { ...player.equipment, mainHand: kopis } })).toBe('dagger');
    expect(getWeaponVisualTypeForPlayer({ ...player, equipment: { ...player.equipment, mainHand: null } })).toBe('unarmed');
  });
});
