import * as THREE from 'three';
import type { PlayerCharacter, WorldEnemy, WorldLootDrop, WorldProjectile } from '../types';
import type { ActivePlayerAction } from '../player/PlayerCombat';
import type { DungeonWorldState } from '../world/DungeonWorld';
import { AssetManager } from '../presentation/AssetManager';
import { animateEnemySprite, createEnemySprite } from '../presentation/SpriteAnimator';
import { CharacterRigAnimator } from '../presentation/CharacterRigAnimator';
import { CHARACTER_RIG_MANIFEST, getCharacterRigDefinition } from '../data/characterRigs';
import { WeaponPresenter } from '../presentation/WeaponPresenter';
import { VFXSystem, type PixelEffectId, type VFXMode, type VFXPriority } from '../presentation/VFXSystem';
import { WorldGeometry } from '../world/WorldGeometry';
import { getEnemyAttackDefinition } from '../data/enemyAttacks';
import { getEnemyAttackTelegraphDescriptor } from '../data/enemyAttackTelegraph';
import { getVfxPoolCapacity, resolveSurfaceEffect } from '../presentation/vfxDefinitions';
import type { VFXSurface } from '../presentation/vfxDefinitions';
import type { CombatCue } from '../services/combatAudioPolicy';
import { getEnemyCorpseVisualPhase, shouldReplaceWithCorpse } from '../presentation/enemyCorpsePresentation';
import { enemyVisuals } from '../data/assetRegistry';

type EnemyVisualInstance =
  | { kind: 'legacy'; sprite: THREE.Sprite }
  | { kind: 'rig'; animator: CharacterRigAnimator }
  | { kind: 'corpse'; mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> };

export type RenderQuality = 'performance' | 'balanced' | 'crisp';

export const RENDER_QUALITY_SCALES: Record<RenderQuality, { desktop: number; mobile: number }> = {
  performance: { desktop: 0.75, mobile: 0.45 },
  balanced: { desktop: 0.9, mobile: 0.58 },
  crisp: { desktop: 1, mobile: 0.72 },
};
export const DEFAULT_PIXEL_RENDER_SCALE = RENDER_QUALITY_SCALES.balanced.desktop;
export const MOBILE_PIXEL_RENDER_SCALE = RENDER_QUALITY_SCALES.balanced.mobile;

export function parseRenderQualityPreference(value: string | null): RenderQuality | null {
  if (value === 'performance' || value === 'balanced' || value === 'crisp') return value;
  if (value === 'sharp') return 'crisp';
  return null;
}

export function getPixelRenderSize(viewportWidth: number, viewportHeight: number, isMobile: boolean, quality: RenderQuality = 'balanced'): { width: number; height: number; scale: number } {
  if (viewportWidth <= 0 || viewportHeight <= 0) return { width: 0, height: 0, scale: 0 };
  const requestedScale = isMobile ? RENDER_QUALITY_SCALES[quality].mobile : RENDER_QUALITY_SCALES[quality].desktop;
  const minimumScale = Math.min(1, Math.max(160 / viewportWidth, 120 / viewportHeight));
  const scale = Math.min(1, Math.max(requestedScale, minimumScale));
  return { width: Math.max(1, Math.round(viewportWidth * scale)), height: Math.max(1, Math.round(viewportHeight * scale)), scale };
}

export function attachCameraToScene(scene: THREE.Scene, camera: THREE.Camera): void {
  if (camera.parent !== scene) scene.add(camera);
}

function isInSceneGraph(scene: THREE.Scene, object: THREE.Object3D): boolean {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) if (node === scene) return true;
  return false;
}

export interface VisualEvent {
  kind: 'audio' | 'telegraph' | 'impact' | 'melee' | 'area' | 'cast' | 'enemyHit' | 'enemyDeath' | 'pickup' | 'dodge' | 'bossPhase';
  position: { x: number; y: number; z: number };
  color?: string;
  scale?: number;
  effectId?: PixelEffectId;
  direction?: { x: number; z: number };
  priority?: VFXPriority;
  surface?: VFXSurface;
  sourceId?: string;
  ownerId?: string;
  sound?: CombatCue;
}

export class SceneRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(72, 1, 0.045, 34);
  private readonly canvas: HTMLCanvasElement;
  private readonly assets = new AssetManager();
  private readonly enemyVisuals = new Map<string, EnemyVisualInstance>();
  private readonly rigConstructionFailures = new Set<string>();
  private readonly lootSprites = new Map<string, THREE.Sprite>();
  private readonly projectileMeshes = new Map<number, THREE.Mesh>();
  private readonly projectilePool: THREE.Mesh[] = [];
  private readonly availableProjectiles: THREE.Mesh[] = [];
  private readonly projectileGeometry = new THREE.SphereGeometry(0.09, 6, 6);
  private readonly projectileMaterials = new Map<string, THREE.MeshBasicMaterial>();
  private readonly enemyTelegraphs = new Map<string, {
    mesh: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
    rim: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
    trace?: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    attackId: string;
  }>();
  private readonly vfx: VFXSystem;
  private readonly weapon: WeaponPresenter;
  private geometry: WorldGeometry;
  private worldRevision: number;
  private readonly resizeObserver: ResizeObserver | null;
  private elapsedSeconds = 0;
  private worldEnemyCount = 0;
  private renderQuality: RenderQuality;
  private pixelScale = DEFAULT_PIXEL_RENDER_SCALE;
  private readonly diagnosticsPoint = new THREE.Vector3();
  private readonly diagnosticsMatrix = new THREE.Matrix4();
  private readonly diagnosticsFrustum = new THREE.Frustum();
  private readonly diagnosticsSphere = new THREE.Sphere();

  constructor(canvas: HTMLCanvasElement, world: DungeonWorldState, renderQuality: RenderQuality = 'balanced') {
    this.canvas = canvas;
    this.renderQuality = renderQuality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setClearColor(0x111016, 1);
    this.scene.background = new THREE.Color(0x111016);
    this.scene.fog = new THREE.Fog(0x111016, 8, 31);
    this.scene.add(new THREE.HemisphereLight(0xaaaec2, 0x34271f, 1.45));
    const keyLight = new THREE.DirectionalLight(0xffd7a0, 1.1);
    keyLight.position.set(-3, 8, 4);
    this.scene.add(keyLight);
    this.camera.rotation.order = 'YXZ';
    attachCameraToScene(this.scene, this.camera);
    this.geometry = new WorldGeometry(world, this.assets);
    this.scene.add(this.geometry.group);
    this.worldRevision = world.worldRevision;
    this.assets.characterRigAtlas();
    this.vfx = new VFXSystem(this.scene, this.assets, getVfxPoolCapacity(window.matchMedia?.('(max-width: 767px)').matches ?? false));
    const defaultProjectileMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.96 });
    this.projectileMaterials.set('__default', defaultProjectileMaterial);
    for (let index = 0; index < 64; index += 1) {
      const mesh = new THREE.Mesh(this.projectileGeometry, defaultProjectileMaterial);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.name = 'PooledProjectile_' + index;
      this.projectilePool.push(mesh);
      this.availableProjectiles.push(mesh);
      this.scene.add(mesh);
    }
    this.weapon = new WeaponPresenter(this.camera, this.assets);
    const resize = () => this.resize(canvas);
    resize();
    this.resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    this.resizeObserver?.observe(canvas);
    window.addEventListener('resize', resize);
    this.onDisposeResize = () => window.removeEventListener('resize', resize);
  }

  private readonly onDisposeResize: () => void;

  setVfxMode(mode: VFXMode): void {
    this.vfx.setMode(mode);
  }

  setRenderQuality(quality: RenderQuality): void {
    if (this.renderQuality === quality) return;
    this.renderQuality = quality;
    this.resize(this.canvas);
  }

  private resize(canvas: HTMLCanvasElement): void {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const isMobile = window.matchMedia?.('(max-width: 767px)').matches ?? false;
    const { width, height, scale } = getPixelRenderSize(bounds.width, bounds.height, isMobile, this.renderQuality);
    if (canvas.width !== width || canvas.height !== height) this.renderer.setSize(width, height, false);
    this.pixelScale = scale;
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.imageRendering = 'pixelated';
    this.camera.aspect = bounds.width / bounds.height;
    this.camera.updateProjectionMatrix();
  }

  renderFrame(args: {
    world: DungeonWorldState;
    player: PlayerCharacter;
    enemies: WorldEnemy[];
    projectiles: WorldProjectile[];
    loot: WorldLootDrop[];
    action: ActivePlayerAction | null;
    isMoving: boolean;
    guarding: boolean;
    paused: boolean;
    cameraBob: number;
    viewmodelEvent?: 'DODGE' | 'HIT_RECOIL' | 'ITEM_USE' | null;
    viewmodelEventProgress?: number;
    deltaSeconds: number;
    elapsedSeconds: number;
    events: VisualEvent[];
  }): void {
    const { world, player, enemies, projectiles, loot, action, isMoving, guarding, paused, cameraBob, viewmodelEvent, viewmodelEventProgress, deltaSeconds, elapsedSeconds, events } = args;
    this.elapsedSeconds = elapsedSeconds;
    if (world.worldRevision !== this.worldRevision) {
      this.clearEnemyVisuals();
      this.clearEnemyTelegraphs();
      this.vfx.clear();
      this.scene.remove(this.geometry.group);
      this.geometry.dispose();
      this.geometry = new WorldGeometry(world, this.assets);
      this.scene.add(this.geometry.group);
      this.worldRevision = world.worldRevision;
    }
    this.geometry.updateLighting(elapsedSeconds);
    this.camera.position.set(player.position.x, 1.52 + cameraBob, player.position.z);
    this.camera.rotation.set(player.rotation.pitch, -player.rotation.yaw - Math.PI / 2, 0, 'YXZ');
    this.weapon.update(player, action, isMoving, guarding, elapsedSeconds, viewmodelEvent, viewmodelEventProgress);
    this.syncEnemies(enemies, world, deltaSeconds);
    this.syncProjectiles(projectiles);
    this.syncLoot(loot);
    for (const event of events) {
      if (event.kind === 'audio') continue;
      const effect: PixelEffectId = event.effectId
        ?? (event.surface ? resolveSurfaceEffect(event.surface) : event.kind === 'enemyDeath' ? 'guardian_death' : event.kind === 'pickup' ? 'laurel_light' : event.kind === 'area' ? 'promethean_flame' : event.kind === 'dodge' ? 'cistern_splash' : 'generic_impact');
      const priority = event.priority ?? (event.kind === 'enemyDeath' || event.kind === 'bossPhase' ? 'critical_hit' : 'ordinary_hit');
      this.vfx.emit(effect, event.position, {
        color: event.color,
        scale: event.scale,
        direction: event.direction,
        priority,
        sourceId: event.sourceId,
        ownerId: event.ownerId,
      });
    }
    this.vfx.update(deltaSeconds, this.camera.rotation.y, paused);
    this.renderer.render(this.scene, this.camera);
  }

  getDiagnostics(): {
    worldEnemyCount: number;
    enemyVisualCount: number;
    enemyVisualsInCamera: number;
    atlas: ReturnType<AssetManager['getDiagnostics']>;
    viewmodels: ReturnType<WeaponPresenter['getDiagnostics']>;
    cameraAttachedToScene: boolean;
    drawingBuffer: { width: number; height: number; cssWidth: number; cssHeight: number; scale: number; quality: RenderQuality };
    render: { calls: number; triangles: number };
  } {
    this.camera.updateMatrixWorld(true);
    this.diagnosticsMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.diagnosticsFrustum.setFromProjectionMatrix(this.diagnosticsMatrix);
    let inCamera = 0;
    for (const visual of this.enemyVisuals.values()) {
      const root = visual.kind === 'rig' ? visual.animator.group : visual.kind === 'corpse' ? visual.mesh : visual.sprite;
      if (!root.visible || !isInSceneGraph(this.scene, root)) continue;
      root.getWorldPosition(this.diagnosticsPoint);
      this.diagnosticsSphere.center.copy(this.diagnosticsPoint);
      this.diagnosticsSphere.radius = visual.kind === 'rig' ? visual.animator.definition.worldHeight * 0.55 : visual.kind === 'corpse' ? 1.4 : 1.1;
      if (this.diagnosticsFrustum.intersectsSphere(this.diagnosticsSphere)) inCamera += 1;
    }
    const bounds = this.canvas.getBoundingClientRect();
    return {
      worldEnemyCount: this.worldEnemyCount,
      enemyVisualCount: this.enemyVisuals.size,
      enemyVisualsInCamera: inCamera,
      atlas: this.assets.getDiagnostics(),
      viewmodels: this.weapon.getDiagnostics(),
      cameraAttachedToScene: this.camera.parent === this.scene && isInSceneGraph(this.scene, this.camera),
      drawingBuffer: { width: this.canvas.width, height: this.canvas.height, cssWidth: bounds.width, cssHeight: bounds.height, scale: this.pixelScale, quality: this.renderQuality },
      render: { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles },
    };
  }

  private syncEnemies(enemies: WorldEnemy[], world: DungeonWorldState, deltaSeconds: number): void {
    this.worldEnemyCount = enemies.length;
    const ids = new Set(enemies.map(enemy => enemy.id));
    for (const [id, visual] of this.enemyVisuals) {
      if (!ids.has(id)) { this.disposeEnemyVisual(visual); this.enemyVisuals.delete(id); }
    }
    for (const [id, warning] of this.enemyTelegraphs) {
      if (!ids.has(id)) { this.disposeTelegraph(warning); this.enemyTelegraphs.delete(id); }
    }
    const atlas = this.assets.characterRigAtlas();
    for (const enemy of enemies) {
      const definition = getCharacterRigDefinition(enemy.visualId);
      const shouldUseRig = Boolean(definition && atlas && !this.rigConstructionFailures.has(enemy.visualId));
      let visual = this.enemyVisuals.get(enemy.id);
      const visualPhase = getEnemyCorpseVisualPhase(enemy);
      if (visualPhase === 'corpse') {
        const staleWarning = this.enemyTelegraphs.get(enemy.id);
        if (staleWarning) {
          this.disposeTelegraph(staleWarning);
          this.enemyTelegraphs.delete(enemy.id);
        }
        if (shouldReplaceWithCorpse(visual?.kind ?? null, enemy)) {
          if (visual) this.disposeEnemyVisual(visual);
          const corpseVisual = this.createCorpseVisual(enemy, world, definition?.fallbackSprite);
          visual = corpseVisual;
          this.enemyVisuals.set(enemy.id, corpseVisual);
          this.scene.add(corpseVisual.mesh);
        }
        const corpse = visual && visual.kind === 'corpse' ? visual.mesh : undefined;
        if (corpse) corpse.position.set(enemy.position.x, enemy.position.y + 0.025, enemy.position.z);
        continue;
      }
      if (visual?.kind === 'corpse') {
        this.disposeEnemyVisual(visual);
        this.enemyVisuals.delete(enemy.id);
        visual = undefined;
      }
      if (visual && ((visual.kind === 'rig') !== shouldUseRig)) {
        this.disposeEnemyVisual(visual);
        this.enemyVisuals.delete(enemy.id);
        visual = undefined;
      }
      if (!visual) {
        if (shouldUseRig && definition && atlas) {
          try {
            const animator = new CharacterRigAnimator(enemy, definition, atlas, CHARACTER_RIG_MANIFEST.atlasWidth, CHARACTER_RIG_MANIFEST.atlasHeight, CHARACTER_RIG_MANIFEST.cellSize);
            visual = { kind: 'rig', animator };
            this.scene.add(animator.group);
          } catch (error) {
            this.rigConstructionFailures.add(enemy.visualId);
            if (import.meta.env.DEV) console.error(`[SceneRenderer] Rig ${enemy.visualId} failed; using its local enemy sprite fallback.`, error);
            visual = { kind: 'legacy', sprite: createEnemySprite(enemy, world.biome, this.assets, definition.fallbackSprite) };
            this.scene.add(visual.sprite);
          }
        } else {
          const sprite = createEnemySprite(enemy, world.biome, this.assets, definition?.fallbackSprite);
          visual = { kind: 'legacy', sprite };
          this.scene.add(sprite);
        }
        this.enemyVisuals.set(enemy.id, visual);
      }
      if (visual.kind === 'rig') visual.animator.update(enemy, this.camera.position, this.elapsedSeconds, deltaSeconds);
      else animateEnemySprite(visual.sprite, enemy, this.elapsedSeconds);
      let warningEntry = this.enemyTelegraphs.get(enemy.id);
      let warning = warningEntry?.mesh;
      const attack = enemy.state === 'ATTACK_WINDUP' ? getEnemyAttackDefinition(enemy.attackSetId, enemy.activeAttackId, enemy.phase ?? 1) : undefined;
      if (!attack) {
        if (warningEntry) {
          warningEntry.mesh.visible = false;
          warningEntry.rim.visible = false;
          if (warningEntry.trace) warningEntry.trace.visible = false;
        }
        continue;
      }
      if (warning && warningEntry && warningEntry.attackId !== attack.id) {
        this.disposeTelegraph(warningEntry);
        this.enemyTelegraphs.delete(enemy.id);
        warning = undefined;
      }
      if (!warning) {
        const descriptor = getEnemyAttackTelegraphDescriptor(attack);
        const geometry = new THREE.CircleGeometry(1, 32, -descriptor.arcRadians / 2, descriptor.arcRadians);
        const material = new THREE.MeshBasicMaterial({ color: attack.telegraphColor, transparent: true, opacity: 0.12, depthTest: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 });
        warning = new THREE.Mesh(geometry, material);
        warning.rotation.x = -Math.PI / 2;
        warning.renderOrder = 2;
        warning.name = 'AttackTelegraph_' + enemy.id;
        const rimGeometry = new THREE.RingGeometry(0.955, 1, 32, 1, -descriptor.arcRadians / 2, descriptor.arcRadians);
        const rimMaterial = new THREE.MeshBasicMaterial({ color: attack.telegraphColor, transparent: true, opacity: 0.76, depthTest: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
        const rim = new THREE.Mesh(rimGeometry, rimMaterial);
        rim.rotation.x = -Math.PI / 2;
        rim.renderOrder = 3;
        rim.name = 'AttackTelegraphRim_' + enemy.id;
        let trace: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> | undefined;
        if (descriptor.kind !== 'circle') {
          const traceGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)]);
          const traceMaterial = new THREE.LineBasicMaterial({ color: attack.telegraphColor, transparent: true, opacity: 0.72, depthTest: true, depthWrite: false });
          trace = new THREE.Line(traceGeometry, traceMaterial);
          trace.renderOrder = 4;
          trace.name = 'AttackTelegraphTrace_' + enemy.id;
        }
        warningEntry = { mesh: warning, rim, trace, attackId: attack.id };
        this.enemyTelegraphs.set(enemy.id, warningEntry);
        this.scene.add(warning);
        this.scene.add(rim);
        if (trace) this.scene.add(trace);
        warning.scale.setScalar(descriptor.radius);
        rim.scale.setScalar(descriptor.radius);
      }
      warning.visible = true;
      const descriptor = getEnemyAttackTelegraphDescriptor(attack);
      const warningPosition = descriptor.center === 'target' ? enemy.telegraphPosition ?? enemy.position : enemy.position;
      warning.position.set(warningPosition.x, 0.028, warningPosition.z);
      warning.scale.setScalar(descriptor.radius);
      warning.rotation.set(-Math.PI / 2, descriptor.kind === 'circle' ? 0 : -(enemy.facingYaw ?? 0), 0);
      warning.material.opacity = 0.09 + Math.sin(this.elapsedSeconds * 10) * 0.025;
      const rim = warningEntry!.rim;
      rim.visible = true;
      rim.position.copy(warning.position);
      rim.rotation.copy(warning.rotation);
      rim.scale.setScalar(descriptor.radius);
      rim.material.opacity = (enemy.isBoss ? 0.78 : 0.56) + Math.sin(this.elapsedSeconds * 10) * 0.1;
      if (warningEntry!.trace) {
        const trace = warningEntry!.trace;
        trace.visible = true;
        trace.position.set(warningPosition.x, 0.042, warningPosition.z);
        trace.rotation.copy(warning.rotation);
        trace.scale.set(descriptor.radius, 1, 1);
        trace.material.opacity = (enemy.isBoss ? 0.88 : 0.68) + Math.sin(this.elapsedSeconds * 10) * 0.08;
      }
    }
  }

  private createCorpseVisual(enemy: WorldEnemy, world: DungeonWorldState, fallbackPath?: string): Extract<EnemyVisualInstance, { kind: 'corpse' }> {
    const size = enemyVisuals[enemy.visualId]?.scale ?? 1;
    const width = (enemy.isBoss ? 1.02 : 0.72) * size;
    const length = (enemy.isBoss ? 1.72 : 1.24) * size;
    const geometry = new THREE.PlaneGeometry(width, length);
    const material = new THREE.MeshBasicMaterial({
      map: this.assets.enemyTexture(enemy.visualId, world.biome, fallbackPath),
      color: 0xc2b7a9,
      transparent: true,
      opacity: 0.94,
      alphaTest: 0.08,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'EnemyCorpse_' + enemy.id;
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    const floorOrientation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const facingOrientation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), enemy.facingYaw ?? 0);
    mesh.quaternion.copy(facingOrientation.multiply(floorOrientation));
    mesh.position.set(enemy.position.x, enemy.position.y + 0.025, enemy.position.z);
    mesh.userData.interactive = false;
    mesh.userData.corpseOwnerId = enemy.id;
    return { kind: 'corpse', mesh };
  }

  private syncProjectiles(projectiles: WorldProjectile[]): void {
    const active = new Set(projectiles.map(projectile => projectile.id));
    this.vfx.retainProjectileTrails(active);
    for (const [id, mesh] of this.projectileMeshes) {
      if (!active.has(id)) {
        mesh.visible = false;
        this.projectileMeshes.delete(id);
        this.availableProjectiles.push(mesh);
      }
    }
    for (const projectile of projectiles) {
      let mesh = this.projectileMeshes.get(projectile.id);
      if (!mesh) {
        let material = this.projectileMaterials.get(projectile.color);
        if (!material) {
          material = new THREE.MeshBasicMaterial({ color: projectile.color, transparent: true, opacity: 0.96 });
          this.projectileMaterials.set(projectile.color, material);
        }
        mesh = this.availableProjectiles.pop();
        if (!mesh) continue;
        mesh.material = material;
        mesh.name = 'Projectile_' + projectile.id;
        this.projectileMeshes.set(projectile.id, mesh);
      }
      mesh.position.set(projectile.position.x, projectile.position.y, projectile.position.z);
      const size = projectile.radius * 1.8;
      mesh.scale.setScalar(size);
      mesh.visible = true;
      this.vfx.trail(projectile.id, projectile.position, projectile.color, projectileTrailEffect(projectile.sourceAbilityId, projectile.statusEffect?.statusId), projectile.sourceAbilityId);
    }
  }

  private syncLoot(loot: WorldLootDrop[]): void {
    const ids = new Set(loot.map(drop => drop.id));
    for (const [id, sprite] of this.lootSprites) {
      if (!ids.has(id)) { this.scene.remove(sprite); sprite.material.dispose(); this.lootSprites.delete(id); }
    }
    for (const drop of loot) {
      let sprite = this.lootSprites.get(drop.id);
      if (!sprite) {
        const material = new THREE.SpriteMaterial({ map: this.assets.itemTexture(drop.item), transparent: true, alphaTest: 0.06, depthTest: true, depthWrite: false });
        sprite = new THREE.Sprite(material);
        sprite.center.set(0.5, 0);
        sprite.scale.set(0.46, 0.46, 1);
        sprite.name = 'Loot_' + drop.id;
        sprite.userData.itemTextureKey = itemTextureKey(drop);
        this.lootSprites.set(drop.id, sprite);
        this.scene.add(sprite);
      }
      const textureKey = itemTextureKey(drop);
      if (sprite.userData.itemTextureKey !== textureKey) {
        sprite.material.map = this.assets.itemTexture(drop.item);
        sprite.material.needsUpdate = true;
        sprite.userData.itemTextureKey = textureKey;
      }
      sprite.material.color.set(drop.item.rarity === 'UNIQUE' ? '#fff0c1' : '#ffffff');
      const scale = drop.item.rarity === 'UNIQUE' ? 0.56 + Math.sin(this.elapsedSeconds * 4 + drop.position.z) * 0.025
        : drop.item.rarity === 'RARE' ? 0.5 : 0.44;
      sprite.scale.set(scale, scale, 1);
      sprite.position.set(drop.position.x, 0.12 + Math.sin(this.elapsedSeconds * 3 + drop.position.x) * 0.04, drop.position.z);
    }
  }

  private disposeEnemyVisual(visual: EnemyVisualInstance): void {
    if (visual.kind === 'rig') {
      visual.animator.dispose();
      return;
    }
    if (visual.kind === 'corpse') {
      this.scene.remove(visual.mesh);
      visual.mesh.geometry.dispose();
      visual.mesh.material.dispose();
      return;
    }
    this.scene.remove(visual.sprite);
    visual.sprite.material.dispose();
  }

  private clearEnemyVisuals(): void {
    for (const visual of this.enemyVisuals.values()) this.disposeEnemyVisual(visual);
    this.enemyVisuals.clear();
  }

  private clearEnemyTelegraphs(): void {
    for (const warning of this.enemyTelegraphs.values()) this.disposeTelegraph(warning);
    this.enemyTelegraphs.clear();
  }

  private disposeTelegraph(warning: {
    mesh: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
    rim: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
    trace?: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  }): void {
    this.scene.remove(warning.mesh, warning.rim);
    if (warning.trace) this.scene.remove(warning.trace);
    warning.mesh.geometry.dispose();
    warning.mesh.material.dispose();
    warning.rim.geometry.dispose();
    warning.rim.material.dispose();
    warning.trace?.geometry.dispose();
    warning.trace?.material.dispose();
  }

  dispose(): void {
    this.resizeObserver?.disconnect();
    this.onDisposeResize();
    this.weapon.dispose();
    this.scene.remove(this.camera);
    this.vfx.dispose();
    this.scene.remove(this.geometry.group);
    this.geometry.dispose();
    this.clearEnemyVisuals();
    for (const sprite of this.lootSprites.values()) sprite.material.dispose();
    this.clearEnemyTelegraphs();
    this.lootSprites.clear();
    for (const mesh of this.projectilePool) this.scene.remove(mesh);
    for (const material of this.projectileMaterials.values()) material.dispose();
    this.projectileMeshes.clear();
    this.projectileMaterials.clear();
    this.projectilePool.length = 0;
    this.availableProjectiles.length = 0;
    this.projectileGeometry.dispose();
    this.assets.dispose();
    this.renderer.dispose();
  }
}

function itemTextureKey(drop: WorldLootDrop): string {
  return [drop.item.baseId ?? drop.item.id, drop.item.rarity, drop.item.uniqueEffectId ?? ''].join(':');
}

function projectileTrailEffect(abilityId: string, statusId?: string): PixelEffectId {
  if (statusId === 'CURSE' || /necromancer_|shade_mark|death_burst|soul_drain|chthonic|underworld/i.test(abilityId)) return 'soul_ash';
  if (abilityId === 'weapon_bow_arrow_shot' || abilityId === 'weapon_bow_charged_arrow' || abilityId === 'ranger_shortbow' || abilityId === 'ranger_piercing_arrow') return 'arrow_trail';
  if (abilityId === 'ranger_volley' || abilityId === 'ranger_piercing_hunt' || abilityId === 'rogue_knife_fan') return 'ariadne_thread';
  if (statusId === 'POISON') return 'venom_droplets';
  if (statusId === 'BURN') return 'fire_embers';
  if (statusId === 'SLOW') return 'web_threads';
  if (/boulder/i.test(abilityId)) return 'stone_chips';
  if (statusId === 'WEAKNESS' || /chthonic|underworld|warden|curse|grasp/i.test(abilityId)) return 'soul_ash';
  return 'oracle_spark';
}
