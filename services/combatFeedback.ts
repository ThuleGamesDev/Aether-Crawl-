import type { Enemy, Player } from '../types';
export type CombatEventKind = 'damage' | 'crit' | 'heal' | 'block' | 'guard' | 'poison' | 'burn' | 'stun' | 'buff' | 'interrupt' | 'phase' | 'mana';
export interface CombatEvent { kind: CombatEventKind; targetId: string; amount?: number; label?: string; source?: 'player' | 'enemy' }
/** Status/phase transitions are structured changes, not parsed combat log messages. */
export function transitionEvents(beforePlayer: Player, beforeEnemies: Enemy[], player: Player, enemies: Enemy[]): CombatEvent[] {
  const events: CombatEvent[] = [];
  const old = new Map([...beforePlayer.party, ...beforeEnemies].map(a => [a.id, a]));
  for (const actor of [...player.party, ...enemies]) {
    const previous = old.get(actor.id);
    if (!previous) continue;
    for (const effect of actor.statusEffects) {
      if (previous.statusEffects.some(e => e.type === effect.type && e.duration >= effect.duration && e.value >= effect.value)) continue;
      events.push({ targetId: actor.id, kind: effect.type === 'STUN' ? 'stun' : effect.type === 'POISON' ? 'poison' : effect.type === 'BURN' ? 'burn' : 'buff', label: effect.type });
    }
  }
  for (const enemy of enemies) if (beforeEnemies.some(e => e.id === enemy.id && e.phase !== enemy.phase) && (enemy.phase ?? 1) > 1) events.push({ kind: 'phase', targetId: enemy.id, label: `PHASE ${enemy.phase}` });
  return events;
}
export const eventLabel = (event: CombatEvent): string => {
  if (event.label) return event.label;
  if (event.kind === 'crit') return `CRIT ${event.amount ?? 0}`;
  if (event.kind === 'heal') return `+${event.amount ?? 0}`;
  if (event.kind === 'mana') return `+${event.amount ?? 0} MP`;
  if (event.kind === 'damage' || event.kind === 'poison' || event.kind === 'burn') return `−${event.amount ?? 0}`;
  return event.kind === 'block' ? `BLOCK ${event.amount ?? 0}` : event.kind.toUpperCase();
};
