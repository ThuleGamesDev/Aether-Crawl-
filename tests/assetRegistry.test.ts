import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { biomeVisuals, collectAssetPaths, enemyVisuals, vfxVisuals } from '../data/assetRegistry';
import { enemyDefinitions } from '../data/enemies';

const localAssetExists = (url: string) => existsSync(resolve(process.cwd(), 'public', url.replace(/^\//, '')));

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
});
