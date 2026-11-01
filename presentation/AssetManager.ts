import * as THREE from 'three';
import type { BiomeId, WeaponVisualType } from '../types';
import { createEnemyTexture, createPixelTexture, createWeaponTexture } from './PixelArtRenderer';

export class AssetManager {
  private readonly textures = new Map<string, THREE.CanvasTexture>();

  texture(kind: 'wall' | 'floor' | 'ceiling' | 'door' | 'exit' | 'loot', biome: BiomeId): THREE.CanvasTexture {
    const key = kind + ':' + biome;
    let texture = this.textures.get(key);
    if (!texture) { texture = createPixelTexture(kind, biome); this.textures.set(key, texture); }
    return texture;
  }

  enemyTexture(visualId: string, biome: BiomeId): THREE.CanvasTexture {
    const key = 'enemy:' + visualId + ':' + biome;
    let texture = this.textures.get(key);
    if (!texture) { texture = createEnemyTexture(visualId, biome); this.textures.set(key, texture); }
    return texture;
  }

  weaponTexture(weaponType: WeaponVisualType, classId: string): THREE.CanvasTexture {
    const key = 'weapon:' + weaponType + ':' + classId;
    let texture = this.textures.get(key);
    if (!texture) { texture = createWeaponTexture(weaponType, classId); this.textures.set(key, texture); }
    return texture;
  }

  dispose(): void {
    this.textures.forEach(texture => texture.dispose());
    this.textures.clear();
  }
}
