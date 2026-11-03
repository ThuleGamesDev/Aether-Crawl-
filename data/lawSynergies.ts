import type { MazeLawId, MazeLawSynergyId } from '../types';
import { getMazeLaw, isMazeLawId } from './mazeLaws';

export interface MazeLawSynergyDefinition {
  synergyId: MazeLawSynergyId;
  requiredLawIds: readonly [MazeLawId, MazeLawId];
  excludedLawIds: readonly MazeLawId[];
  title: string;
  description: string;
  roomArchetype: string;
  visualCueId: string;
  encounterBudget: { enemies: number; hazards: number };
}

/** Explicit pairings keep Law interaction authored, bounded, and reviewable. */
export const MAZE_LAW_SYNERGIES: readonly MazeLawSynergyDefinition[] = Object.freeze([
  {
    synergyId: 'echo_pack',
    requiredLawIds: ['hall_of_echoes', 'bronze_hounds'],
    excludedLawIds: ['shades_of_styx'],
    title: 'Echo-Pack Chamber',
    description: 'An Echo Remnant hunts beside two Bronze Hounds. The pack shares one chamber and keeps its two separate, once-only rewards.',
    roomArchetype: 'ECHO_PACK_CHAMBER',
    visualCueId: 'ECHO_PACK_BRONZE_RING',
    encounterBudget: { enemies: 3, hazards: 0 },
  },
  {
    synergyId: 'ares_pillar_arena',
    requiredLawIds: ['oath_of_ares', 'pillars_of_daedalus'],
    excludedLawIds: ['hall_of_echoes'],
    title: 'Ares Pillar Arena',
    description: 'A Daedalus guard fights among blocking pillars under Ares’s faster cadence. A successful parry keeps the existing stamina and poise reward.',
    roomArchetype: 'ARES_PILLAR_ARENA',
    visualCueId: 'ARES_PILLAR_SIGIL',
    encounterBudget: { enemies: 1, hazards: 0 },
  },
  {
    synergyId: 'venom_nest',
    requiredLawIds: ['serpents_bargain', 'arachnes_kin'],
    excludedLawIds: ['shades_of_styx'],
    title: 'Venom Nest',
    description: 'Arachne’s Brood guards the marked venom pool. One visible Antidote Flask is placed by the pool; the brood does not create a second guaranteed antidote.',
    roomArchetype: 'VENOM_NEST',
    visualCueId: 'VENOM_NEST_OFFER',
    encounterBudget: { enemies: 2, hazards: 1 },
  },
]);

export function getMazeLawSynergy(synergyId: string): MazeLawSynergyDefinition | undefined {
  return MAZE_LAW_SYNERGIES.find(synergy => synergy.synergyId === synergyId);
}

export function resolveMazeLawSynergies(activeLawIds: readonly unknown[]): MazeLawSynergyDefinition[] {
  if (activeLawIds.length > 3 || !activeLawIds.every(isMazeLawId) || new Set(activeLawIds).size !== activeLawIds.length) return [];
  const active = new Set(activeLawIds);
  const laws = [...active].map(getMazeLaw).filter((law): law is NonNullable<typeof law> => Boolean(law));
  if (laws.some((law, index) => laws.slice(index + 1).some(other => law.incompatibilities.includes(other.lawId) || other.incompatibilities.includes(law.lawId)))) return [];
  return MAZE_LAW_SYNERGIES.filter(synergy => synergy.requiredLawIds.every(id => active.has(id))
    && !synergy.excludedLawIds.some(id => active.has(id)));
}

export function isMazeLawSynergyId(value: unknown): value is MazeLawSynergyId {
  return typeof value === 'string' && MAZE_LAW_SYNERGIES.some(synergy => synergy.synergyId === value);
}

export function validateMazeLawSynergyRegistry(): boolean {
  const ids = MAZE_LAW_SYNERGIES.map(synergy => synergy.synergyId);
  return new Set(ids).size === ids.length && MAZE_LAW_SYNERGIES.length <= 5
    && MAZE_LAW_SYNERGIES.every(synergy => synergy.requiredLawIds.length === 2
      && new Set(synergy.requiredLawIds).size === 2
      && synergy.requiredLawIds.every(isMazeLawId)
      && synergy.excludedLawIds.every(id => isMazeLawId(id) && !synergy.requiredLawIds.includes(id))
      && /^[A-Z][A-Z0-9_]{0,47}$/.test(synergy.roomArchetype)
      && /^[A-Z][A-Z0-9_]{0,47}$/.test(synergy.visualCueId)
      && Number.isInteger(synergy.encounterBudget.enemies) && synergy.encounterBudget.enemies >= 0 && synergy.encounterBudget.enemies <= 3
      && Number.isInteger(synergy.encounterBudget.hazards) && synergy.encounterBudget.hazards >= 0 && synergy.encounterBudget.hazards <= 1);
}
