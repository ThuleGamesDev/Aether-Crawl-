import * as THREE from 'three';
import type { BiomeId, WeaponVisualType } from '../types';
import { createCombatEffectTexture, createEnemyTexture, createPixelTexture, createWeaponTexture } from './PixelArtRenderer';
import { biomeVisuals, enemyVisuals, propVisuals, shieldVisual, vfxVisuals, weaponVisuals } from '../data/assetRegistry';
import type { PixelEffectId } from './VFXSystem';

const proceduralVfx = new Set<PixelEffectId>(['bronze_slash', 'spear_thrust', 'shield_impact', 'blood_hit', 'poison_splash', 'web_impact', 'fire_burst', 'stone_shockwave', 'chthonic_bolt', 'boss_death_burst']);

export class AssetManager {
  private readonly textures = new Map<string, THREE.CanvasTexture>();

  texture(kind: 'wall' | 'floor' | 'ceiling' | 'door' | 'exit' | 'loot', biome: BiomeId): THREE.CanvasTexture {
    const key = kind + ':' + biome;
    let texture = this.textures.get(key);
    if (!texture) {
      texture = createPixelTexture(kind, biome);
      this.textures.set(key, texture);
      if (kind !== 'loot') this.loadLocal(texture, biomeVisuals[biome][kind]);
    }
    return texture;
  }

  enemyTexture(visualId: string, biome: BiomeId): THREE.CanvasTexture {
    const key = 'enemy:' + visualId + ':' + biome;
    let texture = this.textures.get(key);
    if (!texture) { texture = createEnemyTexture(visualId, biome); this.textures.set(key, texture); this.loadLocal(texture, enemyVisuals[visualId]?.sprite); }
    return texture;
  }

  weaponTexture(weaponType: WeaponVisualType, classId: string): THREE.CanvasTexture {
    const key = 'weapon:' + weaponType + ':' + classId;
    let texture = this.textures.get(key);
    if (!texture) { texture = createWeaponTexture(weaponType, classId); this.textures.set(key, texture); this.loadLocal(texture, weaponVisuals[weaponType]); }
    return texture;
  }

  propTexture(propId: keyof typeof propVisuals): THREE.CanvasTexture {
    const key = 'prop:' + propId;
    let texture = this.textures.get(key);
    if (!texture) {
      texture = createPixelTexture('loot', 'dungeon');
      this.textures.set(key, texture);
      this.loadLocal(texture, propVisuals[propId]);
    }
    return texture;
  }

  vfxTexture(effectId: PixelEffectId): THREE.CanvasTexture {
    const key = 'vfx:' + effectId;
    let texture = this.textures.get(key);
    if (!texture) {
      texture = proceduralVfx.has(effectId) ? createCombatEffectTexture(effectId) : createPixelTexture('loot', 'dungeon');
      this.textures.set(key, texture);
      const vfxId: Partial<Record<PixelEffectId, keyof typeof vfxVisuals>> = {
        bronze_impact: 'DAMAGE', laurel_light: 'HEAL', promethean_flame: 'FIREBALL',
        soul_ash: 'ENEMY_DEATH', cistern_splash: 'ICE', oracle_spark: 'LIGHTNING', serpent_venom: 'POISON',
      };
      const fallback = vfxId[effectId];
      if (fallback) this.loadLocal(texture, vfxVisuals[fallback]);
    }
    return texture;
  }

  shieldTexture(): THREE.CanvasTexture {
    const key = 'shield:aspis';
    let texture = this.textures.get(key);
    if (!texture) {
      texture = createPixelTexture('loot', 'dungeon');
      this.textures.set(key, texture);
      this.loadLocal(texture, shieldVisual);
    }
    return texture;
  }

  private loadLocal(texture: THREE.CanvasTexture, path?: string): void {
    if (!path || typeof Image === 'undefined') return;
    const image = new Image();
    image.onload = () => { (texture as THREE.Texture<unknown>).source.data = image; texture.needsUpdate = true; };
    image.src = path;
  }

  dispose(): void {
    this.textures.forEach(texture => texture.dispose());
    this.textures.clear();
  }
}
