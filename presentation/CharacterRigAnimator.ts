import * as THREE from 'three';
import type { WorldEnemy } from '../types';
import type { CharacterPoseKeyframe, CharacterPoseTransform, CharacterRigDefinition, CharacterRigLayerDefinition } from '../data/characterRigs';
import { selectEnemyCharacterAnimation } from '../data/enemyCharacterAnimation';

const ZERO_TRANSFORM: CharacterPoseTransform = Object.freeze({ rotation: 0, x: 0, y: 0 });
const MOVEMENT_STRIDE_METERS: Record<CharacterRigDefinition['family'], number> = {
  quadruped: 0.42,
  arachnid: 0.76,
  humanoid: 0.62,
  heavyHumanoid: 0.78,
  caster: 0.64,
};
const STATUS_TINTS: Record<string, number> = {
  POISON: 0xb6cd7c,
  BURN: 0xf29b65,
  SLOW: 0x94c4ce,
  GUARD: 0xe1c579,
  WEAKNESS: 0xc98995,
};

interface AnimatedLayer {
  definition: CharacterRigLayerDefinition;
  node: THREE.Group;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  baseX: number;
  baseY: number;
  currentCellKey: string;
}

export type CharacterView = 'front' | 'threeQuarter' | 'back';

export interface CharacterViewSelection {
  view: CharacterView;
  flipX: boolean;
}

function stablePhaseOffset(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  return ((hash >>> 0) % 1000) / 1000;
}

function makeCellGeometry(layer: CharacterRigLayerDefinition, atlasWidth: number, atlasHeight: number, cellSize: number, pixelScale: number): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(cellSize * pixelScale, cellSize * pixelScale);
  writeCellUv(geometry, layer.cell, layer.flipX, atlasWidth, atlasHeight, cellSize);
  const cellCenter = cellSize / 2;
  geometry.translate((cellCenter - layer.pivot[0]) * pixelScale, (layer.pivot[1] - cellCenter) * pixelScale, 0);
  return geometry;
}

function writeCellUv(geometry: THREE.PlaneGeometry, cell: [number, number], flipX: boolean, atlasWidth: number, atlasHeight: number, cellSize: number): void {
  const [cellX, cellY] = cell;
  const halfTexel = 0.5;
  const u0 = (cellX + halfTexel) / atlasWidth;
  const u1 = (cellX + cellSize - halfTexel) / atlasWidth;
  const vBottom = 1 - (cellY + cellSize - halfTexel) / atlasHeight;
  const vTop = 1 - (cellY + halfTexel) / atlasHeight;
  const left = flipX ? u1 : u0;
  const right = flipX ? u0 : u1;
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
  uv.setXY(0, left, vBottom);
  uv.setXY(1, right, vBottom);
  uv.setXY(2, left, vTop);
  uv.setXY(3, right, vTop);
  uv.needsUpdate = true;
}

function getBillboardYaw(enemy: WorldEnemy, cameraPosition: THREE.Vector3): number {
  return Math.atan2(cameraPosition.x - enemy.position.x, cameraPosition.z - enemy.position.z);
}

export function shouldFlipCharacterForViewer(enemy: WorldEnemy, cameraPosition: THREE.Vector3): boolean {
  if (enemy.facingYaw === undefined) return false;
  const towardViewer = Math.atan2(cameraPosition.z - enemy.position.z, cameraPosition.x - enemy.position.x);
  return Math.cos(enemy.facingYaw - towardViewer) < -0.12;
}

/** Selects an authored humanoid atlas view from the existing facing yaw and viewer position. */
export function getCharacterViewForViewer(enemy: WorldEnemy, cameraPosition: THREE.Vector3): CharacterViewSelection {
  if (enemy.facingYaw === undefined) return { view: 'threeQuarter', flipX: false };
  const towardViewer = Math.atan2(cameraPosition.z - enemy.position.z, cameraPosition.x - enemy.position.x);
  const relativeYaw = enemy.facingYaw - towardViewer;
  const facingDot = Math.cos(relativeYaw);
  if (facingDot >= 0.72) return { view: 'front', flipX: false };
  if (facingDot <= -0.72) return { view: 'back', flipX: false };
  return { view: 'threeQuarter', flipX: Math.sin(relativeYaw) < 0 };
}

/** One renderer-owned visual instance; its transforms read existing combat state only. */
export class CharacterRigAnimator {
  readonly group = new THREE.Group();
  readonly material: THREE.MeshBasicMaterial;
  private readonly layers: AnimatedLayer[] = [];
  private readonly layerNodes = new Map<string, THREE.Group>();
  private readonly pixelScale: number;
  private readonly idleOffset: number;
  private readonly atlasWidth: number;
  private readonly atlasHeight: number;
  private readonly cellSize: number;
  private previousX: number;
  private previousZ: number;
  private gaitCycles = 0;
  private tint = -1;
  private disposed = false;

  constructor(enemy: WorldEnemy, readonly definition: CharacterRigDefinition, atlas: THREE.Texture, atlasWidth: number, atlasHeight: number, cellSize: number) {
    this.pixelScale = definition.worldHeight / definition.designHeight;
    this.idleOffset = stablePhaseOffset(enemy.id);
    this.atlasWidth = atlasWidth;
    this.atlasHeight = atlasHeight;
    this.cellSize = cellSize;
    this.previousX = enemy.position.x;
    this.previousZ = enemy.position.z;
    this.group.name = 'WorldEnemyRig_' + enemy.id;
    this.group.position.set(enemy.position.x, enemy.position.y, enemy.position.z);
    this.group.frustumCulled = false;
    this.material = new THREE.MeshBasicMaterial({
      map: atlas,
      transparent: true,
      alphaTest: 0.08,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.material.color.setHex(0xffffff);

    const parentOrder = this.resolveLayerOrder(definition.layers);
    for (const layer of parentOrder) {
      const node = new THREE.Group();
      node.name = `${enemy.id}:${layer.id}`;
      const parent = layer.parent === 'root' ? this.group : this.layerNodes.get(layer.parent)!;
      const baseX = (layer.parent === 'root' ? layer.attach[0] - definition.origin[0] : layer.attach[0]) * this.pixelScale;
      const baseY = (layer.parent === 'root' ? definition.origin[1] - layer.attach[1] : -layer.attach[1]) * this.pixelScale;
      node.position.set(baseX, baseY, layer.order * 0.00005);
      parent.add(node);
      this.layerNodes.set(layer.id, node);

      const geometry = makeCellGeometry(layer, atlasWidth, atlasHeight, cellSize, this.pixelScale);
      const mesh = new THREE.Mesh(geometry, this.material);
      mesh.name = `${enemy.id}:${layer.id}:pixels`;
      mesh.renderOrder = 10 + layer.order;
      mesh.frustumCulled = false;
      node.add(mesh);
      this.layers.push({ definition: layer, node, mesh, baseX, baseY, currentCellKey: layer.cell.join(',') });
    }
  }

  get layerCount(): number { return this.layers.length; }

  update(enemy: WorldEnemy, cameraPosition: THREE.Vector3, elapsedSeconds: number, deltaSeconds: number): void {
    if (this.disposed) return;
    const dx = enemy.position.x - this.previousX;
    const dz = enemy.position.z - this.previousZ;
    const moved = Math.hypot(dx, dz);
    const dt = Math.max(0.001, Math.min(0.1, deltaSeconds));
    this.previousX = enemy.position.x;
    this.previousZ = enemy.position.z;
    this.gaitCycles += moved / MOVEMENT_STRIDE_METERS[this.definition.family];

    this.group.position.set(enemy.position.x, enemy.position.y, enemy.position.z);
    this.group.rotation.y = getBillboardYaw(enemy, cameraPosition);
    const hasDirectionalViews = this.definition.layers.some(layer => Boolean(layer.viewCells));
    const viewSelection = hasDirectionalViews
      ? getCharacterViewForViewer(enemy, cameraPosition)
      : { view: 'threeQuarter' as const, flipX: shouldFlipCharacterForViewer(enemy, cameraPosition) };
    this.group.scale.x = viewSelection.flipX ? -1 : 1;
    for (const layer of this.layers) {
      const cell = layer.definition.viewCells?.[viewSelection.view] ?? layer.definition.cell;
      const key = cell.join(',');
      if (key === layer.currentCellKey) continue;
      writeCellUv(layer.mesh.geometry, cell, layer.definition.flipX, this.atlasWidth, this.atlasHeight, this.cellSize);
      layer.currentCellKey = key;
    }

    const selection = selectEnemyCharacterAnimation(enemy);
    let clipName = selection.clipName;
    let progress = selection.progress;
    if (selection.mode === 'RUN') {
      if (moved / dt < 0.035) {
        clipName = 'idle';
        progress = (elapsedSeconds / 5.2 + this.idleOffset) % 1;
      } else {
        progress = this.gaitCycles % 1;
      }
    } else if (selection.mode === 'IDLE') {
      progress = (elapsedSeconds / 5.2 + this.idleOffset) % 1;
    }
    const clip = this.definition.clips[clipName] ?? this.definition.clips.idle;
    this.applyClip(clip, progress);
    this.setTint(enemy, selection.mode);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.parent?.remove(this.group);
    for (const layer of this.layers) layer.mesh.geometry.dispose();
    this.material.dispose();
    this.layers.length = 0;
    this.layerNodes.clear();
  }

  private resolveLayerOrder(definitions: CharacterRigLayerDefinition[]): CharacterRigLayerDefinition[] {
    const pending = [...definitions];
    const ordered: CharacterRigLayerDefinition[] = [];
    const ready = new Set(['root']);
    while (pending.length) {
      const index = pending.findIndex(layer => ready.has(layer.parent));
      if (index < 0) throw new Error(`Character rig ${this.definition.visualId} contains a cyclic or missing parent.`);
      const [layer] = pending.splice(index, 1);
      ordered.push(layer);
      ready.add(layer.id);
    }
    return ordered;
  }

  private applyClip(clip: CharacterPoseKeyframe[], progress: number): void {
    const t = Math.max(0, Math.min(1, progress));
    let rightIndex = clip.findIndex(frame => frame.t >= t);
    if (rightIndex < 1) rightIndex = 1;
    const left = clip[rightIndex - 1];
    const right = clip[rightIndex];
    const blend = Math.max(0, Math.min(1, (t - left.t) / Math.max(0.0001, right.t - left.t)));
    for (const layer of this.layers) {
      const a = left.layers[layer.definition.id] ?? ZERO_TRANSFORM;
      const b = right.layers[layer.definition.id] ?? ZERO_TRANSFORM;
      const rotation = (a.rotation ?? 0) + ((b.rotation ?? 0) - (a.rotation ?? 0)) * blend;
      const x = (a.x ?? 0) + ((b.x ?? 0) - (a.x ?? 0)) * blend;
      const y = (a.y ?? 0) + ((b.y ?? 0) - (a.y ?? 0)) * blend;
      layer.node.position.x = layer.baseX + x * this.pixelScale;
      layer.node.position.y = layer.baseY + y * this.pixelScale;
      layer.node.rotation.z = rotation;
    }
  }

  private setTint(enemy: WorldEnemy, mode: string): void {
    let next = mode === 'HURT' ? 0xffe4d1 : mode === 'STAGGER' ? 0xe6e1cf : mode === 'DEAD' ? 0x8d7e78 : mode === 'IMPACT' ? 0xffd8a0 : 0xffffff;
    if (mode !== 'HURT' && mode !== 'STAGGER' && mode !== 'DEAD') {
      const status = enemy.statusEffects?.find(effect => effect.durationSeconds > 0 && STATUS_TINTS[effect.statusId]);
      if (status) next = STATUS_TINTS[status.statusId];
    }
    if (next === this.tint) return;
    this.tint = next;
    this.material.color.setHex(next);
  }
}
