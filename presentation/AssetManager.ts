import * as THREE from 'three';
import type { BiomeId, ItemInstance, WeaponVisualType } from '../types';
import { createCombatEffectTexture, createEnemyTexture, createPixelTexture, createWeaponTexture } from './PixelArtRenderer';
import { biomeVisuals, enemyVisuals, mythicVfxAtlasPath, offhandVisuals, propVisuals, shieldVisual, weaponVisuals, type OffHandVisualType } from '../data/assetRegistry';
import { CHARACTER_RIG_MANIFEST } from '../data/characterRigs';
import { VFX_DEFINITIONS, type PixelEffectId } from './vfxDefinitions';
import vfxAtlasManifest from '../data/generated/mythicVfxAtlas.json';
import { createItemIconCanvas } from './ItemIconRenderer';

interface VFXAtlasManifest {
  atlasPath: string;
  width: number;
  height: number;
  frames: Record<string, { x: number; y: number; width: number; height: number }>;
}

const MYTHIC_VFX_ATLAS = vfxAtlasManifest as unknown as VFXAtlasManifest;

export class AssetManager {
  private readonly textures = new Map<string, THREE.CanvasTexture>();
  private readonly vfxFallbacks = new Map<PixelEffectId, THREE.Texture>();
  private readonly vfxAtlasViews = new Map<PixelEffectId, THREE.Texture>();
  private vfxAtlasTexture: THREE.Texture | null = null;
  private vfxAtlasImage: HTMLImageElement | null = null;
  private vfxAtlasLoadStarted = false;
  private characterRigTexture: THREE.Texture | null = null;
  private characterRigImage: HTMLImageElement | null = null;
  private characterRigLoadStarted = false;
  private characterRigReady = false;

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

  offhandTexture(handType: OffHandVisualType): THREE.CanvasTexture {
    const key = 'offhand:' + handType;
    let texture = this.textures.get(key);
    if (!texture) {
      texture = createPixelTexture('loot', 'dungeon');
      this.textures.set(key, texture);
      this.loadLocal(texture, offhandVisuals[handType]);
    }
    return texture;
  }

  itemTexture(item: ItemInstance): THREE.CanvasTexture {
    const key = 'item:' + (item.baseId ?? item.id) + ':' + item.rarity + ':' + (item.uniqueEffectId ?? '');
    let texture = this.textures.get(key);
    if (!texture) {
      const fallback = createPixelTexture('loot', 'dungeon');
      const icon = createItemIconCanvas(item);
      if (icon) { fallback.image = icon; fallback.needsUpdate = true; }
      fallback.colorSpace = THREE.SRGBColorSpace;
      fallback.magFilter = THREE.NearestFilter;
      fallback.minFilter = THREE.NearestFilter;
      fallback.generateMipmaps = false;
      this.textures.set(key, fallback);
      texture = fallback;
    }
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

  vfxTexture(effectId: PixelEffectId): THREE.Texture {
    this.loadVfxAtlas();
    const atlasView = this.vfxAtlasViews.get(effectId);
    if (atlasView) return atlasView;
    let fallback = this.vfxFallbacks.get(effectId);
    if (!fallback) {
      fallback = typeof document !== 'undefined' ? createCombatEffectTexture(effectId) : new THREE.Texture();
      fallback.colorSpace = THREE.SRGBColorSpace;
      fallback.magFilter = THREE.NearestFilter;
      fallback.minFilter = THREE.NearestFilter;
      fallback.generateMipmaps = false;
      this.vfxFallbacks.set(effectId, fallback);
    }
    return fallback;
  }

  private loadVfxAtlas(): void {
    if (this.vfxAtlasLoadStarted) return;
    this.vfxAtlasLoadStarted = true;
    if (typeof Image === 'undefined') return;
    const texture = new THREE.Texture();
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    const image = new Image();
    image.onload = () => {
      if (this.vfxAtlasTexture !== texture) return;
      texture.image = image;
      texture.needsUpdate = true;
      this.vfxAtlasImage = null;
      this.createVfxAtlasViews(texture);
    };
    image.onerror = () => {
      if (this.vfxAtlasTexture !== texture) return;
      this.vfxAtlasTexture = null;
      this.vfxAtlasImage = null;
    };
    this.vfxAtlasTexture = texture;
    this.vfxAtlasImage = image;
    image.src = mythicVfxAtlasPath;
  }

  private createVfxAtlasViews(atlas: THREE.Texture): void {
    for (const effectId of Object.keys(VFX_DEFINITIONS) as PixelEffectId[]) {
      const cell = MYTHIC_VFX_ATLAS.frames[effectId];
      if (!cell) continue;
      const view = atlas.clone();
      view.offset.set(cell.x / MYTHIC_VFX_ATLAS.width, 1 - (cell.y + cell.height) / MYTHIC_VFX_ATLAS.height);
      view.repeat.set(cell.width / MYTHIC_VFX_ATLAS.width, cell.height / MYTHIC_VFX_ATLAS.height);
      view.wrapS = THREE.ClampToEdgeWrapping;
      view.wrapT = THREE.ClampToEdgeWrapping;
      view.magFilter = THREE.NearestFilter;
      view.minFilter = THREE.NearestFilter;
      view.generateMipmaps = false;
      view.colorSpace = THREE.SRGBColorSpace;
      view.needsUpdate = true;
      this.vfxAtlasViews.set(effectId, view);
    }
    this.vfxFallbacks.forEach(texture => texture.dispose());
    this.vfxFallbacks.clear();
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

  /** Starts one local atlas request and returns the shared texture after its image is ready. */
  characterRigAtlas(): THREE.Texture | null {
    if (!this.characterRigLoadStarted) {
      this.characterRigLoadStarted = true;
      if (typeof Image === 'undefined') return null;
      const texture = new THREE.Texture();
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      const image = new Image();
      image.onload = () => {
        if (this.characterRigTexture !== texture) return;
        texture.image = image;
        texture.needsUpdate = true;
        this.characterRigReady = true;
        this.characterRigImage = null;
      };
      image.onerror = () => {
        if (this.characterRigTexture !== texture) return;
        this.characterRigReady = false;
        this.characterRigImage = null;
      };
      this.characterRigTexture = texture;
      this.characterRigImage = image;
      image.src = CHARACTER_RIG_MANIFEST.atlasPath;
    }
    return this.characterRigReady ? this.characterRigTexture : null;
  }

  private loadLocal(texture: THREE.CanvasTexture, path?: string): void {
    if (!path || typeof Image === 'undefined') return;
    const image = new Image();
    image.onload = () => { (texture as THREE.Texture<unknown>).source.data = image; texture.needsUpdate = true; };
    image.src = path;
  }

  dispose(): void {
    if (this.characterRigImage) {
      this.characterRigImage.onload = null;
      this.characterRigImage.onerror = null;
      this.characterRigImage = null;
    }
    this.characterRigTexture?.dispose();
    this.characterRigTexture = null;
    this.characterRigReady = false;
    if (this.vfxAtlasImage) {
      this.vfxAtlasImage.onload = null;
      this.vfxAtlasImage.onerror = null;
      this.vfxAtlasImage = null;
    }
    this.vfxAtlasTexture?.dispose();
    this.vfxAtlasTexture = null;
    this.vfxAtlasViews.forEach(texture => texture.dispose());
    this.vfxAtlasViews.clear();
    this.vfxFallbacks.forEach(texture => texture.dispose());
    this.vfxFallbacks.clear();
    this.textures.forEach(texture => texture.dispose());
    this.textures.clear();
  }
}
