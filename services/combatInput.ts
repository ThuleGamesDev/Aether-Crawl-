import type { Character, Enemy, Item } from '../types';
import type { CombatCommand } from './combatActions';

export type CombatInput =
  | { type: 'character'; index: number }
  | { type: 'characterCycle' | 'attack' | 'defend' | 'item' | 'pause' | 'cancel' | 'auto' }
  | { type: 'targetCycle'; direction: number }
  | { type: 'quickSkill'; slot: number };
export const QUICK_SKILL_KEYS = ['Q', 'E', 'R', 'F'] as const;

export function combatKeyInput(code: string, shift = false): CombatInput | null {
  if (/^(Digit[1-4]|F[1-4])$/.test(code)) return { type: 'character', index: Number(code.slice(-1)) - 1 };
  const slot = ['KeyQ', 'KeyE', 'KeyR', 'KeyF'].indexOf(code);
  if (slot >= 0) return { type: 'quickSkill', slot };
  if (code === 'Tab') return { type: 'targetCycle', direction: shift ? -1 : 1 };
  if (code === 'Space') return { type: 'pause' };
  if (code === 'KeyG') return { type: 'item' };
  if (code === 'KeyV') return { type: 'defend' };
  if (code === 'KeyB') return { type: 'auto' };
  if (code === 'Escape') return { type: 'cancel' };
  return null;
}
export function combatTouchInput(action: string): CombatInput | null {
  if (/^skill[0-3]$/.test(action)) return { type: 'quickSkill', slot: Number(action.slice(-1)) };
  if (action === 'target') return { type: 'targetCycle', direction: 1 };
  if (action === 'party') return { type: 'characterCycle' };
  if (['attack', 'defend', 'item', 'pause', 'cancel', 'auto'].includes(action)) return { type: action } as CombatInput;
  return null;
}
export function cycleTarget(enemies: Enemy[], currentId: string | null, direction = 1): string | null {
  const alive = enemies.filter(e => e.hp > 0);
  if (!alive.length) return null;
  const index = alive.findIndex(e => e.id === currentId);
  if (index < 0) return alive[direction < 0 ? alive.length - 1 : 0].id;
  return alive[(index + (direction < 0 ? -1 : 1) + alive.length) % alive.length].id;
}
export function selectCharacter(party: Character[], index: number, cycle = false): number | null {
  if (!cycle) return party[index]?.stats.hp > 0 ? index : null;
  for (let i = 1; i <= party.length; i++) {
    const next = (index + i) % party.length;
    if (party[next].stats.hp > 0) return next;
  }
  return null;
}
export function quickPotion(inventory: Item[], preferredId?: string | null): Item | undefined {
  const usable = inventory.filter(i => i.type === 'POTION' && i.quantity > 0 && (i.id.includes('hp') || i.id.includes('mp')));
  // An explicitly bound empty slot never silently switches from HP to MP.
  return preferredId ? usable.find(i => i.id === preferredId) : usable.find(i => i.id.includes('hp')) ?? usable[0];
}
export function quickCommand(character: Character | undefined, targetId: string | null, input: CombatInput, inventory: Item[], potionId?: string | null): CombatCommand | null {
  if (!character || character.stats.hp <= 0) return null;
  const base = { actorId: character.id, targetId };
  if (input.type === 'attack' || input.type === 'defend') return { ...base, type: input.type };
  if (input.type === 'quickSkill') {
    const skill = character.skills.slice(0, 4)[input.slot];
    return skill ? { ...base, type: 'skill', id: skill.id } : null;
  }
  if (input.type === 'item') {
    const potion = quickPotion(inventory, potionId);
    return potion ? { ...base, type: 'item', id: potion.id } : null;
  }
  return null;
}

/** Describes the current resolver, including legacy special cases, instead of promising unauthored behavior. */
export function skillEffectSummary(character: Character, skill: Character['skills'][number]): string {
  if (skill.id === 'soul_pact') return 'Spend 20 HP to restore up to 40 MP.';
  const stat = skill.scalingStat === 'STR' ? character.stats.str : skill.scalingStat === 'DEX' ? character.stats.dex : character.stats.int;
  const power = skill.basePower + Math.floor(stat * skill.scaling);
  const ally = skill.targetType === 'ALLY' ? 'the lowest-health ally' : 'self';
  let text = skill.type === 'HEAL' ? `Restore up to ${power} HP to ${ally}.`
    : skill.type === 'BUFF' ? `Buff ${ally}.`
    : `Deal ${power} damage to ${skill.targetType === 'MULTI' ? 'all living enemies' : 'the selected target'}.`;
  if (skill.type === 'DRAIN') text += ` Restore up to ${Math.floor(power * 0.8)} HP to self.`;
  if (skill.effect) text += ` ${skill.effect.type} · ${Math.round(skill.effect.chance * 100)}% · ${skill.effect.duration} cycles.`;
  return text;
}
