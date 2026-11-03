import type { ArchitecturalRoom, FloorState, Position } from '../types';
import { validateLawHazard, validateLawProgress, validateLawSpawn, validLawId } from '../world/LivingLabyrinth';
import { validateAriadneThreadFloor } from './ariadneThread';
import { getMazeLawSynergy, isMazeLawSynergyId } from '../data/lawSynergies';
const roomTypes = new Set(['NORMAL','COMBAT','ELITE','TREASURE','SHRINE','TRAP','SECRET','REST','LOCKED','EVENT','BOSS_ANTECHAMBER','BOSS']);
const architectureShapes = new Set(['ENTRY_HALL','HALL','GALLERY','CROSSROADS','PILLARED_HALL','ROTUNDA','GUARDIAN_ARENA','WIDE_PASSAGE','NARROW_PASSAGE']);
const combatSuitabilities = new Set(['NONE','LIMITED','SUITABLE']);
const lightingThemes = new Set(['AMBER','NEUTRAL','COOL','CHTHONIC']);
export function isValidFloorState(value: unknown, map: number[][]): value is FloorState {
  if (!value || typeof value !== 'object') return false;
  const f = value as FloorState;
  const pos = (p: { x: number; y: number }) => p && Number.isInteger(p.x) && Number.isInteger(p.y) && p.y >= 0 && p.y < map.length && p.x >= 0 && p.x < (map[p.y]?.length ?? 0);
  if (f.version !== 1 || !Number.isInteger(f.seed) || f.seed < 0 || f.seed > 4294967295 || !Number.isInteger(f.level) || f.level < 1 || !['dungeon','moss','catacombs','frost','gilded','obsidian'].includes(f.biome) || !Number.isInteger(f.keys) || f.keys < 0 || f.keys > 3 || !Array.isArray(f.rooms) || f.rooms.length > map.flat().length || !Array.isArray(f.visitedCells) || !Array.isArray(f.pendingEffects)) return false;
  const ids = new Set<string>();
  for (const r of f.rooms) { if (!r || typeof r.id !== 'string' || ids.has(r.id) || !roomTypes.has(r.type) || !pos(r.anchor) || !Array.isArray(r.cells) || !r.cells.every(pos) || r.gate && !pos(r.gate) || !['discovered','visited','resolved'].every(k => typeof (r as unknown as Record<string,unknown>)[k] === 'boolean')) return false;
    if ((r.type === 'LOCKED' || r.type === 'SECRET') && !r.gate || r.type === 'SHRINE' && !['blood','aether','fortune'].includes(r.shrine ?? '') || r.type === 'TRAP' && !['trap_corridor','mana_mist','toxic_spores','crumbling_ceiling','arcane_surge','frostbound_draft'].includes(r.hazardId ?? '')) return false;
    if (r.unlocked !== undefined && typeof r.unlocked !== 'boolean' || r.attempted !== undefined && typeof r.attempted !== 'boolean') return false;
    if (r.lawId !== undefined && !validLawId(r.lawId)) return false;
    if (r.lawIds !== undefined && (!Array.isArray(r.lawIds) || r.lawIds.length > 3 || new Set(r.lawIds).size !== r.lawIds.length || !r.lawIds.every(validLawId) || r.lawId !== undefined && !r.lawIds.includes(r.lawId))) return false;
    if (r.synergyId !== undefined && (!isMazeLawSynergyId(r.synergyId) || !getMazeLawSynergy(r.synergyId)!.requiredLawIds.every(lawId => (r.lawIds ?? (r.lawId ? [r.lawId] : [])).includes(lawId)))) return false;
    ids.add(r.id); }
  if (f.architectureRooms !== undefined && !isValidArchitectureRooms(f.architectureRooms, map, pos)) return false;
  if (f.threadJunctions !== undefined && !Array.isArray(f.threadJunctions)) return false;
  if (!validateAriadneThreadFloor(f.threadJunctions ?? [], f.threadProgress, map, f.architectureRooms ?? [], f.rooms)) return false;
  const roomIds = new Set(ids);
  if (f.lawProgress !== undefined && !validateLawProgress(f.lawProgress)) return false;
  if (f.lawSpawns !== undefined && (!Array.isArray(f.lawSpawns) || f.lawSpawns.length > 5 || !f.lawSpawns.every(spawn => validateLawSpawn(spawn, roomIds)) || f.lawSpawns.reduce((sum, spawn) => sum + spawn.count, 0) > 5)) return false;
  if (f.lawHazards !== undefined && (!Array.isArray(f.lawHazards) || f.lawHazards.length > 1 || !f.lawHazards.every(hazard => validateLawHazard(hazard, roomIds) && hazard.x >= 0 && hazard.z >= 0 && hazard.x < (map[0]?.length ?? 0) && hazard.z < map.length))) return false;
  if (f.manifestedLawIds !== undefined && (!Array.isArray(f.manifestedLawIds) || f.manifestedLawIds.length > 3 || new Set(f.manifestedLawIds).size !== f.manifestedLawIds.length || !f.manifestedLawIds.every(validLawId))) return false;
  if (f.manifestedSynergyIds !== undefined && (!Array.isArray(f.manifestedSynergyIds) || f.manifestedSynergyIds.length > 3
    || new Set(f.manifestedSynergyIds).size !== f.manifestedSynergyIds.length || !f.manifestedSynergyIds.every(id => isMazeLawSynergyId(id)
      && getMazeLawSynergy(id)!.requiredLawIds.every(lawId => f.manifestedLawIds?.includes(lawId))))) return false;
  return (f.pendingEncounterId === null || ids.has(f.pendingEncounterId)) && f.visitedCells.every(k => typeof k === 'string' && /^\d+,\d+$/.test(k)) && f.pendingEffects.every(e => e && ['WEAKNESS','STRENGTH'].includes(e.type) && Number.isFinite(e.value) && Number.isInteger(e.duration) && e.duration > 0 && e.duration <= 5);
}

function isValidArchitectureRooms(value: unknown, map: number[][], isPosition: (p: Position) => boolean): value is ArchitecturalRoom[] {
  const cellLimit = map.reduce((sum, row) => sum + row.length, 0);
  if (!Array.isArray(value) || value.length > cellLimit) return false;
  const roomIds = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') return false;
    const room = entry as ArchitecturalRoom;
    if (typeof room.id !== 'string' || room.id.length < 1 || room.id.length > 120 || roomIds.has(room.id)
      || !architectureShapes.has(room.roomShape) || !combatSuitabilities.has(room.combatSuitability) || !lightingThemes.has(room.lightingTheme)
      || !Array.isArray(room.cells) || room.cells.length < 1 || room.cells.length > cellLimit
      || !room.cells.every(isPosition) || new Set(room.cells.map(cell => `${cell.x},${cell.y}`)).size !== room.cells.length
      || !Array.isArray(room.landmarkIds) || room.landmarkIds.length > 32
      || !room.landmarkIds.every(id => typeof id === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(id))
      || room.roomArchetype !== undefined && (typeof room.roomArchetype !== 'string' || room.roomArchetype.length > 48)
      || room.threadJunctionId !== undefined && (typeof room.threadJunctionId !== 'string' || !/^thread_[a-z0-9_]{1,96}$/.test(room.threadJunctionId))
      || room.synergyId !== undefined && !isMazeLawSynergyId(room.synergyId)) return false;
    roomIds.add(room.id);
  }
  return true;
}
