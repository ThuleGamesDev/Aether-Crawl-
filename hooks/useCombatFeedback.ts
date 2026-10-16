import { useCallback, useRef } from 'react';
import type { CombatEvent } from '../services/combatFeedback';
import { audioService } from '../services/audioService';
export type FloatingCombatEvent = CombatEvent & { id: number; createdAt: number };
/** Presentation uses wall time only; it never advances combat turns. */
export function useCombatFeedback() {
  const eventsRef = useRef<FloatingCombatEvent[]>([]);
  const sequence = useRef(0);
  const publish = useCallback((events: CombatEvent[] = []) => {
    const now = Date.now();
    eventsRef.current = [...eventsRef.current.filter(e => now - e.createdAt < 1100), ...events.map(e => ({ ...e, id: ++sequence.current, createdAt: now }))].slice(-24);
    // One sound per category per batch prevents simultaneous auto attacks creating audio noise.
    const keys = new Set<string>();
    for (const event of events) {
      const key = event.kind === 'damage' ? `${event.kind}:${event.source}` : event.kind;
      if (keys.has(key)) continue; keys.add(key);
      if (event.kind === 'crit') audioService.playCrit();
      else if (event.kind === 'damage') event.source === 'enemy' ? audioService.playEnemyHit() : audioService.playAttack();
      else if (event.kind === 'guard') audioService.playDefend();
      else if (event.kind === 'block') audioService.playBlock();
      else if (event.kind === 'heal' || event.kind === 'mana') audioService.playHeal();
      else if (event.kind === 'interrupt') audioService.playInterrupt();
      else if (event.kind === 'phase') audioService.playBossPhase();
    }
  }, []);
  const clear = useCallback(() => { eventsRef.current = []; }, []);
  return { eventsRef, publish, clear };
}
