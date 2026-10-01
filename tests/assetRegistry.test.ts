import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { biomeVisuals, collectAssetPaths, enemyVisuals, getLevelAssetPaths, vfxVisuals } from '../data/assetRegistry';
import { enemyDefinitions } from '../data/enemies';

const localAssetExists = (url: string) => existsSync(resolve(process.cwd(), 'public', url.replace(/^\//, '')));
const localAssetBytes = (url: string) => statSync(resolve(process.cwd(), 'public', url.replace(/^\//, ''))).size;

describe('static asset registry', () => {
  it('maps every gameplay enemy to a present, distinct production sprite', () => {
    expect(enemyDefinitions).toHaveLength(28);
    expect(new Set(enemyDefinitions.map(enemy => enemy.id)).size).toBe(enemyDefinitions.length);
    const spritePaths = enemyDefinitions.map(enemy => enemyVisuals[enemy.visualId]?.sprite);
    expect(new Set(spritePaths).size).toBe(enemyDefinitions.length);
    for (const enemy of enemyDefinitions) {
      const visual = enemyVisuals[enemy.visualId];
      expect(visual, `${enemy.id} has a visual definition`).toBeDefined();
      expect(localAssetExists(visual.sprite), `${enemy.id} sprite exists at ${visual.sprite}`).toBe(true);
    }
  });

  it('provides complete local environment art for all six active biomes', () => {
    expect(Object.keys(biomeVisuals).sort()).toEqual(['catacombs', 'dungeon', 'frost', 'gilded', 'moss', 'obsidian']);
    for (const [biomeId, biome] of Object.entries(biomeVisuals)) {
      for (const [slot, path] of Object.entries({
        wall: biome.wall, floor: biome.floor, ceiling: biome.ceiling,
        door: biome.door, exit: biome.exit, torch: biome.torch,
        barrel: biome.props.barrel, crate: biome.props.crate, bones: biome.props.bones,
        extraA: biome.props.extra[0], extraB: biome.props.extra[1],
      })) {
        expect(localAssetExists(path), `${biomeId}.${slot} exists at ${path}`).toBe(true);
      }
    }
  });

  it('resolves every registry asset to a repository file', () => {
    for (const path of collectAssetPaths()) expect(localAssetExists(path), path).toBe(true);
    for (const [type, path] of Object.entries(vfxVisuals)) expect(localAssetExists(path), `${type}: ${path}`).toBe(true);
  });

  it('preloads the active floor set without downloading other biome surfaces up front', () => {
    const firstFloor = getLevelAssetPaths(1);
    expect(firstFloor).toContain('/assets/environments/dungeon/wall.png');
    expect(firstFloor).toContain('/assets/enemies/giant-rat.png');
    expect(firstFloor).toContain('/assets/enemies/dungeon-warden.png');
    expect(firstFloor).toContain('/assets/hands/sword.png');
    expect(firstFloor).toContain('/assets/vfx/melee-hit.png');
    expect(firstFloor).not.toContain('/assets/environments/moss/wall.png');
    const startupBytes = firstFloor.reduce((total, path) => total + localAssetBytes(path), 0);
    const registryBytes = collectAssetPaths().reduce((total, path) => total + localAssetBytes(path), 0);
    expect(startupBytes).toBeLessThan(registryBytes * 0.75);

    expect(getLevelAssetPaths(5)).toContain('/assets/enemies/the-necromancer.png');
    expect(getLevelAssetPaths(6)).toContain('/assets/environments/moss/wall.png');
  });
});
