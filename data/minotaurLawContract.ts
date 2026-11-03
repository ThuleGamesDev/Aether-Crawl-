import type { MazeLawId } from '../types';
import { getMazeLaw, isMazeLawId } from './mazeLaws';

export const MINOTAUR_LAW_CONTRACT_VERSION = 1;
export const MINOTAUR_LAW_MODIFIER_LIMIT = 3;
export const MINOTAUR_INHERITANCE_PLAN_VERSION = 1;
export const MINOTAUR_INHERITANCE_MODIFIER_LIMIT = 3;

/** Legacy summary shape retained for callers that only need the original three-Law cap. */
export interface MinotaurLawModifierContract {
  version: typeof MINOTAUR_LAW_CONTRACT_VERSION;
  modifierIds: MazeLawId[];
}

export interface MinotaurEncounterBudget {
  points: number;
  maxConcurrentAdds: 0;
  maxHazards: 1;
  maxStatusProcsPerHit: 1;
}

/** Data-only preparation contract. It contains no enemy definition, encounter, or executable behavior. */
export interface MinotaurInheritancePlan {
  version: typeof MINOTAUR_INHERITANCE_PLAN_VERSION;
  activeLawIds: MazeLawId[];
  modifierIds: string[];
  arenaRuleIds: string[];
  visualCueIds: string[];
  phaseOptions: string[];
  encounterBudget: MinotaurEncounterBudget;
}

interface InheritanceRule {
  lawId: MazeLawId;
  modifierId: string;
  visualCueId: string;
  phaseOption: string;
  budgetCost: number;
  riskGroup?: 'VENOM';
}

const INHERITANCE_RULES: readonly InheritanceRule[] = [
  { lawId: 'hall_of_echoes', modifierId: 'echo_feint', visualCueId: 'ECHO_AFTERIMAGE', phaseOption: 'ECHO_RECOVERY_WINDOW', budgetCost: 2 },
  { lawId: 'vault_of_tyche', modifierId: 'tyche_offering', visualCueId: 'TYCHE_BRONZE_MARK', phaseOption: 'OFFERING_RECOVERY_WINDOW', budgetCost: 1 },
  { lawId: 'pillars_of_daedalus', modifierId: 'pillar_sweep', visualCueId: 'DAEDALUS_PILLAR_GLOW', phaseOption: 'PILLAR_SWEEP_TELEGRAPH', budgetCost: 2 },
  { lawId: 'bronze_hounds', modifierId: 'bronze_rush', visualCueId: 'BRONZE_TRACK_MARK', phaseOption: 'RUSH_RECOVERY_WINDOW', budgetCost: 2 },
  { lawId: 'arachnes_kin', modifierId: 'brood_venom_mark', visualCueId: 'ARACHNE_VENOM_GLYPH', phaseOption: 'VENOM_CLEANSE_WINDOW', budgetCost: 2, riskGroup: 'VENOM' },
  { lawId: 'shades_of_styx', modifierId: 'stygian_echo', visualCueId: 'STYX_SHADE_GLYPH', phaseOption: 'SHADE_RECOVERY_WINDOW', budgetCost: 1 },
  { lawId: 'oath_of_ares', modifierId: 'ares_cadence', visualCueId: 'ARES_RED_SIGIL', phaseOption: 'PARRY_RECOVERY_WINDOW', budgetCost: 2 },
  { lawId: 'serpents_bargain', modifierId: 'serpent_venom_sweep', visualCueId: 'SERPENT_VENOM_GLYPH', phaseOption: 'VENOM_CLEANSE_WINDOW', budgetCost: 2, riskGroup: 'VENOM' },
  { lawId: 'broken_thread', modifierId: 'fractured_feint', visualCueId: 'FRACTURED_THREAD_GLYPH', phaseOption: 'THREAD_RECOVERY_WINDOW', budgetCost: 1 },
];

const REQUIRED_ARENA_RULES = ['CLEAR_COMBAT_FLOOR', 'SINGLE_VISIBLE_ENTRY', 'NO_ROUTE_EDITS'] as const;
const ARENA_RULES = new Set<string>(REQUIRED_ARENA_RULES);

export function createMinotaurLawModifierContract(activeLawIds: readonly MazeLawId[]): MinotaurLawModifierContract {
  return {
    version: MINOTAUR_LAW_CONTRACT_VERSION,
    modifierIds: [...new Set(activeLawIds)].filter(isMazeLawId).slice(0, MINOTAUR_LAW_MODIFIER_LIMIT),
  };
}

export function isMinotaurLawModifierContract(value: unknown): value is MinotaurLawModifierContract {
  if (!value || typeof value !== 'object') return false;
  const contract = value as MinotaurLawModifierContract;
  return contract.version === MINOTAUR_LAW_CONTRACT_VERSION && Array.isArray(contract.modifierIds)
    && contract.modifierIds.length <= MINOTAUR_LAW_MODIFIER_LIMIT && new Set(contract.modifierIds).size === contract.modifierIds.length
    && contract.modifierIds.every(isMazeLawId);
}

export function createMinotaurInheritancePlan(activeLawIds: readonly MazeLawId[]): MinotaurInheritancePlan {
  if (activeLawIds.length > MINOTAUR_INHERITANCE_MODIFIER_LIMIT || !activeLawIds.every(isMazeLawId)
    || new Set(activeLawIds).size !== activeLawIds.length || hasIncompatibleLaws(activeLawIds)) {
    throw new Error('A Minotaur inheritance plan requires up to three unique, compatible Laws.');
  }
  const active = [...activeLawIds].sort();
  const selectedRules: InheritanceRule[] = [];
  const occupiedRiskGroups = new Set<string>();
  for (const lawId of active) {
    const rule = INHERITANCE_RULES.find(candidate => candidate.lawId === lawId);
    if (!rule || rule.riskGroup && occupiedRiskGroups.has(rule.riskGroup)) continue;
    selectedRules.push(rule);
    if (rule.riskGroup) occupiedRiskGroups.add(rule.riskGroup);
  }
  const plan: MinotaurInheritancePlan = {
    version: MINOTAUR_INHERITANCE_PLAN_VERSION,
    activeLawIds: active,
    modifierIds: selectedRules.map(rule => rule.modifierId).slice(0, MINOTAUR_INHERITANCE_MODIFIER_LIMIT),
    arenaRuleIds: [...REQUIRED_ARENA_RULES],
    visualCueIds: [...new Set(selectedRules.map(rule => rule.visualCueId))],
    phaseOptions: [...new Set(selectedRules.map(rule => rule.phaseOption))].slice(0, MINOTAUR_INHERITANCE_MODIFIER_LIMIT),
    encounterBudget: {
      points: Math.min(6, selectedRules.reduce((sum, rule) => sum + rule.budgetCost, 0)),
      maxConcurrentAdds: 0,
      maxHazards: 1,
      maxStatusProcsPerHit: 1,
    },
  };
  return plan;
}

export function isMinotaurInheritancePlan(value: unknown): value is MinotaurInheritancePlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as MinotaurInheritancePlan;
  if (plan.version !== MINOTAUR_INHERITANCE_PLAN_VERSION || !Array.isArray(plan.activeLawIds) || plan.activeLawIds.length > 3
    || !plan.activeLawIds.every(isMazeLawId) || new Set(plan.activeLawIds).size !== plan.activeLawIds.length || hasIncompatibleLaws(plan.activeLawIds)
    || !Array.isArray(plan.modifierIds) || plan.modifierIds.length > MINOTAUR_INHERITANCE_MODIFIER_LIMIT || new Set(plan.modifierIds).size !== plan.modifierIds.length
    || !Array.isArray(plan.arenaRuleIds) || !plan.arenaRuleIds.every(id => typeof id === 'string' && ARENA_RULES.has(id))
    || !REQUIRED_ARENA_RULES.every(id => plan.arenaRuleIds.includes(id))
    || !Array.isArray(plan.visualCueIds) || new Set(plan.visualCueIds).size !== plan.visualCueIds.length
    || !plan.visualCueIds.every(id => INHERITANCE_RULES.some(rule => rule.visualCueId === id))
    || !Array.isArray(plan.phaseOptions) || plan.phaseOptions.length > MINOTAUR_INHERITANCE_MODIFIER_LIMIT
    || new Set(plan.phaseOptions).size !== plan.phaseOptions.length
    || !plan.phaseOptions.every(id => INHERITANCE_RULES.some(rule => rule.phaseOption === id))) return false;
  if (!plan.encounterBudget || !Number.isInteger(plan.encounterBudget.points) || plan.encounterBudget.points < 0 || plan.encounterBudget.points > 6
    || plan.encounterBudget.maxConcurrentAdds !== 0 || plan.encounterBudget.maxHazards !== 1 || plan.encounterBudget.maxStatusProcsPerHit !== 1) return false;
  const expected = createMinotaurInheritancePlan(plan.activeLawIds);
  return JSON.stringify(plan) === JSON.stringify(expected);
}

function hasIncompatibleLaws(activeLawIds: readonly MazeLawId[]): boolean {
  return activeLawIds.some((lawId, index) => {
    const law = getMazeLaw(lawId);
    return !law || activeLawIds.slice(index + 1).some(otherId => law.incompatibilities.includes(otherId) || getMazeLaw(otherId)?.incompatibilities.includes(lawId));
  });
}
