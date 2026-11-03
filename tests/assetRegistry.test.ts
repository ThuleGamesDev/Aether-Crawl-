import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { biomeVisuals, collectAssetPaths, enemyVisuals, getDecorationAsset, getLevelAssetPaths, propVisuals, vfxVisuals } from '../data/assetRegistry';
import { enemyDefinitions } from '../data/enemies';
import { enemyAbilities } from '../data/enemyAbilities';

const localAssetExists = (url: string) => existsSync(resolve(process.cwd(), 'public', url.replace(/^\//, '')));
const localAssetBytes = (url: string) => statSync(resolve(process.cwd(), 'public', url.replace(/^\//, ''))).size;

describe('static asset registry', () => {
  it('maps every gameplay enemy to a present, distinct production sprite', () => {
    expect(enemyDefinitions).toHaveLength(28);
    expect(new Set(enemyDefinitions.map(enemy => enemy.id)).size).toBe(enemyDefinitions.length);
    const spritePaths = enemyDefinitions.map(enemy => enemyVisuals[enemy.fpsVisualId]?.sprite);
    expect(new Set(spritePaths).size).toBe(enemyDefinitions.length);
    for (const enemy of enemyDefinitions) {
      const visual = enemyVisuals[enemy.fpsVisualId];
      expect(visual, `${enemy.id} has a visual definition`).toBeDefined();
      expect(localAssetExists(visual.sprite), `${enemy.id} sprite exists at ${visual.sprite}`).toBe(true);
    }
  });

  it('maps every authored enemy ability to a registered definition', () => {
    const abilityIds = enemyDefinitions.flatMap(enemy => enemy.abilities ?? []);
    expect(abilityIds.length).toBeGreaterThan(0);
    expect(new Set(abilityIds).size).toBe(abilityIds.length);
    for (const abilityId of abilityIds) expect(enemyAbilities[abilityId], abilityId).toBeDefined();
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

  it('registers the new wall mounted and regional room art while retaining decoration code 1 for torches', () => {
    expect(propVisuals.wallTorch).toBe('/assets/maze/props/wall_torch.png');
    expect(propVisuals.frescoPanel).toBe('/assets/maze/props/fresco_panel.png');
    expect(propVisuals.chthonicAltar).toBe('/assets/maze/props/chthonic_altar.png');
    expect(localAssetExists(propVisuals.wallTorch)).toBe(true);
    expect(localAssetExists(propVisuals.frescoPanel)).toBe(true);
    expect(localAssetExists(propVisuals.chthonicAltar)).toBe(true);
    expect(getDecorationAsset('dungeon', 1)).toBe(propVisuals.wallTorch);
    expect(getDecorationAsset('dungeon', 7)).toBe(propVisuals.oilBowl);
  });

  it('preloads the active floor set without downloading other biome surfaces up front', () => {
    const firstFloor = getLevelAssetPaths(1);
    expect(firstFloor).toContain('/assets/maze/tiles/palace_foundations_wall.png');
    expect(firstFloor).toContain('/assets/maze/enemies/cretan_cave_rat.png');
    expect(firstFloor).toContain('/assets/maze/enemies/guardian_bronze_gatekeeper.png');
    expect(firstFloor).toContain('/assets/maze/hands/xiphos.png');
    expect(firstFloor).toContain('/assets/maze/vfx/bronze_impact.png');
    expect(firstFloor).not.toContain('/assets/maze/tiles/serpent_galleries_wall.png');
    const startupBytes = firstFloor.reduce((total, path) => total + localAssetBytes(path), 0);
    const registryBytes = collectAssetPaths().reduce((total, path) => total + localAssetBytes(path), 0);
    expect(startupBytes).toBeLessThan(registryBytes * 0.75);

    expect(getLevelAssetPaths(5)).toContain('/assets/maze/enemies/guardian_threadbound_warden.png');
    expect(getLevelAssetPaths(6)).toContain('/assets/maze/tiles/serpent_galleries_wall.png');
  });
});
