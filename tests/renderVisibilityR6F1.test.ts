import { inflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHARACTER_RIG_MANIFEST, getCharacterRigDefinition, validateCharacterRigManifest } from '../data/characterRigs';
import { getPixelRenderSize, RENDER_QUALITY_SCALES, attachCameraToScene } from '../engine/SceneRenderer';
import { AssetManager } from '../presentation/AssetManager';
import { CharacterRigAnimator } from '../presentation/CharacterRigAnimator';
import { getOffHandPose, getOffHandVisual, getWeaponPresentationPose, WeaponPresenter } from '../presentation/WeaponPresenter';
import type { PlayerCharacter, WorldEnemy, WeaponVisualType } from '../types';

const pilotIds = [
  'cretan_cave_rat', 'arachne_brood', 'bronze_revenant', 'bull_cult_enforcer',
  'guardian_bronze_gatekeeper', 'chthonic_acolyte',
] as const;

const worldEnemy = (visualId: string, overrides: Partial<WorldEnemy> = {}): WorldEnemy => ({
  id: `r6f1_${visualId}`,
  definitionId: visualId,
  name: visualId,
  visualId,
  position: { x: 4.5, y: 0, z: 7.5 },
  collisionRadius: 0.3,
  health: 80,
  maxHealth: 80,
  damage: 10,
  xpReward: 20,
  state: 'IDLE',
  stateTimer: 0,
  attackCooldown: 0,
  attackRange: 1.7,
  attackTelegraphSeconds: 0.62,
  attackSetId: 'revenant',
  attackIndex: 0,
  rewardGranted: false,
  isBoss: visualId === 'guardian_bronze_gatekeeper',
  statusEffects: [],
  ...overrides,
});

function player(mainVisual: WeaponVisualType | null, offHand: Record<string, unknown> | null = null): PlayerCharacter {
  return {
    classId: 'PALADIN',
    equipment: {
      mainHand: mainVisual ? { id: mainVisual, instanceId: `main_${mainVisual}`, type: 'WEAPON', visualType: mainVisual } : null,
      offHand: offHand as never,
    },
  } as unknown as PlayerCharacter;
}

function readPngRgba(path: string): { width: number; height: number; rgba: Buffer } {
  const png = readFileSync(path);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  let offset = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  expect(bitDepth).toBe(8);
  expect(colorType).toBe(6);
  const packed = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const rgba = Buffer.alloc(stride * height);
  let packedOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = packed[packedOffset++];
    const row = y * stride;
    const previous = row - stride;
    for (let x = 0; x < stride; x += 1) {
      const value = packed[packedOffset++];
      const left = x >= 4 ? rgba[row + x - 4] : 0;
      const above = y > 0 ? rgba[previous + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? rgba[previous + x - 4] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = above;
      else if (filter === 3) predictor = Math.floor((left + above) / 2);
      else if (filter === 4) {
        const p = left + above - upperLeft;
        const a = Math.abs(p - left), b = Math.abs(p - above), c = Math.abs(p - upperLeft);
        predictor = a <= b && a <= c ? left : b <= c ? above : upperLeft;
      } else expect(filter).toBe(0);
      rgba[row + x] = (value + predictor) & 255;
    }
  }
  return { width, height, rgba };
}

function hasCellAlpha(image: ReturnType<typeof readPngRgba>, cell: [number, number]): boolean {
  const { cellSize } = CHARACTER_RIG_MANIFEST;
  for (let y = cell[1]; y < cell[1] + cellSize; y += 1) {
    for (let x = cell[0]; x < cell[0] + cellSize; x += 1) {
      if (image.rgba[(y * image.width + x) * 4 + 3] > 8) return true;
    }
  }
  return false;
}

function hasVisibleAlpha(image: ReturnType<typeof readPngRgba>): boolean {
  for (let index = 3; index < image.rgba.length; index += 4) if (image.rgba[index] > 8) return true;
  return false;
}

class DeferredImage {
  static instances: DeferredImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  naturalWidth = 64;
  naturalHeight = 64;
  width = 64;
  height = 64;
  constructor() { DeferredImage.instances.push(this); }
}

function stubCanvasImageLoading(): void {
  const context = new Proxy({ imageSmoothingEnabled: false } as Record<string, unknown>, {
    get(target, key) {
      if (key in target) return target[key as string];
      if (key === 'getImageData') return (_x: number, _y: number, width: number, height: number) => {
        const data = new Uint8ClampedArray(width * height * 4);
        data[3] = 255;
        return { data };
      };
      return () => undefined;
    },
    set(target, key, value) { target[key as string] = value; return true; },
  });
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
  vi.stubGlobal('Image', DeferredImage);
  DeferredImage.instances = [];
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('R6F1 render visibility recovery', () => {
  it('attaches the viewmodel camera to the scene traversal that renders its child sprites', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const viewmodel = new THREE.Sprite(new THREE.SpriteMaterial());
    viewmodel.name = 'FirstPersonMainHand';
    camera.add(viewmodel);
    expect(scene.getObjectByName(viewmodel.name)).toBeUndefined();

    attachCameraToScene(scene, camera);
    expect(camera.parent).toBe(scene);
    expect(scene.getObjectByName(viewmodel.name)).toBe(viewmodel);
    expect(scene.getObjectByName(viewmodel.name)?.parent).toBe(camera);
    viewmodel.material.dispose();
  });

  it('renders authored atlas alpha for each pilot ID and available view, with valid UV manifests', () => {
    expect(validateCharacterRigManifest()).toEqual([]);
    const path = resolve(process.cwd(), 'public', CHARACTER_RIG_MANIFEST.atlasPath.replace(/^\//, ''));
    const image = readPngRgba(path);
    expect(image.width).toBe(CHARACTER_RIG_MANIFEST.atlasWidth);
    expect(image.height).toBe(CHARACTER_RIG_MANIFEST.atlasHeight);
    for (const visualId of pilotIds) {
      const rig = CHARACTER_RIG_MANIFEST.rigs[visualId];
      expect(rig).toBeDefined();
      const fallbackPath = resolve(process.cwd(), 'public', rig.fallbackSprite.replace(/^\//, ''));
      expect(hasVisibleAlpha(readPngRgba(fallbackPath)), `${visualId} local fallback must have visible alpha`).toBe(true);
      const views = rig.layers.some(layer => layer.viewCells) ? ['front', 'threeQuarter', 'back'] as const : ['default'] as const;
      for (const view of views) {
        const cells = rig.layers.map(layer => view === 'default' ? layer.cell : layer.viewCells?.[view] ?? layer.cell);
        expect(cells.some(cell => hasCellAlpha(image, cell)), `${visualId}/${view} must contain nonzero alpha`).toBe(true);
        for (const [x, y] of cells) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(x + CHARACTER_RIG_MANIFEST.cellSize).toBeLessThanOrEqual(image.width);
          expect(y + CHARACTER_RIG_MANIFEST.cellSize).toBeLessThanOrEqual(image.height);
        }
      }
    }
  });

  it('keeps each enemy rig attached through animation and releases its layer geometry on death cleanup', () => {
    const cameraPosition = new THREE.Vector3(4.5, 1.52, 2.5);
    const scene = new THREE.Scene();
    const atlas = new THREE.Texture();
    for (const visualId of pilotIds) {
      const enemy = worldEnemy(visualId);
      const definition = getCharacterRigDefinition(visualId)!;
      const animator = new CharacterRigAnimator(enemy, definition, atlas, CHARACTER_RIG_MANIFEST.atlasWidth, CHARACTER_RIG_MANIFEST.atlasHeight, CHARACTER_RIG_MANIFEST.cellSize);
      scene.add(animator.group);
      animator.update(enemy, cameraPosition, 0.25, 1 / 60);
      expect(scene.getObjectByName(animator.group.name)).toBe(animator.group);
      expect(animator.layerCount).toBe(definition.layers.length);
      expect(animator.material.depthTest).toBe(true);
      enemy.state = 'DEAD';
      enemy.health = 0;
      animator.update(enemy, cameraPosition, 0.8, 1 / 60);
      animator.dispose();
      expect(scene.getObjectByName(`WorldEnemyRig_${enemy.id}`)).toBeUndefined();
    }
    atlas.dispose();
  });

  it('keeps both hands visible on the first frame and updates weapon IDs in place after equipment changes', () => {
    const textures = new Map<string, THREE.Texture>();
    const assets = {
      weaponTexture: vi.fn((type: string, classId: string) => {
        const key = `${type}:${classId}`;
        if (!textures.has(key)) textures.set(key, new THREE.Texture());
        return textures.get(key)!;
      }),
      offhandTexture: vi.fn((type: string) => {
        const key = `offhand:${type}`;
        if (!textures.has(key)) textures.set(key, new THREE.Texture());
        return textures.get(key)!;
      }),
    } as unknown as AssetManager;
    const camera = new THREE.PerspectiveCamera();
    const presenter = new WeaponPresenter(camera, assets);
    const shield = { id: 'aspis', baseId: 'aspis', instanceId: 'shield-a', type: 'SHIELD' };
    const current = player('sword', shield);
    presenter.update(current, null, false, false, 0);
    const mainSprite = camera.getObjectByName('FirstPersonMainHand') as THREE.Sprite;
    const offSprite = camera.getObjectByName('FirstPersonOffHand') as THREE.Sprite;
    const mainMaterial = mainSprite.material;
    const offMaterial = offSprite.material;
    expect(presenter.getDiagnostics()).toMatchObject({
      mainHandVisualId: 'sword', offHandVisualId: 'shield', mainHandAttachedToCamera: true,
      offHandAttachedToCamera: true, mainHandVisible: true, offHandVisible: true,
    });

    for (let frame = 0; frame < 60; frame += 1) {
      presenter.update(current, null, frame % 2 === 0, frame % 4 === 0, frame / 60, frame % 5 === 0 ? 'DODGE' : null, 0.5);
    }
    expect(camera.getObjectByName('FirstPersonMainHand')).toBe(mainSprite);
    expect(camera.getObjectByName('FirstPersonOffHand')).toBe(offSprite);
    expect(mainSprite.material).toBe(mainMaterial);
    expect(offSprite.material).toBe(offMaterial);

    presenter.update(player('spear'), null, false, false, 1);
    expect(presenter.getDiagnostics()).toMatchObject({ mainHandVisualId: 'spear', offHandVisualId: 'twoHandGrip', mainHandVisible: true, offHandVisible: true });
    presenter.update(player('bow'), null, false, false, 1.1);
    expect(presenter.getDiagnostics().offHandVisualId).toBe('bowDraw');
    presenter.update(player('staff', { id: 'sun_focus', baseId: 'sun_focus', instanceId: 'focus-a', type: 'ACCESSORY' }), null, false, false, 1.2);
    expect(presenter.getDiagnostics().offHandVisualId).toBe('focus');
    presenter.dispose();
    for (const texture of textures.values()) texture.dispose();
  });

  it('keeps the offhand visible and inside the camera image for idle, movement, combat, parry, dodge, recoil, and item use', () => {
    const cases = [
      { action: undefined, moving: false, guarding: false, event: null },
      { action: undefined, moving: true, guarding: false, event: null },
      { action: { abilityId: 'paladin_smite', phase: 'WINDUP' as const, remainingSeconds: 0.22 }, moving: false, guarding: false, event: null },
      { action: { abilityId: 'paladin_smite', phase: 'ACTIVE' as const, remainingSeconds: 0.04 }, moving: false, guarding: false, event: null },
      { action: { abilityId: 'paladin_smite', phase: 'RECOVERY' as const, remainingSeconds: 0.18 }, moving: false, guarding: false, event: null },
      { action: undefined, moving: false, guarding: true, event: null },
      { action: undefined, moving: false, guarding: false, event: 'DODGE' as const },
      { action: undefined, moving: false, guarding: false, event: 'HIT_RECOIL' as const },
      { action: undefined, moving: false, guarding: false, event: 'ITEM_USE' as const },
    ];
    for (const [index, state] of cases.entries()) {
      const pose = getWeaponPresentationPose({
        weapon: 'sword', abilityId: state.action?.abilityId, phase: state.action?.phase,
        remainingSeconds: state.action?.remainingSeconds, moving: state.moving, guarding: state.guarding,
        hasShield: true, elapsedSeconds: index * 0.17, offHandPose: 'shield', viewmodelEvent: state.event,
        viewmodelEventProgress: state.event ? 0.7 : 0,
      });
      expect(pose.offHandVisible).toBe(true);
      expect(pose.weaponZ).toBeLessThan(-0.045);
      expect(pose.weaponZ).toBeGreaterThan(-2);
      expect(pose.offHandZ).toBeLessThan(-0.045);
      expect(pose.offHandZ).toBeGreaterThan(-2);
      expect(Math.abs(pose.weaponX)).toBeLessThan(1.2);
      expect(Math.abs(pose.offHandX)).toBeLessThan(1.2);
    }
  });

  it('provides bounded performance, balanced, and sharp render sizes at desktop and mobile resolutions', () => {
    expect(RENDER_QUALITY_SCALES).toEqual({
      performance: { desktop: 0.48, mobile: 0.4 },
      balanced: { desktop: 0.68, mobile: 0.54 },
      sharp: { desktop: 0.84, mobile: 0.68 },
    });
    for (const [width, height] of [[1280, 720], [1920, 1080], [390, 844]]) {
      const mobile = width < 768;
      const results = (['performance', 'balanced', 'sharp'] as const).map(quality => getPixelRenderSize(width, height, mobile, quality));
      expect(results[0].scale).toBeLessThan(results[1].scale);
      expect(results[1].scale).toBeLessThan(results[2].scale);
      expect(results[2].width).toBeLessThan(width);
      expect(results[2].height).toBeLessThan(height);
      expect(results.every(result => result.width > 0 && result.height > 0)).toBe(true);
    }
  });

  it('retains procedural fallbacks on async weapon texture errors and ignores stale loads after disposal', () => {
    stubCanvasImageLoading();
    const manager = new AssetManager();
    const texture = manager.weaponTexture('sword', 'PALADIN');
    const fallback = texture.source.data;
    expect(manager.getDiagnostics().localTextures['/assets/maze/hands/xiphos.png']).toBe('loading');
    DeferredImage.instances[0].onerror?.();
    expect(manager.weaponTexture('sword', 'PALADIN')).toBe(texture);
    expect(texture.source.data).toBe(fallback);
    expect(manager.getDiagnostics().localTextures['/assets/maze/hands/xiphos.png']).toBe('error');
    expect(manager.getDiagnostics().loadErrors.some(error => error.includes('procedural fallback remains active'))).toBe(true);
    manager.dispose();

    const rebuilding = new AssetManager();
    rebuilding.weaponTexture('sword', 'PALADIN');
    const staleImage = DeferredImage.instances.at(-1)!;
    rebuilding.dispose();
    expect(staleImage.onload).toBeNull();
    expect(staleImage.onerror).toBeNull();
  });

  it('uses legacy enemy sprites while the rig atlas loads or fails, and validates loaded atlas dimensions and alpha', () => {
    stubCanvasImageLoading();
    const manager = new AssetManager();
    expect(manager.characterRigAtlas()).toBeNull();
    expect(manager.getDiagnostics().characterRigAtlas.state).toBe('loading');
    const atlasImage = DeferredImage.instances[0];
    atlasImage.naturalWidth = CHARACTER_RIG_MANIFEST.atlasWidth;
    atlasImage.naturalHeight = CHARACTER_RIG_MANIFEST.atlasHeight;
    atlasImage.onload?.();
    expect(manager.characterRigAtlas()).not.toBeNull();
    expect(manager.getDiagnostics().characterRigAtlas.state).toBe('ready');
    manager.dispose();

    const failed = new AssetManager();
    expect(failed.characterRigAtlas()).toBeNull();
    DeferredImage.instances.at(-1)?.onerror?.();
    expect(failed.characterRigAtlas()).toBeNull();
    expect(failed.getDiagnostics().characterRigAtlas.state).toBe('error');
    expect(failed.getDiagnostics().loadErrors.some(error => error.includes('legacy enemy sprite fallbacks remain active'))).toBe(true);
    failed.dispose();

    const wrongDimensions = new AssetManager();
    expect(wrongDimensions.characterRigAtlas()).toBeNull();
    const wrongSizeImage = DeferredImage.instances.at(-1)!;
    wrongSizeImage.naturalWidth = 64;
    wrongSizeImage.naturalHeight = 64;
    wrongSizeImage.onload?.();
    expect(wrongDimensions.characterRigAtlas()).toBeNull();
    expect(wrongDimensions.getDiagnostics().characterRigAtlas.state).toBe('error');
    wrongDimensions.dispose();
  });
});
