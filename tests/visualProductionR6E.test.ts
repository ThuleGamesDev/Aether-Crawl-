import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHARACTER_RIG_MANIFEST, CHARACTER_RIG_VISUAL_IDS, getCharacterRigDefinition, sampleCharacterPose, validateCharacterRigManifest } from '../data/characterRigs';
import { enemyVisuals, getLevelAssetPaths, offhandVisuals, weaponVisuals } from '../data/assetRegistry';
import { selectEnemyCharacterAnimation } from '../data/enemyCharacterAnimation';
import { getPixelRenderSize } from '../engine/SceneRenderer';
import { getCharacterViewForViewer, CharacterRigAnimator } from '../presentation/CharacterRigAnimator';
import { AssetManager } from '../presentation/AssetManager';
import { getWeaponPresentationPose, isWeaponPresentationCenterClear } from '../presentation/WeaponPresenter';
import type { WorldEnemy } from '../types';

const PILOT_ATTACKS = [
  ['cretan_cave_rat', 'rat', 'rat_bite'],
  ['arachne_brood', 'spider', 'spider_venom_fang'],
  ['bronze_revenant', 'revenant', 'revenant_xiphos'],
  ['bull_cult_enforcer', 'bull_enforcer', 'enforcer_heavy_cleave'],
  ['guardian_bronze_gatekeeper', 'gatekeeper', 'gatekeeper_shield_bash'],
  ['chthonic_acolyte', 'acolyte', 'acolyte_underworld_bolt'],
] as const;

const enemy = (visualId: string, attackSetId: string, attackId: string, overrides: Partial<WorldEnemy> = {}): WorldEnemy => ({
  id: 'r6e_' + visualId,
  definitionId: visualId,
  name: visualId,
  visualId,
  position: { x: 2, y: 0, z: 2 },
  collisionRadius: 0.3,
  health: 80,
  maxHealth: 80,
  damage: 10,
  xpReward: 20,
  state: 'IDLE',
  stateTimer: 0,
  attackCooldown: 0,
  attackRange: 1.8,
  attackTelegraphSeconds: 0.62,
  attackSetId,
  activeAttackId: attackId,
  attackIndex: 0,
  rewardGranted: false,
  isBoss: visualId === 'guardian_bronze_gatekeeper',
  statusEffects: [],
  ...overrides,
});

function uvBounds(mesh: THREE.Mesh): [number, number, number, number] {
  const uv = mesh.geometry.getAttribute('uv');
  const values = Array.from({ length: uv.count }, (_, index) => [uv.getX(index), uv.getY(index)] as const);
  return [
    Math.min(...values.map(value => value[0])),
    Math.min(...values.map(value => value[1])),
    Math.max(...values.map(value => value[0])),
    Math.max(...values.map(value => value[1])),
  ];
}

function expectUvCell(mesh: THREE.Mesh, cell: [number, number]): void {
  const [minU, minV, maxU, maxV] = uvBounds(mesh);
  const { atlasWidth, atlasHeight, cellSize } = CHARACTER_RIG_MANIFEST;
  expect(minU).toBeCloseTo((cell[0] + 0.5) / atlasWidth, 6);
  expect(maxU).toBeCloseTo((cell[0] + cellSize - 0.5) / atlasWidth, 6);
  expect(minV).toBeCloseTo(1 - (cell[1] + cellSize - 0.5) / atlasHeight, 6);
  expect(maxV).toBeCloseTo(1 - (cell[1] + 0.5) / atlasHeight, 6);
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('R6E visual production pilot', () => {
  it('registers all six pilot rigs, fallback sprites, state clips, and local weapon assets', () => {
    expect(CHARACTER_RIG_VISUAL_IDS).toEqual(PILOT_ATTACKS.map(([visualId]) => visualId));
    expect(validateCharacterRigManifest()).toEqual([]);
    expect(CHARACTER_RIG_MANIFEST.schemaVersion).toBe(2);
    expect(existsSync(resolve(process.cwd(), CHARACTER_RIG_MANIFEST.contactSheetPath))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'docs/previews/R6E_WORLD_EQUIPMENT_SHEET.png'))).toBe(true);

    const atlasPath = resolve(process.cwd(), 'public', CHARACTER_RIG_MANIFEST.atlasPath.replace(/^\//, ''));
    const atlas = readFileSync(atlasPath);
    expect(atlas.subarray(1, 4).toString()).toBe('PNG');
    expect(atlas.readUInt32BE(16)).toBe(CHARACTER_RIG_MANIFEST.atlasWidth);
    expect(atlas.readUInt32BE(20)).toBe(CHARACTER_RIG_MANIFEST.atlasHeight);

    for (const [visualId, attackSetId, attackId] of PILOT_ATTACKS) {
      const rig = getCharacterRigDefinition(visualId)!;
      const fallback = enemyVisuals[visualId]?.sprite;
      expect(fallback).toBe('/assets/maze/enemies/' + visualId + '.png');
      expect(existsSync(resolve(process.cwd(), 'public', fallback!.replace(/^\//, '')))).toBe(true);
      expect(getLevelAssetPaths(1)).toContain(CHARACTER_RIG_MANIFEST.atlasPath);
      for (const layer of rig.layers) {
        if (['humanoid', 'heavyHumanoid', 'caster'].includes(rig.family)) {
          expect(Object.keys(layer.viewCells ?? {}).sort()).toEqual(['back', 'front', 'threeQuarter']);
          for (const cell of Object.values(layer.viewCells!)) {
            expect(cell[0]).toBeGreaterThanOrEqual(0);
            expect(cell[1]).toBeGreaterThanOrEqual(0);
            expect(cell[0] + CHARACTER_RIG_MANIFEST.cellSize).toBeLessThanOrEqual(CHARACTER_RIG_MANIFEST.atlasWidth);
            expect(cell[1] + CHARACTER_RIG_MANIFEST.cellSize).toBeLessThanOrEqual(CHARACTER_RIG_MANIFEST.atlasHeight);
          }
        }
      }

      const samples = [
        enemy(visualId, attackSetId, attackId),
        enemy(visualId, attackSetId, attackId, { state: 'CHASE' }),
        enemy(visualId, attackSetId, attackId, { state: 'ATTACK_WINDUP', stateTimer: 0.24 }),
        enemy(visualId, attackSetId, attackId, { state: 'ATTACK_ACTIVE', stateTimer: 0.06 }),
        enemy(visualId, attackSetId, attackId, { state: 'RECOVER', stateTimer: 0.25, lastAttackId: attackId }),
        enemy(visualId, attackSetId, attackId, { state: 'HURT', stateTimer: 0.1 }),
        enemy(visualId, attackSetId, attackId, { state: 'STAGGER', stateTimer: 0.2 }),
        enemy(visualId, attackSetId, attackId, { state: 'DEAD', health: 0, stateTimer: 0.55 }),
      ];
      for (const sample of samples) {
        const first = selectEnemyCharacterAnimation(sample);
        expect(selectEnemyCharacterAnimation({ ...sample })).toEqual(first);
        expect(rig.clips[first.clipName], visualId + '/' + first.clipName).toBeDefined();
        expect(Number.isFinite(first.progress)).toBe(true);
      }
      for (const clip of Object.values(rig.clips)) for (const time of [0, 0.25, 0.5, 0.75, 1]) {
        const pose = sampleCharacterPose(clip, time);
        expect(Object.values(pose).every(transform => Object.values(transform).every(value => Number.isFinite(value)))).toBe(true);
      }
    }

    for (const path of [...Object.values(weaponVisuals), ...Object.values(offhandVisuals)]) {
      expect(path.startsWith('/assets/')).toBe(true);
      expect(existsSync(resolve(process.cwd(), 'public', path.replace(/^\//, '')))).toBe(true);
    }
  });

  it('selects front, three-quarter, and back views deterministically and updates atlas UVs in place', () => {
    const rig = getCharacterRigDefinition('bronze_revenant')!;
    const base = enemy('bronze_revenant', 'revenant', 'revenant_xiphos', { facingYaw: 0 });
    const east = new THREE.Vector3(6, 1.5, 2);
    const north = new THREE.Vector3(2, 1.5, 6);
    const west = new THREE.Vector3(-2, 1.5, 2);
    expect(getCharacterViewForViewer(base, east)).toEqual({ view: 'front', flipX: false });
    expect(getCharacterViewForViewer(base, north).view).toBe('threeQuarter');
    expect(getCharacterViewForViewer(base, north)).toEqual(getCharacterViewForViewer(base, north));
    expect(getCharacterViewForViewer(base, west)).toEqual({ view: 'back', flipX: false });

    const animator = new CharacterRigAnimator(base, rig, new THREE.Texture(), CHARACTER_RIG_MANIFEST.atlasWidth, CHARACTER_RIG_MANIFEST.atlasHeight, CHARACTER_RIG_MANIFEST.cellSize);
    let torso: THREE.Mesh | undefined;
    animator.group.traverse(object => {
      if (object.name === base.id + ':torso:pixels') torso = object as THREE.Mesh;
    });
    expect(torso).toBeDefined();
    const geometry = torso!.geometry;
    const layer = rig.layers.find(candidate => candidate.id === 'torso')!;

    animator.update(base, east, 0.2, 0.016);
    expectUvCell(torso!, layer.viewCells!.front);
    animator.update(base, north, 0.25, 0.016);
    expectUvCell(torso!, layer.viewCells!.threeQuarter);
    expect(animator.group.scale.x).toBe(-1);
    animator.update(base, west, 0.3, 0.016);
    expectUvCell(torso!, layer.viewCells!.back);
    expect(animator.group.scale.x).toBe(1);
    expect(torso!.geometry).toBe(geometry);
    animator.dispose();
  });

  it('keeps two-hand weapon silhouettes outside the central telegraph lane', () => {
    type PoseInput = Parameters<typeof getWeaponPresentationPose>[0];
    const pose = (input: Partial<PoseInput> & Pick<PoseInput, 'weapon'>) => getWeaponPresentationPose({
      weapon: input.weapon,
      moving: input.moving ?? false,
      guarding: input.guarding ?? false,
      hasShield: input.hasShield ?? false,
      elapsedSeconds: input.elapsedSeconds ?? 1,
      abilityId: input.abilityId,
      phase: input.phase,
      remainingSeconds: input.remainingSeconds,
      actionHand: input.actionHand,
      offHandPose: input.offHandPose,
      viewmodelEvent: input.viewmodelEvent,
      viewmodelEventProgress: input.viewmodelEventProgress,
    });
    const xiphosAspis = pose({ weapon: 'sword', hasShield: true, offHandPose: 'shield', abilityId: 'paladin_smite', phase: 'ACTIVE', remainingSeconds: 0.06 });
    const doryGrip = pose({ weapon: 'spear', offHandPose: 'twoHandGrip', abilityId: 'paladin_arming_sword', phase: 'ACTIVE', remainingSeconds: 0.06 });
    const bowDraw = pose({ weapon: 'bow', offHandPose: 'bowDraw', abilityId: 'ranger_shortbow', phase: 'ACTIVE', remainingSeconds: 0.04 });
    const doryDodge = pose({ weapon: 'spear', offHandPose: 'twoHandGrip', viewmodelEvent: 'DODGE', viewmodelEventProgress: 0.75 });
    expect(isWeaponPresentationCenterClear(xiphosAspis)).toBe(true);
    expect(isWeaponPresentationCenterClear(doryGrip)).toBe(true);
    expect(isWeaponPresentationCenterClear(bowDraw)).toBe(true);
    expect(isWeaponPresentationCenterClear(doryDodge)).toBe(true);
  });

  it('keeps pixel texture filtering crisp and disposes the shared asset cache', () => {
    const context = new Proxy({}, { get: () => () => undefined, set: () => true });
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
    const assets = new AssetManager();
    const wall = assets.texture('wall', 'dungeon');
    expect(wall.magFilter).toBe(THREE.NearestFilter);
    expect(wall.minFilter).toBe(THREE.NearestFilter);
    expect(wall.generateMipmaps).toBe(false);
    const dispose = vi.spyOn(wall, 'dispose');
    assets.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('keeps the pixel render scale and camera aspect stable at three desktop resolutions', () => {
    const viewports = [[1280, 720], [1920, 1080], [2560, 1440]] as const;
    const sizes = viewports.map(([width, height]) => getPixelRenderSize(width, height, false));
    expect(sizes.map(size => size.scale)).toEqual([sizes[0].scale, sizes[0].scale, sizes[0].scale]);
    expect(sizes[0].scale).toBe(0.56);
    for (let index = 0; index < viewports.length; index += 1) {
      expect(sizes[index].width / sizes[index].height).toBeCloseTo(viewports[index][0] / viewports[index][1], 2);
    }
  });
});
