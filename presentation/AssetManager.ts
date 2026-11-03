import * as THREE from 'three';
import type { BiomeId, ItemInstance, WeaponVisualType } from '../types';
import { createCombatEffectTexture, createEnemyTexture, createPixelTexture, createWeaponTexture } from './PixelArtRenderer';
import { biomeVisuals, enemyVisuals, mythicVfxAtlasPath, offhandVisuals, propVisuals, shieldVisual, weaponVisuals, type OffHandVisualType } from '../data/assetRegistry';
import { CHARACTER_RIG_MANIFEST, validateCharacterRigManifest } from '../data/characterRigs';
import { VFX_DEFINITIONS, type PixelEffectId } from './vfxDefinitions';
import vfxAtlasManifest from '../data/generated/mythicVfxAtlas.json';
import { createItemIconCanvas } from './ItemIconRenderer';

interface VFXAtlasManifest {
  atlasPath: string;
  width: number;
  height: number;
  frames: Record<string, { x: number; y: number; width: number; height: number }>;
}

type AtlasLoadState = 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';
type LocalTextureState = 'loading' | 'ready' | 'error' | 'unavailable';

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
  private characterRigState: AtlasLoadState = 'idle';
  private readonly localImages = new Set<HTMLImageElement>();
  private readonly localTextureStates = new Map<string, LocalTextureState>();
  private readonly loadErrors = new Set<string>();
  private generation = 0;

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

  enemyTexture(visualId: string, biome: BiomeId, fallbackPath?: string): THREE.CanvasTexture {
    const key = 'enemy:' + visualId + ':' + biome;
    let texture = this.textures.get(key);
    if (!texture) {
      texture = createEnemyTexture(visualId, biome);
      this.textures.set(key, texture);
      const path = fallbackPath ?? enemyVisuals[visualId]?.sprite;
      if (path) this.loadLocal(texture, path);
      else {
        this.localTextureStates.set('enemy:' + visualId, 'error');
        this.reportLoadError('enemy:' + visualId, 'no local sprite path; procedural enemy fallback remains active');
      }
    }
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
      const manifestIssues = validateCharacterRigManifest();
      if (manifestIssues.length) {
        this.characterRigState = 'error';
        this.reportLoadError(CHARACTER_RIG_MANIFEST.atlasPath, manifestIssues.join(' '));
        return null;
      }
      if (typeof Image === 'undefined') {
        this.characterRigState = 'unavailable';
        return null;
      }
      const texture = new THREE.Texture();
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      const image = new Image();
      const generation = this.generation;
      this.localImages.add(image);
      this.characterRigState = 'loading';
      image.onload = () => {
        this.localImages.delete(image);
        if (generation !== this.generation || this.characterRigTexture !== texture) return;
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        if (width !== CHARACTER_RIG_MANIFEST.atlasWidth || height !== CHARACTER_RIG_MANIFEST.atlasHeight) {
          this.characterRigReady = false;
          this.characterRigState = 'error';
          this.characterRigImage = null;
          this.reportLoadError(CHARACTER_RIG_MANIFEST.atlasPath, `expected ${CHARACTER_RIG_MANIFEST.atlasWidth}x${CHARACTER_RIG_MANIFEST.atlasHeight}, received ${width}x${height}`);
          return;
        }
        const alphaIssue = this.validateCharacterRigAtlasAlpha(image);
        if (alphaIssue) {
          this.characterRigReady = false;
          this.characterRigState = 'error';
          this.characterRigImage = null;
          this.reportLoadError(CHARACTER_RIG_MANIFEST.atlasPath, alphaIssue);
          return;
        }
        texture.image = image;
        texture.needsUpdate = true;
        this.characterRigReady = true;
        this.characterRigState = 'ready';
        this.characterRigImage = null;
      };
      image.onerror = () => {
        this.localImages.delete(image);
        if (generation !== this.generation || this.characterRigTexture !== texture) return;
        this.characterRigReady = false;
        this.characterRigState = 'error';
        this.characterRigImage = null;
        this.reportLoadError(CHARACTER_RIG_MANIFEST.atlasPath, 'image request failed; legacy enemy sprite fallbacks remain active');
      };
      this.characterRigTexture = texture;
      this.characterRigImage = image;
      image.src = CHARACTER_RIG_MANIFEST.atlasPath;
    }
    return this.characterRigReady ? this.characterRigTexture : null;
  }

  private loadLocal(texture: THREE.CanvasTexture, path?: string): void {
    if (!path) return;
    if (typeof Image === 'undefined') {
      this.localTextureStates.set(path, 'unavailable');
      return;
    }
    const generation = this.generation;
    const image = new Image();
    this.localImages.add(image);
    this.localTextureStates.set(path, 'loading');
    image.onload = () => {
      this.localImages.delete(image);
      if (generation !== this.generation) return;
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (width <= 0 || height <= 0) {
        this.localTextureStates.set(path, 'error');
        this.reportLoadError(path, 'image decoded with empty dimensions; procedural fallback remains active');
        return;
      }
      if (!this.hasVisiblePixels(image, width, height)) {
        this.localTextureStates.set(path, 'error');
        this.reportLoadError(path, 'image contains no visible alpha; procedural fallback remains active');
        return;
      }
      (texture as THREE.Texture<unknown>).source.data = image;
      texture.needsUpdate = true;
      this.localTextureStates.set(path, 'ready');
    };
    image.onerror = () => {
      this.localImages.delete(image);
      if (generation !== this.generation) return;
      this.localTextureStates.set(path, 'error');
      this.reportLoadError(path, 'image request failed; procedural fallback remains active');
    };
    image.src = path;
  }

  private reportLoadError(path: string, reason: string): void {
    this.loadErrors.add(`${path}: ${reason}`);
    if (import.meta.env.DEV) console.error(`[AssetManager] ${path}: ${reason}`);
  }

  private validateCharacterRigAtlasAlpha(image: HTMLImageElement): string | null {
    const canvas = document.createElement('canvas');
    canvas.width = CHARACTER_RIG_MANIFEST.atlasWidth;
    canvas.height = CHARACTER_RIG_MANIFEST.atlasHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return 'could not validate atlas alpha; legacy enemy sprites remain active';
    try {
      context.drawImage(image, 0, 0);
      for (const [visualId, rig] of Object.entries(CHARACTER_RIG_MANIFEST.rigs)) {
        const views = rig.layers.some(layer => layer.viewCells) ? ['front', 'threeQuarter', 'back'] as const : ['default'] as const;
        for (const view of views) {
          let hasPixels = false;
          for (const layer of rig.layers) {
            const cell = view === 'default' ? layer.cell : layer.viewCells?.[view] ?? layer.cell;
            const alpha = context.getImageData(cell[0], cell[1], CHARACTER_RIG_MANIFEST.cellSize, CHARACTER_RIG_MANIFEST.cellSize).data;
            for (let index = 3; index < alpha.length; index += 4) {
              if (alpha[index] > 8) { hasPixels = true; break; }
            }
            if (hasPixels) break;
          }
          if (!hasPixels) return `${visualId}/${view} has no nonzero alpha pixels; legacy enemy sprites remain active`;
        }
      }
    } catch (error) {
      return `atlas alpha validation failed (${error instanceof Error ? error.message : 'unknown error'}); legacy enemy sprites remain active`;
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
    return null;
  }

  private hasVisiblePixels(image: HTMLImageElement, width: number, height: number): boolean {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return false;
    try {
      context.drawImage(image, 0, 0);
      const alpha = context.getImageData(0, 0, width, height).data;
      for (let index = 3; index < alpha.length; index += 4) if (alpha[index] > 8) return true;
      return false;
    } catch {
      return false;
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  getDiagnostics(): {
    characterRigAtlas: { state: AtlasLoadState; path: string; width: number; height: number };
    localTextures: Record<string, LocalTextureState>;
    loadErrors: string[];
  } {
    return {
      characterRigAtlas: {
        state: this.characterRigState,
        path: CHARACTER_RIG_MANIFEST.atlasPath,
        width: CHARACTER_RIG_MANIFEST.atlasWidth,
        height: CHARACTER_RIG_MANIFEST.atlasHeight,
      },
      localTextures: Object.fromEntries(this.localTextureStates),
      loadErrors: [...this.loadErrors],
    };
  }

  dispose(): void {
    this.generation += 1;
    for (const image of this.localImages) {
      image.onload = null;
      image.onerror = null;
      image.src = '';
    }
    this.localImages.clear();
    if (this.characterRigImage) {
      this.characterRigImage.onload = null;
      this.characterRigImage.onerror = null;
      this.characterRigImage = null;
    }
    this.characterRigTexture?.dispose();
    this.characterRigTexture = null;
    this.characterRigReady = false;
    this.characterRigState = 'idle';
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
    this.localTextureStates.clear();
    this.loadErrors.clear();
  }
}
