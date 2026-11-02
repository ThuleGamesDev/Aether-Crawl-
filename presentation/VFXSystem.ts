import * as THREE from 'three';
import type { AssetManager } from './AssetManager';
import {
  chooseVfxSlot,
  getVfxModeCount,
  isValidVfxLayerTiming,
  VFX_DEFINITIONS,
  type PixelEffectId,
  type VFXInstance,
  type VFXLayerDefinition,
  type VFXMode,
  type VFXPriority,
} from './vfxDefinitions';

export type { PixelEffectId, VFXInstance, VFXMode, VFXPriority } from './vfxDefinitions';

interface ParticleSlot {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  velocity: THREE.Vector3;
  instance: VFXInstance | null;
  age: number;
  seed: number;
}

export interface VFXEmitOptions {
  color?: string;
  scale?: number;
  direction?: { x: number; z: number };
  priority?: VFXPriority;
  sourceId?: string;
  ownerId?: string;
}

export class VFXSystem {
  private readonly slots: ParticleSlot[] = [];
  private readonly geometry = new THREE.PlaneGeometry(1, 1);
  private readonly trailTimes = new Map<number, number>();
  private mode: VFXMode = 'full';
  private elapsedSeconds = 0;
  private spawnSerial = 0;

  constructor(private readonly scene: THREE.Scene, private readonly assets: AssetManager, capacity = 48) {
    for (let index = 0; index < Math.max(1, Math.floor(capacity)); index += 1) {
      const material = new THREE.MeshBasicMaterial({
        map: assets.vfxTexture('generic_impact'),
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        alphaTest: 0.025,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      });
      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 4;
      mesh.name = 'PooledWorldVFX_' + index;
      this.scene.add(mesh);
      this.slots.push({ mesh, velocity: new THREE.Vector3(), instance: null, age: 0, seed: index });
    }
  }

  setMode(mode: VFXMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    if (mode === 'off') this.clear();
  }

  emit(effectId: PixelEffectId, position: { x: number; y: number; z: number }, options: VFXEmitOptions = {}): void {
    if (this.mode === 'off') return;
    const definition = VFX_DEFINITIONS[effectId];
    const priority = options.priority ?? definition.priority;
    let remainingBudget = definition.maxCount;
    for (const layer of definition.layers) {
      if (remainingBudget <= 0) break;
      const modeCount = getVfxModeCount(this.mode, layer.count, priority);
      const count = Math.min(remainingBudget, modeCount);
      for (let index = 0; index < count; index += 1) {
        this.spawnLayer(effectId, layer, position, options, priority, index, count);
      }
      remainingBudget -= count;
    }
  }

  /** Compatibility entry point for callers that specify a single particle count. */
  burst(
    position: { x: number; y: number; z: number },
    color: string,
    count = 8,
    scale = 1,
    effectId: PixelEffectId = 'bronze_impact',
    direction?: { x: number; z: number },
  ): void {
    const definition = VFX_DEFINITIONS[effectId];
    const requestedCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    const limitedCount = Math.min(getVfxModeCount(this.mode, requestedCount, definition.priority), definition.maxCount);
    const baseLayer = definition.layers[0];
    if (limitedCount === 0 || !baseLayer || this.mode === 'off') return;
    for (let index = 0; index < limitedCount; index += 1) {
      this.spawnLayer(effectId, { ...baseLayer, count: limitedCount }, position, { color, scale, direction }, definition.priority, index, limitedCount);
    }
  }

  trail(
    projectileId: number,
    position: { x: number; y: number; z: number },
    color: string,
    effectId: PixelEffectId = 'oracle_spark',
    sourceId?: string,
  ): void {
    if (this.mode === 'off') return;
    const priority: VFXPriority = 'ordinary_hit';
    if (getVfxModeCount(this.mode, 1, priority) === 0) return;
    const lastTime = this.trailTimes.get(projectileId);
    const interval = this.mode === 'reduced' ? 0.11 : 0.055;
    if (lastTime !== undefined && this.elapsedSeconds - lastTime < interval) return;
    this.trailTimes.set(projectileId, this.elapsedSeconds);
    const firstLayer = VFX_DEFINITIONS[effectId].layers[0];
    if (!firstLayer) return;
    const scale = Math.min(1, 0.28 / firstLayer.size);
    this.spawnLayer(effectId, { ...firstLayer, count: 1 }, position, { color, scale, sourceId }, priority, 0, 1);
  }

  /** Keeps per-projectile trail clocks bounded to projectiles still present in the simulation. */
  retainProjectileTrails(activeProjectileIds: ReadonlySet<number>): void {
    for (const projectileId of this.trailTimes.keys()) {
      if (!activeProjectileIds.has(projectileId)) this.trailTimes.delete(projectileId);
    }
  }

  update(deltaSeconds: number, cameraYaw: number, paused = false): void {
    if (paused) return;
    const dt = Number.isFinite(deltaSeconds) ? Math.max(0, Math.min(0.05, deltaSeconds)) : 0;
    this.elapsedSeconds += dt;
    for (const slot of this.slots) {
      const instance = slot.instance;
      if (!instance) continue;
      slot.age += dt;
      instance.remainingSeconds -= dt;
      if (instance.remainingSeconds <= 0) {
        slot.mesh.visible = false;
        slot.instance = null;
        slot.velocity.set(0, 0, 0);
        continue;
      }
      if (dt > 0) {
        if (instance.gravity > 0) slot.velocity.y -= instance.gravity * dt;
        slot.mesh.position.addScaledVector(slot.velocity, dt);
      }
      const progress = Math.max(0, Math.min(1, 1 - instance.remainingSeconds / instance.lifetimeSeconds));
      const reducedOpacity = this.mode === 'reduced' ? 0.58 : 1;
      slot.mesh.material.opacity = opacityAt(instance.opacityCurve, progress) * reducedOpacity;
      const scale = instance.size * scaleAt(instance.scaleCurve, progress);
      slot.mesh.scale.set(scale, scale, 1);
      slot.mesh.renderOrder = instance.layer;
      if (instance.orientation === 'ground') slot.mesh.rotation.set(-Math.PI / 2, 0, 0);
      else if (instance.orientation === 'direction') slot.mesh.rotation.set(0, Math.atan2(instance.direction.x, instance.direction.z), 0);
      else slot.mesh.rotation.set(0, cameraYaw, 0);

      const texture = this.assets.vfxTexture(instance.frame as PixelEffectId);
      if (slot.mesh.material.map !== texture) {
        slot.mesh.material.map = texture;
        slot.mesh.material.needsUpdate = true;
      }
    }
  }

  clear(): void {
    for (const slot of this.slots) {
      slot.mesh.visible = false;
      slot.instance = null;
      slot.velocity.set(0, 0, 0);
    }
    this.trailTimes.clear();
  }

  dispose(): void {
    this.clear();
    for (const slot of this.slots) {
      this.scene.remove(slot.mesh);
      slot.mesh.material.dispose();
    }
    this.slots.length = 0;
    this.geometry.dispose();
  }

  private spawnLayer(
    effectId: PixelEffectId,
    layer: VFXLayerDefinition,
    position: { x: number; y: number; z: number },
    options: VFXEmitOptions,
    priority: VFXPriority,
    index: number,
    count: number,
  ): void {
    if (!isValidVfxLayerTiming(layer.lifetimeSeconds, layer.size)) return;
    const slotIndex = chooseVfxSlot(this.slots.map(slot => ({
      active: slot.instance !== null,
      priority: slot.instance?.priority ?? 'ambience',
      age: slot.age,
    })), priority);
    if (slotIndex < 0) return;
    const slot = this.slots[slotIndex];
    const normalizedDirection = normalizeDirection(options.direction);
    const seed = this.spawnSerial++;
    const velocity = velocityFor(layer, normalizedDirection, index, count, seed);
    const sizeMultiplier = Number.isFinite(options.scale) ? Math.max(0.05, Math.min(3, options.scale ?? 1)) : 1;
    const y = layer.orientation === 'ground' ? 0.032 : position.y;
    slot.mesh.position.set(position.x, y, position.z);
    slot.mesh.scale.set(layer.size * sizeMultiplier, layer.size * sizeMultiplier, 1);
    const tint = options.color ?? layer.palette[Math.abs(seed) % layer.palette.length] ?? '#ffffff';
    slot.mesh.material.color.set(tint);
    slot.mesh.material.opacity = 1;
    const texture = this.assets.vfxTexture(layer.frame as PixelEffectId);
    if (slot.mesh.material.map !== texture) {
      slot.mesh.material.map = texture;
      slot.mesh.material.needsUpdate = true;
    }
    slot.mesh.renderOrder = layer.layer;
    slot.mesh.visible = true;
    if (layer.orientation === 'ground') slot.mesh.rotation.set(-Math.PI / 2, 0, 0);
    else if (layer.orientation === 'direction') slot.mesh.rotation.set(0, Math.atan2(normalizedDirection.x, normalizedDirection.z), 0);
    else slot.mesh.rotation.set(0, 0, 0);
    slot.velocity.set(velocity.x, velocity.y, velocity.z);
    slot.age = 0;
    slot.seed = seed;
    slot.instance = {
      effectId,
      frame: layer.frame,
      kind: layer.kind,
      space: 'world',
      sourceId: options.sourceId,
      ownerId: options.ownerId,
      priority,
      position: { x: position.x, y, z: position.z },
      direction: normalizedDirection,
      velocity,
      lifetimeSeconds: layer.lifetimeSeconds,
      remainingSeconds: layer.lifetimeSeconds,
      size: layer.size * sizeMultiplier,
      tint,
      opacityCurve: layer.opacityCurve,
      scaleCurve: layer.scaleCurve,
      orientation: layer.orientation,
      layer: layer.layer,
      gravity: layer.gravity ?? 0,
    };
  }
}

function normalizeDirection(direction?: { x: number; z: number }): { x: number; z: number } {
  const x = direction?.x ?? 0;
  const z = direction?.z ?? 1;
  const length = Math.hypot(x, z);
  return length > 0.0001 && Number.isFinite(length) ? { x: x / length, z: z / length } : { x: 0, z: 1 };
}

function velocityFor(
  layer: VFXLayerDefinition,
  direction: { x: number; z: number },
  index: number,
  count: number,
  seed: number,
): { x: number; y: number; z: number } {
  const speed = layer.velocityScale ?? 1;
  const angle = seed * 2.399963229728653 + index * Math.PI * (3 - Math.sqrt(5));
  if (layer.motion === 'radial') return { x: Math.cos(angle) * speed, y: 0.16 + (index % 3) * 0.07, z: Math.sin(angle) * speed };
  if (layer.motion === 'directional') {
    const side = (index - (count - 1) / 2) * 0.16;
    return { x: direction.x * speed - direction.z * side, y: 0.08, z: direction.z * speed + direction.x * side };
  }
  if (layer.motion === 'upward') return { x: Math.cos(angle) * speed * 0.3, y: 0.22 + (index % 3) * 0.06, z: Math.sin(angle) * speed * 0.3 };
  return { x: 0, y: 0, z: 0 };
}

function opacityAt(curve: VFXInstance['opacityCurve'], progress: number): number {
  if (curve === 'flash') return Math.max(0, 1 - progress * 1.7);
  if (curve === 'hold') return progress < 0.7 ? 1 : Math.max(0, 1 - (progress - 0.7) / 0.3);
  return Math.max(0, 1 - progress);
}

function scaleAt(curve: VFXInstance['scaleCurve'], progress: number): number {
  if (curve === 'expand') return 0.35 + progress * 0.9;
  if (curve === 'contract') return 1 - progress * 0.55;
  return 1;
}
