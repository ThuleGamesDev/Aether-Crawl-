import type { FloorState } from '../types';
const roomTypes = new Set(['NORMAL','COMBAT','ELITE','TREASURE','SHRINE','TRAP','SECRET','REST','LOCKED','EVENT','BOSS_ANTECHAMBER','BOSS']);
export function isValidFloorState(value: unknown, map: number[][]): value is FloorState {
  if (!value || typeof value !== 'object') return false;
  const f = value as FloorState;
  const pos = (p: { x: number; y: number }) => p && Number.isInteger(p.x) && Number.isInteger(p.y) && p.y >= 0 && p.y < map.length && p.x >= 0 && p.x < (map[p.y]?.length ?? 0);
  if (f.version !== 1 || !Number.isInteger(f.seed) || f.seed < 0 || f.seed > 4294967295 || !Number.isInteger(f.level) || f.level < 1 || !['dungeon','moss','catacombs','frost','gilded','obsidian'].includes(f.biome) || !Number.isInteger(f.keys) || f.keys < 0 || f.keys > 3 || !Array.isArray(f.rooms) || f.rooms.length > map.flat().length || !Array.isArray(f.visitedCells) || !Array.isArray(f.pendingEffects)) return false;
  const ids = new Set<string>();
  for (const r of f.rooms) { if (!r || typeof r.id !== 'string' || ids.has(r.id) || !roomTypes.has(r.type) || !pos(r.anchor) || !Array.isArray(r.cells) || !r.cells.every(pos) || r.gate && !pos(r.gate) || !['discovered','visited','resolved'].every(k => typeof (r as unknown as Record<string,unknown>)[k] === 'boolean')) return false;
    if ((r.type === 'LOCKED' || r.type === 'SECRET') && !r.gate || r.type === 'SHRINE' && !['blood','aether','fortune'].includes(r.shrine ?? '') || r.type === 'TRAP' && !['trap_corridor','mana_mist','toxic_spores','crumbling_ceiling','arcane_surge','frostbound_draft'].includes(r.hazardId ?? '')) return false;
    if (r.unlocked !== undefined && typeof r.unlocked !== 'boolean' || r.attempted !== undefined && typeof r.attempted !== 'boolean') return false;
    ids.add(r.id); }
  return (f.pendingEncounterId === null || ids.has(f.pendingEncounterId)) && f.visitedCells.every(k => typeof k === 'string' && /^\d+,\d+$/.test(k)) && f.pendingEffects.every(e => e && ['WEAKNESS','STRENGTH'].includes(e.type) && Number.isFinite(e.value) && Number.isInteger(e.duration) && e.duration > 0 && e.duration <= 5);
}
