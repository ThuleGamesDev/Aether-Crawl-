import { TileType } from '../types';

export type VFXKind = 'TRAIL' | 'IMPACT' | 'ARC' | 'BURST' | 'RING' | 'GROUND_DECAL' | 'PROJECTILE' | 'CAST' | 'LINGERING_AREA';
export type VFXPriority = 'ambience' | 'ordinary_hit' | 'critical_hit' | 'guardian_telegraph';
export type VFXMode = 'full' | 'reduced' | 'off';
export type VFXMotion = 'radial' | 'directional' | 'upward' | 'expand' | 'stationary';
export type VFXOrientation = 'billboard' | 'direction' | 'ground';
export type VFXCurve = 'fade' | 'flash' | 'hold' | 'expand' | 'contract';

export interface VFXLayerDefinition {
  frame: string;
  kind: VFXKind;
  count: number;
  lifetimeSeconds: number;
  size: number;
  palette: readonly string[];
  motion: VFXMotion;
  orientation: VFXOrientation;
  opacityCurve: VFXCurve;
  scaleCurve: VFXCurve;
  layer: number;
  gravity?: number;
  velocityScale?: number;
}

export interface VFXDefinition {
  id: string;
  layers: readonly VFXLayerDefinition[];
  priority: VFXPriority;
  maxCount: number;
}

export interface VFXInstance {
  effectId: PixelEffectId;
  frame: string;
  kind: VFXKind;
  space: 'world';
  sourceId?: string;
  ownerId?: string;
  priority: VFXPriority;
  position: { x: number; y: number; z: number };
  direction: { x: number; z: number };
  velocity: { x: number; y: number; z: number };
  lifetimeSeconds: number;
  remainingSeconds: number;
  size: number;
  tint: string;
  opacityCurve: VFXCurve;
  scaleCurve: VFXCurve;
  orientation: VFXOrientation;
  layer: number;
  gravity: number;
}

const layer = (
  frame: string,
  kind: VFXKind,
  count: number,
  lifetimeSeconds: number,
  size: number,
  palette: readonly string[],
  motion: VFXMotion,
  orientation: VFXOrientation,
  opacityCurve: VFXCurve,
  scaleCurve: VFXCurve,
  renderLayer = 4,
  velocityScale = 1,
  gravity = 0,
): VFXLayerDefinition => ({
  frame, kind, count, lifetimeSeconds, size, palette, motion, orientation,
  opacityCurve, scaleCurve, layer: renderLayer, velocityScale, gravity,
});

const define = (id: string, priority: VFXPriority, maxCount: number, ...layers: VFXLayerDefinition[]): VFXDefinition => ({
  id, priority, maxCount, layers,
});

export const VFX_DEFINITIONS = {
  bronze_slash: define('bronze_slash', 'ordinary_hit', 1,
    layer('bronze_slash', 'ARC', 1, 0.22, 0.92, ['#f3d18a'], 'directional', 'direction', 'flash', 'contract', 5, 0.1)),
  dory_thrust: define('dory_thrust', 'ordinary_hit', 5,
    layer('spear_thrust', 'IMPACT', 1, 0.2, 0.5, ['#f4dfae'], 'directional', 'billboard', 'flash', 'contract', 5, 0.08),
    layer('metal_sparks', 'IMPACT', 4, 0.22, 0.24, ['#e8c37a', '#f4dfae'], 'directional', 'billboard', 'flash', 'contract', 5, 1.15, 0.7)),
  spear_thrust: define('spear_thrust', 'ordinary_hit', 4,
    layer('spear_thrust', 'ARC', 1, 0.18, 0.72, ['#f4dfae'], 'directional', 'direction', 'flash', 'contract', 5, 0.08)),
  aspis_impact: define('aspis_impact', 'critical_hit', 7,
    layer('shield_impact', 'RING', 1, 0.32, 0.72, ['#f4d27d'], 'expand', 'ground', 'fade', 'expand', 4, 0)),
  shield_impact: define('shield_impact', 'critical_hit', 7,
    layer('shield_impact', 'RING', 1, 0.3, 0.7, ['#f4d27d'], 'expand', 'ground', 'fade', 'expand', 4, 0),
    layer('metal_sparks', 'IMPACT', 6, 0.21, 0.22, ['#e7b961', '#fff0bb'], 'radial', 'billboard', 'flash', 'contract', 5, 1.2, 0.5)),
  blood_hit: define('blood_hit', 'ordinary_hit', 7,
    layer('blood_hit', 'BURST', 7, 0.27, 0.28, ['#b44747', '#ee8b63', '#7b3036'], 'radial', 'billboard', 'fade', 'contract', 5, 0.8, 0.3)),
  arachne_venom: define('arachne_venom', 'ordinary_hit', 6,
    layer('poison_splash', 'IMPACT', 1, 0.26, 0.58, ['#a8c85c'], 'directional', 'billboard', 'flash', 'contract', 5, 0.2),
    layer('venom_droplets', 'BURST', 5, 0.34, 0.2, ['#b7d468', '#d8e68a'], 'radial', 'billboard', 'fade', 'contract', 5, 0.65, 0.35)),
  venom_droplets: define('venom_droplets', 'ambience', 5,
    layer('venom_droplets', 'BURST', 5, 0.34, 0.2, ['#b7d468', '#d8e68a'], 'radial', 'billboard', 'fade', 'contract', 5, 0.65, 0.35)),
  poison_splash: define('poison_splash', 'ordinary_hit', 6,
    layer('poison_splash', 'IMPACT', 1, 0.25, 0.52, ['#a8c85c'], 'directional', 'billboard', 'flash', 'contract', 5, 0.2),
    layer('venom_droplets', 'BURST', 5, 0.32, 0.19, ['#b7d468', '#d8e68a'], 'radial', 'billboard', 'fade', 'contract', 5, 0.62, 0.3)),
  serpent_venom: define('serpent_venom', 'ordinary_hit', 6,
    layer('poison_splash', 'IMPACT', 1, 0.25, 0.52, ['#a8c85c'], 'directional', 'billboard', 'flash', 'contract', 5, 0.2),
    layer('venom_droplets', 'BURST', 5, 0.32, 0.19, ['#b7d468', '#d8e68a'], 'radial', 'billboard', 'fade', 'contract', 5, 0.62, 0.3)),
  web_snare: define('web_snare', 'ordinary_hit', 5,
    layer('web_impact', 'IMPACT', 1, 0.36, 0.68, ['#dce2c4'], 'stationary', 'billboard', 'fade', 'contract', 5),
    layer('web_threads', 'BURST', 4, 0.26, 0.28, ['#c8d2b7', '#eef0dc'], 'directional', 'billboard', 'flash', 'contract', 5, 0.55)),
  web_threads: define('web_threads', 'ambience', 4,
    layer('web_threads', 'BURST', 4, 0.26, 0.28, ['#c8d2b7', '#eef0dc'], 'directional', 'billboard', 'flash', 'contract', 5, 0.55)),
  web_impact: define('web_impact', 'ordinary_hit', 5,
    layer('web_impact', 'IMPACT', 1, 0.34, 0.64, ['#dce2c4'], 'stationary', 'billboard', 'fade', 'contract', 5),
    layer('web_threads', 'BURST', 4, 0.24, 0.26, ['#c8d2b7', '#eef0dc'], 'directional', 'billboard', 'flash', 'contract', 5, 0.5)),
  promethean_flame: define('promethean_flame', 'ordinary_hit', 8,
    layer('fire_burst', 'BURST', 1, 0.46, 0.88, ['#ffb64d'], 'upward', 'billboard', 'fade', 'expand', 5, 0.12, 0.25),
    layer('flame_core', 'IMPACT', 1, 0.25, 0.52, ['#fff0a8'], 'upward', 'billboard', 'flash', 'contract', 6, 0.08),
    layer('fire_embers', 'BURST', 6, 0.42, 0.2, ['#ff9b43', '#f4d27d'], 'radial', 'billboard', 'fade', 'contract', 5, 0.72, 0.24)),
  flame_core: define('flame_core', 'ambience', 1,
    layer('flame_core', 'IMPACT', 1, 0.25, 0.52, ['#fff0a8'], 'upward', 'billboard', 'flash', 'contract', 6, 0.08)),
  fire_embers: define('fire_embers', 'ambience', 6,
    layer('fire_embers', 'BURST', 6, 0.42, 0.2, ['#ff9b43', '#f4d27d'], 'radial', 'billboard', 'fade', 'contract', 5, 0.72, 0.24)),
  fire_burst: define('fire_burst', 'ordinary_hit', 8,
    layer('fire_burst', 'BURST', 1, 0.42, 0.82, ['#ffb64d'], 'upward', 'billboard', 'fade', 'expand', 5, 0.12, 0.24),
    layer('flame_core', 'IMPACT', 1, 0.24, 0.48, ['#fff0a8'], 'upward', 'billboard', 'flash', 'contract', 6, 0.08),
    layer('fire_embers', 'BURST', 6, 0.39, 0.19, ['#ff9b43', '#f4d27d'], 'radial', 'billboard', 'fade', 'contract', 5, 0.68, 0.22)),
  stone_shockwave: define('stone_shockwave', 'critical_hit', 8,
    layer('stone_shockwave', 'RING', 1, 0.4, 1.1, ['#d7b27a'], 'expand', 'ground', 'fade', 'expand', 3, 0),
    layer('stone_dust', 'GROUND_DECAL', 1, 0.36, 0.95, ['#b4936d'], 'stationary', 'ground', 'fade', 'contract', 2),
    layer('stone_chips', 'BURST', 6, 0.34, 0.22, ['#d0b08a', '#e1c89a'], 'radial', 'billboard', 'fade', 'contract', 5, 0.82, 0.85)),
  stone_dust: define('stone_dust', 'ambience', 1,
    layer('stone_dust', 'GROUND_DECAL', 1, 0.36, 0.95, ['#b4936d'], 'stationary', 'ground', 'fade', 'contract', 2)),
  stone_chips: define('stone_chips', 'ordinary_hit', 6,
    layer('stone_chips', 'BURST', 6, 0.31, 0.24, ['#ccb18b', '#e2c99b'], 'radial', 'billboard', 'fade', 'contract', 5, 0.82, 0.9)),
  metal_sparks: define('metal_sparks', 'ordinary_hit', 6,
    layer('metal_sparks', 'BURST', 6, 0.23, 0.22, ['#efc36e', '#fff0bb'], 'directional', 'billboard', 'flash', 'contract', 5, 0.9, 0.55)),
  oracle_spark: define('oracle_spark', 'ordinary_hit', 4,
    layer('oracle_spark', 'TRAIL', 3, 0.18, 0.2, ['#a7efff', '#f4f5d7'], 'directional', 'billboard', 'fade', 'contract', 5, 0.18)),
  chthonic_bolt: define('chthonic_bolt', 'critical_hit', 6,
    layer('chthonic_bolt', 'CAST', 1, 0.24, 0.52, ['#ba7290'], 'directional', 'billboard', 'flash', 'contract', 5, 0.2),
    layer('soul_ash', 'BURST', 5, 0.38, 0.23, ['#91627d', '#c18b9a'], 'upward', 'billboard', 'fade', 'contract', 5, 0.45, 0.22)),
  guardian_sigil: define('guardian_sigil', 'guardian_telegraph', 3,
    layer('guardian_sigil', 'RING', 1, 0.56, 1, ['#f0705a'], 'expand', 'ground', 'fade', 'expand', 3, 0),
    layer('web_threads', 'RING', 1, 0.5, 0.74, ['#df8670'], 'stationary', 'ground', 'fade', 'contract', 4, 0)),
  guardian_death: define('guardian_death', 'critical_hit', 12,
    layer('boss_death_burst', 'BURST', 1, 0.46, 1.22, ['#f1bc73'], 'expand', 'billboard', 'flash', 'expand', 6, 0.08),
    layer('soul_ash', 'BURST', 7, 0.72, 0.32, ['#a36d7b', '#e4bb91'], 'upward', 'billboard', 'fade', 'contract', 5, 0.55, 0.14),
    layer('fire_embers', 'BURST', 4, 0.38, 0.21, ['#efb86a', '#f7dfad'], 'radial', 'billboard', 'fade', 'contract', 5, 0.7, 0.2)),
  boss_death_burst: define('boss_death_burst', 'critical_hit', 12,
    layer('boss_death_burst', 'BURST', 1, 0.43, 1.12, ['#f1bc73'], 'expand', 'billboard', 'flash', 'expand', 6, 0.08),
    layer('soul_ash', 'BURST', 7, 0.64, 0.3, ['#a36d7b', '#e4bb91'], 'upward', 'billboard', 'fade', 'contract', 5, 0.52, 0.15)),
  soul_ash: define('soul_ash', 'ordinary_hit', 7,
    layer('soul_ash', 'BURST', 7, 0.48, 0.3, ['#a36d7b', '#e4bb91'], 'upward', 'billboard', 'fade', 'contract', 5, 0.52, 0.16)),
  laurel_light: define('laurel_light', 'ordinary_hit', 8,
    layer('laurel_light', 'RING', 1, 0.44, 0.72, ['#bfe7ab'], 'expand', 'ground', 'fade', 'expand', 4, 0),
    layer('laurel_light', 'BURST', 6, 0.44, 0.22, ['#d8ebb0', '#f1d58b'], 'upward', 'billboard', 'fade', 'contract', 5, 0.38, 0.08)),
  ariadne_thread: define('ariadne_thread', 'critical_hit', 7,
    layer('web_threads', 'TRAIL', 3, 0.48, 0.24, ['#67ddd2', '#d5fff5'], 'directional', 'billboard', 'fade', 'expand', 6, 0.1),
    layer('laurel_light', 'BURST', 4, 0.34, 0.19, ['#8ee7d9', '#d8fff4'], 'upward', 'billboard', 'fade', 'contract', 5, 0.18, 0.06)),
  cistern_splash: define('cistern_splash', 'ordinary_hit', 6,
    layer('water_splash', 'BURST', 6, 0.32, 0.25, ['#9bd6d0', '#d2f3e9'], 'radial', 'billboard', 'fade', 'contract', 5, 0.62, 0.3)),
  water_splash: define('water_splash', 'ordinary_hit', 6,
    layer('water_splash', 'BURST', 6, 0.32, 0.25, ['#9bd6d0', '#d2f3e9'], 'radial', 'billboard', 'fade', 'contract', 5, 0.62, 0.3)),
  bronze_impact: define('bronze_impact', 'ordinary_hit', 7,
    layer('bronze_impact', 'IMPACT', 1, 0.2, 0.48, ['#f0c875'], 'directional', 'billboard', 'flash', 'contract', 5, 0.08),
    layer('metal_sparks', 'BURST', 5, 0.22, 0.2, ['#f2cb75', '#fff1bd'], 'radial', 'billboard', 'flash', 'contract', 5, 0.85, 0.5)),
  generic_impact: define('generic_impact', 'ordinary_hit', 3,
    layer('bronze_impact', 'IMPACT', 1, 0.18, 0.4, ['#dfd0ad'], 'stationary', 'billboard', 'flash', 'contract', 5)),
  lamia_lunge_trace: define('lamia_lunge_trace', 'guardian_telegraph', 3,
    layer('chthonic_bolt', 'TRAIL', 3, 0.18, 0.2, ['#c17c91'], 'directional', 'billboard', 'fade', 'contract', 5, 0.22)),
  serpent_cone: define('serpent_cone', 'guardian_telegraph', 3,
    layer('guardian_sigil', 'RING', 1, 0.5, 0.84, ['#bbd66e'], 'expand', 'ground', 'fade', 'expand', 3, 0)),
  cyclopean_shockwave: define('cyclopean_shockwave', 'guardian_telegraph', 8,
    layer('stone_shockwave', 'RING', 1, 0.42, 1.08, ['#e3b875'], 'expand', 'ground', 'fade', 'expand', 3, 0),
    layer('stone_chips', 'BURST', 7, 0.38, 0.23, ['#d0b08a', '#f1d29e'], 'radial', 'billboard', 'fade', 'contract', 5, 0.82, 0.9)),
  warden_delayed_sigil: define('warden_delayed_sigil', 'guardian_telegraph', 3,
    layer('guardian_sigil', 'RING', 1, 0.6, 1, ['#e86767'], 'expand', 'ground', 'fade', 'expand', 3, 0),
    layer('web_threads', 'RING', 1, 0.56, 0.76, ['#f1a0a0'], 'stationary', 'ground', 'fade', 'contract', 4, 0)),
} satisfies Record<string, VFXDefinition>;

export type PixelEffectId = keyof typeof VFX_DEFINITIONS;
export type VFXSurface = 'organic' | 'stone' | 'metal' | 'water' | 'mystic';

export const VFX_PRIORITY_RANK: Readonly<Record<VFXPriority, number>> = {
  ambience: 0,
  ordinary_hit: 1,
  critical_hit: 2,
  guardian_telegraph: 3,
};

const METAL_ENEMY_VISUALS = new Set(['bronze_revenant', 'bronze_automaton', 'bronze_gateward', 'bronze_tyrant', 'guardian_bronze_gatekeeper']);
const STONE_ENEMY_VISUALS = new Set(['cyclopean_brute', 'guardian_cyclopean_mason', 'cistern_titan', 'basalt_lord', 'serpent_gate_colossus']);

export function getVfxPoolCapacity(isMobile: boolean): number {
  return isMobile ? 24 : 48;
}

export function resolveSurfaceEffect(surface: VFXSurface | undefined): PixelEffectId {
  if (surface === 'stone') return 'stone_chips';
  if (surface === 'metal') return 'metal_sparks';
  if (surface === 'water') return 'water_splash';
  if (surface === 'mystic') return 'chthonic_bolt';
  return 'generic_impact';
}

export function getEnemyVfxSurface(visualId: string): VFXSurface {
  if (METAL_ENEMY_VISUALS.has(visualId)) return 'metal';
  if (STONE_ENEMY_VISUALS.has(visualId)) return 'stone';
  return 'organic';
}

export function getTileVfxSurface(tile: number | undefined): VFXSurface {
  if (tile === TileType.DOOR) return 'metal';
  if (tile === TileType.WALL || tile === TileType.LOCKED || tile === TileType.SECRET || tile === undefined) return 'stone';
  return 'organic';
}

export interface VFXSlotSnapshot {
  active: boolean;
  priority: VFXPriority;
  age: number;
}

/** Returns an available slot, or the oldest slot at the lowest replaceable priority. */
export function chooseVfxSlot(slots: readonly VFXSlotSnapshot[], incoming: VFXPriority): number {
  for (let index = 0; index < slots.length; index += 1) if (!slots[index].active) return index;
  let candidate = -1;
  let lowestRank = Infinity;
  let oldestAge = -Infinity;
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    const rank = VFX_PRIORITY_RANK[slot.priority];
    if (rank > VFX_PRIORITY_RANK[incoming]) continue;
    if (rank < lowestRank || rank === lowestRank && slot.age > oldestAge) {
      candidate = index;
      lowestRank = rank;
      oldestAge = slot.age;
    }
  }
  return candidate;
}

export function getVfxModeCount(mode: VFXMode, count: number, priority: VFXPriority): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  if (mode === 'off') return 0;
  if (mode === 'reduced') {
    if (priority === 'ambience') return 0;
    return Math.max(1, Math.ceil(count * 0.5));
  }
  return count;
}

export function isValidVfxLayerTiming(lifetimeSeconds: number, size: number): boolean {
  return Number.isFinite(lifetimeSeconds) && lifetimeSeconds > 0 && Number.isFinite(size) && size > 0;
}
