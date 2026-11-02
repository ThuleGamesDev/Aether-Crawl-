import * as THREE from 'three';
import type { PlayerCharacter, WorldEnemy, WorldLootDrop, WorldProjectile } from '../types';
import type { ActivePlayerAction } from '../player/PlayerCombat';
import type { DungeonWorldState } from '../world/DungeonWorld';
import { AssetManager } from '../presentation/AssetManager';
import { animateEnemySprite, createEnemySprite } from '../presentation/SpriteAnimator';
import { CharacterRigAnimator } from '../presentation/CharacterRigAnimator';
import { CHARACTER_RIG_MANIFEST, getCharacterRigDefinition } from '../data/characterRigs';
import { WeaponPresenter } from '../presentation/WeaponPresenter';
import { VFXSystem, type PixelEffectId } from '../presentation/VFXSystem';
import { WorldGeometry } from '../world/WorldGeometry';
import { getEnemyAttackDefinition } from '../data/enemyAttacks';

type EnemyVisualInstance =
  | { kind: 'legacy'; sprite: THREE.Sprite }
  | { kind: 'rig'; animator: CharacterRigAnimator };

export const DEFAULT_PIXEL_RENDER_SCALE = 0.56;
export const MOBILE_PIXEL_RENDER_SCALE = DEFAULT_PIXEL_RENDER_SCALE * 0.78;

export function getPixelRenderSize(viewportWidth: number, viewportHeight: number, isMobile: boolean): { width: number; height: number; scale: number } {
  if (viewportWidth <= 0 || viewportHeight <= 0) return { width: 0, height: 0, scale: 0 };
  const requestedScale = isMobile ? MOBILE_PIXEL_RENDER_SCALE : DEFAULT_PIXEL_RENDER_SCALE;
  const minimumScale = Math.max(160 / viewportWidth, 120 / viewportHeight);
  const scale = Math.max(requestedScale, minimumScale);
  return { width: Math.max(1, Math.round(viewportWidth * scale)), height: Math.max(1, Math.round(viewportHeight * scale)), scale };
}

export interface VisualEvent {
  kind: 'audio' | 'telegraph' | 'impact' | 'melee' | 'area' | 'enemyHit' | 'enemyDeath' | 'pickup' | 'dodge' | 'bossPhase';
  position: { x: number; y: number; z: number };
  color?: string;
  scale?: number;
  effectId?: PixelEffectId;
  direction?: { x: number; z: number };
  sound?: 'blade' | 'spear' | 'shield' | 'cast' | 'projectile' | 'enemyHit' | 'playerHit' | 'poison' | 'bossTelegraph' | 'bossPhase' | 'bossDeath' | 'pickup' | 'dodge' | 'heal' | 'levelUp';
}

export class SceneRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(72, 1, 0.045, 34);
  private readonly assets = new AssetManager();
  private readonly enemyVisuals = new Map<string, EnemyVisualInstance>();
  private readonly lootSprites = new Map<string, THREE.Sprite>();
  private readonly projectileMeshes = new Map<number, THREE.Mesh>();
  private readonly projectilePool: THREE.Mesh[] = [];
  private readonly availableProjectiles: THREE.Mesh[] = [];
  private readonly projectileGeometry = new THREE.SphereGeometry(0.09, 6, 6);
  private readonly projectileMaterials = new Map<string, THREE.MeshBasicMaterial>();
  private readonly enemyTelegraphs = new Map<string, { mesh: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>; attackId: string }>();
  private readonly vfx: VFXSystem;
  private readonly weapon: WeaponPresenter;
  private geometry: WorldGeometry;
  private worldRevision: number;
  private readonly resizeObserver: ResizeObserver | null;
  private elapsedSeconds = 0;

  constructor(canvas: HTMLCanvasElement, world: DungeonWorldState) {
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
    this.geometry = new WorldGeometry(world, this.assets);
    this.scene.add(this.geometry.group);
    this.worldRevision = world.worldRevision;
    this.assets.characterRigAtlas();
    this.vfx = new VFXSystem(this.scene, this.assets, window.matchMedia?.('(max-width: 767px)').matches ? 24 : 48);
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

  private resize(canvas: HTMLCanvasElement): void {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const isMobile = window.matchMedia?.('(max-width: 767px)').matches ?? false;
    const { width, height } = getPixelRenderSize(bounds.width, bounds.height, isMobile);
    if (canvas.width !== width || canvas.height !== height) this.renderer.setSize(width, height, false);
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
    cameraBob: number;
    deltaSeconds: number;
    elapsedSeconds: number;
    events: VisualEvent[];
  }): void {
    const { world, player, enemies, projectiles, loot, action, isMoving, guarding, cameraBob, deltaSeconds, elapsedSeconds, events } = args;
    this.elapsedSeconds = elapsedSeconds;
    if (world.worldRevision !== this.worldRevision) {
      this.clearEnemyVisuals();
      this.clearEnemyTelegraphs();
      this.scene.remove(this.geometry.group);
      this.geometry.dispose();
      this.geometry = new WorldGeometry(world, this.assets);
      this.scene.add(this.geometry.group);
      this.worldRevision = world.worldRevision;
    }
    this.camera.position.set(player.position.x, 1.52 + cameraBob, player.position.z);
    this.camera.rotation.set(player.rotation.pitch, -player.rotation.yaw - Math.PI / 2, 0, 'YXZ');
    this.weapon.update(player, action, isMoving, guarding, elapsedSeconds);
    this.syncEnemies(enemies, world, deltaSeconds);
    this.syncProjectiles(projectiles);
    this.syncLoot(loot, world);
    for (const event of events) {
      if (event.kind === 'audio' || event.kind === 'telegraph') continue;
      const tint = event.color ?? (event.kind === 'enemyDeath' ? '#ffbd68' : '#fff0ad');
      const count = event.kind === 'area' || event.kind === 'bossPhase' ? 16 : event.kind === 'enemyDeath' ? 12 : 6;
      const effect: PixelEffectId = event.effectId ?? (event.kind === 'enemyDeath' ? 'soul_ash' : event.kind === 'pickup' ? 'laurel_light' : event.kind === 'area' ? 'promethean_flame' : event.kind === 'dodge' ? 'cistern_splash' : 'bronze_impact');
      this.vfx.burst(event.position, tint, count, event.scale ?? 1, effect, event.direction);
    }
    this.vfx.update(deltaSeconds);
    this.renderer.render(this.scene, this.camera);
  }

  private syncEnemies(enemies: WorldEnemy[], world: DungeonWorldState, deltaSeconds: number): void {
    const ids = new Set(enemies.map(enemy => enemy.id));
    for (const [id, visual] of this.enemyVisuals) {
      if (!ids.has(id)) { this.disposeEnemyVisual(visual); this.enemyVisuals.delete(id); }
    }
    for (const [id, warning] of this.enemyTelegraphs) {
      if (!ids.has(id)) { this.scene.remove(warning.mesh); warning.mesh.geometry.dispose(); warning.mesh.material.dispose(); this.enemyTelegraphs.delete(id); }
    }
    const atlas = this.assets.characterRigAtlas();
    for (const enemy of enemies) {
      const definition = getCharacterRigDefinition(enemy.visualId);
      const shouldUseRig = Boolean(definition && atlas);
      let visual = this.enemyVisuals.get(enemy.id);
      if (visual && ((visual.kind === 'rig') !== shouldUseRig)) {
        this.disposeEnemyVisual(visual);
        this.enemyVisuals.delete(enemy.id);
        visual = undefined;
      }
      if (!visual) {
        if (shouldUseRig && definition && atlas) {
          const animator = new CharacterRigAnimator(enemy, definition, atlas, CHARACTER_RIG_MANIFEST.atlasWidth, CHARACTER_RIG_MANIFEST.atlasHeight, CHARACTER_RIG_MANIFEST.cellSize);
          visual = { kind: 'rig', animator };
          this.scene.add(animator.group);
        } else {
          const sprite = createEnemySprite(enemy, world.biome, this.assets);
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
        if (warning) warning.visible = false;
        continue;
      }
      if (warning && warningEntry?.attackId !== attack.id) {
        this.scene.remove(warning);
        warning.geometry.dispose();
        warning.material.dispose();
        this.enemyTelegraphs.delete(enemy.id);
        warning = undefined;
      }
      if (!warning) {
        const radius = attack.shape === 'SIGIL' ? attack.radius ?? 1.6 : attack.shape === 'BUFF' ? 1.25 : attack.radius ?? attack.range;
        const arc = attack.shape === 'CONE' || attack.shape === 'CHARGE' ? attack.arcRadians ?? 1.15 : attack.shape === 'PROJECTILE' || attack.shape === 'DRAIN' ? 0.11 : Math.PI * 2;
        const geometry = new THREE.CircleGeometry(1, 28, -arc / 2, arc);
        const material = new THREE.MeshBasicMaterial({ color: attack.telegraphColor, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 });
        warning = new THREE.Mesh(geometry, material);
        warning.rotation.x = -Math.PI / 2;
        warning.renderOrder = 2;
        warning.name = 'AttackTelegraph_' + enemy.id;
        warningEntry = { mesh: warning, attackId: attack.id };
        this.enemyTelegraphs.set(enemy.id, warningEntry);
        this.scene.add(warning);
        warning.scale.setScalar(radius);
      }
      warning.visible = true;
      const warningPosition = attack.shape === 'SIGIL' ? enemy.telegraphPosition ?? enemy.position : enemy.position;
      warning.position.set(warningPosition.x, 0.028, warningPosition.z);
      warning.rotation.set(-Math.PI / 2, -(enemy.facingYaw ?? 0), 0);
      warning.material.opacity = 0.15 + Math.sin(this.elapsedSeconds * 10) * 0.035;
    }
  }

  private syncProjectiles(projectiles: WorldProjectile[]): void {
    const active = new Set(projectiles.map(projectile => projectile.id));
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
      this.vfx.trail(projectile.position, projectile.color);
    }
  }

  private syncLoot(loot: WorldLootDrop[], world: DungeonWorldState): void {
    const ids = new Set(loot.map(drop => drop.id));
    for (const [id, sprite] of this.lootSprites) {
      if (!ids.has(id)) { this.scene.remove(sprite); sprite.material.dispose(); this.lootSprites.delete(id); }
    }
    for (const drop of loot) {
      let sprite = this.lootSprites.get(drop.id);
      if (!sprite) {
        const material = new THREE.SpriteMaterial({ map: this.assets.texture('loot', world.biome), transparent: true, alphaTest: 0.06, depthTest: true, depthWrite: false });
        sprite = new THREE.Sprite(material);
        sprite.center.set(0.5, 0);
        sprite.scale.set(0.42, 0.42, 1);
        sprite.name = 'Loot_' + drop.id;
        this.lootSprites.set(drop.id, sprite);
        this.scene.add(sprite);
      }
      sprite.position.set(drop.position.x, 0.12 + Math.sin(this.elapsedSeconds * 3 + drop.position.x) * 0.04, drop.position.z);
    }
  }

  private disposeEnemyVisual(visual: EnemyVisualInstance): void {
    if (visual.kind === 'rig') {
      visual.animator.dispose();
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
    for (const warning of this.enemyTelegraphs.values()) {
      this.scene.remove(warning.mesh);
      warning.mesh.geometry.dispose();
      warning.mesh.material.dispose();
    }
    this.enemyTelegraphs.clear();
  }

  dispose(): void {
    this.resizeObserver?.disconnect();
    this.onDisposeResize();
    this.weapon.dispose();
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
