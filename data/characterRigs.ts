import generatedManifest from './generated/characterRigs.json';

export type CharacterRigFamily = 'quadruped' | 'arachnid' | 'humanoid' | 'heavyHumanoid' | 'caster';

export interface CharacterPoseTransform {
  rotation?: number;
  x?: number;
  y?: number;
}

export interface CharacterPoseKeyframe {
  t: number;
  layers: Record<string, CharacterPoseTransform>;
}

export interface CharacterAnimationClipDefinition {
  frames: CharacterPoseKeyframe[];
}

export interface CharacterRigLayerDefinition {
  id: string;
  art: string;
  parent: string;
  attach: [number, number];
  pivot: [number, number];
  order: number;
  flipX: boolean;
  cell: [number, number];
  viewCells?: {
    front: [number, number];
    threeQuarter: [number, number];
    back: [number, number];
  };
}

export interface CharacterRigDefinition {
  visualId: string;
  name: string;
  family: CharacterRigFamily;
  worldHeight: number;
  designHeight: number;
  origin: [number, number];
  attackStyles: Record<string, 'melee' | 'cast' | 'guard' | 'lunge' | 'leap'>;
  fallbackSprite: string;
  layers: CharacterRigLayerDefinition[];
  clips: Record<string, CharacterPoseKeyframe[]>;
}

export interface CharacterRigManifest {
  schemaVersion: number;
  atlasPath: string;
  atlasWidth: number;
  atlasHeight: number;
  cellSize: number;
  contactSheetPath: string;
  rigs: Record<string, CharacterRigDefinition>;
}

export const CHARACTER_RIG_MANIFEST = generatedManifest as unknown as CharacterRigManifest;
export const CHARACTER_RIG_VISUAL_IDS = Object.keys(CHARACTER_RIG_MANIFEST.rigs);

export function getCharacterRigDefinition(visualId: string): CharacterRigDefinition | undefined {
  return CHARACTER_RIG_MANIFEST.rigs[visualId];
}

export function validateCharacterRigManifest(manifest: CharacterRigManifest = CHARACTER_RIG_MANIFEST): string[] {
  const issues: string[] = [];
  if (manifest.schemaVersion !== 2) issues.push('Unsupported character rig schema version.');
  if (!manifest.atlasPath.startsWith('/assets/')) issues.push('Atlas path must point to a local public asset.');
  if (manifest.atlasWidth <= 0 || manifest.atlasHeight <= 0 || manifest.cellSize <= 0) issues.push('Atlas dimensions must be positive.');
  if (!Object.keys(manifest.rigs).length) issues.push('Character rig manifest is empty.');

  for (const [visualId, rig] of Object.entries(manifest.rigs)) {
    const prefix = `${visualId}: `;
    if (rig.visualId !== visualId) issues.push(prefix + 'stable visualId does not match the manifest key.');
    if (!['quadruped', 'arachnid', 'humanoid', 'heavyHumanoid', 'caster'].includes(rig.family)) issues.push(prefix + 'unknown anatomical family.');
    if (!(rig.worldHeight > 0) || !(rig.designHeight > 0)) issues.push(prefix + 'world and source heights must be positive.');
    if (!rig.fallbackSprite.startsWith('/assets/maze/enemies/')) issues.push(prefix + 'local fallback sprite is missing.');
    if (rig.origin.some(value => !Number.isFinite(value) || value < 0 || value > rig.designHeight)) issues.push(prefix + 'rig origin is outside the source canvas.');

    const byId = new Map<string, CharacterRigLayerDefinition>();
    for (const layer of rig.layers) {
      if (byId.has(layer.id)) issues.push(prefix + `duplicate layer ${layer.id}.`);
      byId.set(layer.id, layer);
      const [x, y] = layer.cell;
      if (x < 0 || y < 0 || x + manifest.cellSize > manifest.atlasWidth || y + manifest.cellSize > manifest.atlasHeight) issues.push(prefix + `atlas bounds exceeded by ${layer.id}.`);
      if (['humanoid', 'heavyHumanoid', 'caster'].includes(rig.family)) {
        if (!layer.viewCells || !layer.viewCells.front || !layer.viewCells.threeQuarter || !layer.viewCells.back) {
          issues.push(prefix + `${layer.id} is missing a front, three-quarter, or back view cell.`);
        } else {
          for (const [view, [viewX, viewY]] of Object.entries(layer.viewCells)) {
            if (viewX < 0 || viewY < 0 || viewX + manifest.cellSize > manifest.atlasWidth || viewY + manifest.cellSize > manifest.atlasHeight) issues.push(prefix + `${view} atlas bounds exceeded by ${layer.id}.`);
          }
          if (layer.viewCells.threeQuarter[0] !== x || layer.viewCells.threeQuarter[1] !== y) issues.push(prefix + `${layer.id} default cell must match its three-quarter view.`);
        }
      }
      if (layer.pivot.some(value => !Number.isFinite(value) || value < 0 || value >= manifest.cellSize)) issues.push(prefix + `source pivot is outside ${layer.id}.`);
      if (layer.attach.some(value => !Number.isFinite(value))) issues.push(prefix + `non-finite attachment on ${layer.id}.`);
      if (!Number.isFinite(layer.order)) issues.push(prefix + `non-finite draw order on ${layer.id}.`);
    }

    for (const layer of rig.layers) {
      if (layer.parent !== 'root' && !byId.has(layer.parent)) issues.push(prefix + `${layer.id} has an unknown parent.`);
      const visited = new Set<string>([layer.id]);
      let parent = layer.parent;
      while (parent !== 'root' && byId.has(parent)) {
        if (visited.has(parent)) {
          issues.push(prefix + `${layer.id} participates in a parent cycle.`);
          break;
        }
        visited.add(parent);
        parent = byId.get(parent)!.parent;
      }
    }

    const requiredClips = ['idle', 'run', 'alert', 'hurt', 'stagger', 'death'];
    const profiles = new Set(['melee', 'cast', 'guard', ...Object.values(rig.attackStyles)]);
    for (const profile of profiles) {
      requiredClips.push(`${profile}_windup`, `${profile}_impact`, `${profile}_recovery`);
    }
    for (const clipName of requiredClips) if (!rig.clips[clipName]) issues.push(prefix + `missing ${clipName} animation clip.`);
    for (const [clipName, frames] of Object.entries(rig.clips)) {
      if (frames.length < 2 || frames[0].t !== 0 || frames[frames.length - 1].t !== 1) issues.push(prefix + `${clipName} must begin at 0 and end at 1.`);
      let previous = -1;
      for (const frame of frames) {
        if (!Number.isFinite(frame.t) || frame.t <= previous || frame.t < 0 || frame.t > 1) issues.push(prefix + `${clipName} has unordered or out-of-range timing.`);
        previous = frame.t;
        for (const [layerId, transform] of Object.entries(frame.layers)) {
          if (!byId.has(layerId)) issues.push(prefix + `${clipName} references unknown layer ${layerId}.`);
          if (Object.values(transform).some(value => value !== undefined && !Number.isFinite(value))) issues.push(prefix + `${clipName} has a non-finite transform.`);
        }
      }
    }
    for (const attackId of Object.keys(rig.attackStyles)) {
      if (!attackId.trim()) issues.push(prefix + 'attack profile has an empty stable attack ID.');
    }
  }
  return issues;
}

export function sampleCharacterPose(clip: CharacterPoseKeyframe[], progress: number): Record<string, CharacterPoseTransform> {
  const t = Math.max(0, Math.min(1, progress));
  let rightIndex = clip.findIndex(frame => frame.t >= t);
  if (rightIndex < 1) rightIndex = 1;
  const left = clip[rightIndex - 1];
  const right = clip[rightIndex];
  const blend = Math.max(0, Math.min(1, (t - left.t) / Math.max(0.0001, right.t - left.t)));
  const layerIds = new Set([...Object.keys(left.layers), ...Object.keys(right.layers)]);
  const pose: Record<string, CharacterPoseTransform> = {};
  for (const layerId of layerIds) {
    const a = left.layers[layerId] ?? {};
    const b = right.layers[layerId] ?? {};
    pose[layerId] = {
      rotation: (a.rotation ?? 0) + ((b.rotation ?? 0) - (a.rotation ?? 0)) * blend,
      x: (a.x ?? 0) + ((b.x ?? 0) - (a.x ?? 0)) * blend,
      y: (a.y ?? 0) + ((b.y ?? 0) - (a.y ?? 0)) * blend,
    };
  }
  return pose;
}
