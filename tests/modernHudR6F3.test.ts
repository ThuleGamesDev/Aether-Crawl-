import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { biomeVisuals, getBiomeAssetPaths } from '../data/assetRegistry';
import { ITEM_BASE_BY_ID } from '../data/itemBases';
import { createItemInstance, createPlayerCharacter } from '../player/PlayerProgression';
import type { ActivePlayerAction } from '../player/PlayerCombat';
import { AssetManager } from '../presentation/AssetManager';
import { getWeaponActionPresentation } from '../data/weaponActionRegistry';
import { getWeaponPresentationPose, isWeaponPresentationCenterClear, WeaponPresenter } from '../presentation/WeaponPresenter';
import { wallTextureVariantForCell, WALL_TEXTURE_VARIANT_COUNT } from '../world/WorldGeometry';
import { createDungeonWorld } from '../world/DungeonWorld';
import { TileType } from '../types';

describe('R6F3 authored labyrinth walls', () => {
  it('registers three distinct local 128×320 wall maps for every biome', () => {
    const hashes = new Set<string>();
    let wallCount = 0;
    for (const [biomeId, biome] of Object.entries(biomeVisuals) as Array<[keyof typeof biomeVisuals, (typeof biomeVisuals)[keyof typeof biomeVisuals]]>) {
      expect(new Set(biome.wallVariants).size).toBe(3);
      expect(getBiomeAssetPaths(biomeId)).toEqual(expect.arrayContaining(biome.wallVariants));
      for (const path of biome.wallVariants) {
        const absolutePath = resolve(process.cwd(), 'public', path.replace(/^\//, ''));
        expect(existsSync(absolutePath)).toBe(true);
        const png = readFileSync(absolutePath);
        expect(png.subarray(1, 4).toString()).toBe('PNG');
        expect(png.readUInt32BE(16)).toBe(128);
        expect(png.readUInt32BE(20)).toBe(320);
        hashes.add(createHash('sha256').update(png).digest('hex'));
        wallCount += 1;
      }
    }
    expect(wallCount).toBe(18);
    expect(hashes.size).toBe(wallCount);
  });

  it('selects a stable distribution of wall variants without changing world cells', () => {
    const firstPass = Array.from({ length: 32 * 32 }, (_, index) => wallTextureVariantForCell(index % 32, Math.floor(index / 32)));
    const secondPass = Array.from({ length: 32 * 32 }, (_, index) => wallTextureVariantForCell(index % 32, Math.floor(index / 32)));
    expect(WALL_TEXTURE_VARIANT_COUNT).toBe(3);
    expect(secondPass).toEqual(firstPass);
    expect(new Set(firstPass)).toEqual(new Set([0, 1, 2]));
    expect(firstPass.every(variant => variant >= 0 && variant < WALL_TEXTURE_VARIANT_COUNT)).toBe(true);
  });

  it('keeps decorative materials in two-cell patches with a restrained weighted distribution', () => {
    const variants = Array.from({ length: 48 * 48 }, (_, index) => wallTextureVariantForCell(index % 48, Math.floor(index / 48)));
    const counts = [0, 1, 2].map(variant => variants.filter(value => value === variant).length);
    expect(counts[0]).toBeGreaterThan(counts[1]);
    expect(counts[1]).toBeGreaterThan(counts[2]);
    for (let z = 0; z < 48; z += 2) for (let x = 0; x < 48; x += 2) {
      const patch = wallTextureVariantForCell(x, z);
      expect(wallTextureVariantForCell(x + 1, z)).toBe(patch);
      expect(wallTextureVariantForCell(x, z + 1)).toBe(patch);
      expect(wallTextureVariantForCell(x + 1, z + 1)).toBe(patch);
    }
  });

  it('produces a different stable material layout for distinct Palace seeds', () => {
    const layout = (seed: number) => {
      const world = createDungeonWorld(1, seed);
      return world.map.flatMap((row, z) => row.map((tile, x) => tile === TileType.WALL ? wallTextureVariantForCell(x, z) : -1));
    };
    const first = layout(14031);
    expect(layout(14031)).toEqual(first);
    expect(layout(97223)).not.toEqual(first);
  });

  it('registers a four-cell authored floor and ceiling patch for Palace Foundations', () => {
    for (const kind of ['floor', 'ceiling'] as const) {
      const path = biomeVisuals.dungeon[kind];
      const absolutePath = resolve(process.cwd(), 'public', path.replace(/^\//, ''));
      const png = readFileSync(absolutePath);
      expect(existsSync(absolutePath)).toBe(true);
      expect(png.readUInt32BE(16)).toBe(256);
      expect(png.readUInt32BE(20)).toBe(256);
    }
  });
});

describe('R6F3 first-person strike presentation', () => {
  it('gives the Xiphos slash a staged windup, cross-body active sweep, and settling recovery', () => {
    const profile = getWeaponActionPresentation('weapon_xiphos_slash')!;
    const pose = (phase: 'WINDUP' | 'ACTIVE' | 'RECOVERY', remainingSeconds: number) => getWeaponPresentationPose({
      weapon: 'sword', abilityId: 'weapon_xiphos_slash', phase, remainingSeconds,
      animationProfile: profile.animationProfile, moving: false, guarding: false, hasShield: false, elapsedSeconds: 0,
    });
    const windup = pose('WINDUP', 0.04);
    const activeStart = pose('ACTIVE', 0.15);
    const activeEnd = pose('ACTIVE', 0.01);
    const recovery = pose('RECOVERY', 0.06);
    expect(windup.weaponRotationZ).toBeLessThan(-0.3);
    expect(activeStart.weaponRotationZ).toBeLessThan(activeEnd.weaponRotationZ);
    expect(activeStart.weaponX).toBeGreaterThan(activeEnd.weaponX);
    expect(recovery.weaponRotationZ).toBeGreaterThan(0);
    for (const sample of [windup, activeStart, activeEnd, recovery]) {
      expect(sample.weaponX).toBeGreaterThan(0.4);
      expect(isWeaponPresentationCenterClear(sample)).toBe(true);
    }
  });

  it('shows the bronze sweep trail only during a resolved weapon sweep', () => {
    const textures = new Map<string, THREE.Texture>();
    const texture = (key: string) => {
      if (!textures.has(key)) textures.set(key, new THREE.Texture());
      return textures.get(key)!;
    };
    const assets = {
      weaponTexture: vi.fn((type: string, classId: string) => texture(`weapon:${type}:${classId}`)),
      offhandTexture: vi.fn((type: string) => texture(`offhand:${type}`)),
      vfxTexture: vi.fn((effectId: string) => texture(`vfx:${effectId}`)),
    } as unknown as AssetManager;
    const camera = new THREE.PerspectiveCamera();
    const presenter = new WeaponPresenter(camera, assets);
    const basePlayer = createPlayerCharacter('PALADIN');
    const xiphos = createItemInstance({ ...ITEM_BASE_BY_ID.xiphos, quantity: 1 }, 'r6f3-xiphos');
    const player = { ...basePlayer, equipment: { ...basePlayer.equipment, mainHand: xiphos } };
    const profile = getWeaponActionPresentation('weapon_xiphos_slash')!;
    const action = (phase: ActivePlayerAction['phase'], actionSource: ActivePlayerAction['actionSource'] = 'WEAPON'): ActivePlayerAction => ({
      abilityId: 'weapon_xiphos_slash', actionSource, actionSlot: 'PRIMARY', weaponSlot: 'mainHand',
      sourceItemInstanceId: xiphos.instanceId, presentationProfile: profile, phase,
      remainingSeconds: 0.04, damageMultiplier: 1,
    });

    presenter.update(player, action('ACTIVE'), false, false, 0.5);
    expect(presenter.getDiagnostics().strikeTrailAttachedToCamera).toBe(true);
    expect(presenter.getDiagnostics().strikeTrailVisible).toBe(true);
    const material = (camera.getObjectByName('FirstPersonWeaponStrikeTrail') as THREE.Sprite).material as THREE.SpriteMaterial;
    expect(material.opacity).toBeGreaterThan(0);

    presenter.update(player, action('WINDUP'), false, false, 0.6);
    expect(presenter.getDiagnostics().strikeTrailVisible).toBe(false);
    presenter.update(player, action('ACTIVE', 'CLASS_SKILL'), false, false, 0.7);
    expect(presenter.getDiagnostics().strikeTrailVisible).toBe(false);
    presenter.dispose();
    for (const mapTexture of textures.values()) mapTexture.dispose();
  });
});
