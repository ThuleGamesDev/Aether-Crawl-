import { useCallback, useEffect, useRef, useState } from 'react';
import type { Enemy, Player } from '../types';
import { CombatRuntime, type CombatSnapshot, type CombatUpdate } from '../services/combatRuntime';
import type { CombatCommand } from '../services/combatActions';

export const useCombatRuntime = (enabled: boolean, onUpdate: (update: CombatUpdate) => void) => {
  const runtimeRef = useRef<CombatRuntime | null>(null);
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;
  const [snapshot, setSnapshot] = useState<CombatSnapshot | null>(null);
  const snapshotRef = useRef<CombatSnapshot | null>(null);
  const outcomeDeliveredRef = useRef(false);
  const publish = useCallback(() => {
    snapshotRef.current = runtimeRef.current?.snapshot() ?? null;
    setSnapshot(snapshotRef.current);
  }, []);
  const deliver = useCallback((update: CombatUpdate) => {
    if (outcomeDeliveredRef.current) return;
    if (update.outcome) outcomeDeliveredRef.current = true;
    if (update.changed || update.logs.length || update.outcome) callbackRef.current(update);
  }, []);
  const start = useCallback((player: Player, enemies: Enemy[]) => {
    runtimeRef.current = new CombatRuntime(player, enemies);
    outcomeDeliveredRef.current = false;
    publish();
    return runtimeRef.current;
  }, [publish]);
  const stop = useCallback(() => { runtimeRef.current = null; publish(); }, [publish]);
  const act = useCallback((command: CombatCommand) => {
    if (!runtimeRef.current || outcomeDeliveredRef.current) return;
    deliver(runtimeRef.current.act(command)); publish();
  }, [deliver, publish]);
  const togglePause = useCallback(() => {
    const runtime = runtimeRef.current;
    if (runtime) { runtime.setPaused(!runtime.clock.paused); publish(); }
  }, [publish]);
  const setSlowdown = useCallback((slow: boolean) => { runtimeRef.current?.setSlowdown(slow); publish(); }, [publish]);
  useEffect(() => {
    if (!enabled) return;
    let frame = 0, previous = 0, uiElapsed = 0;
    const tick = (time: number) => {
      const dt = previous && !document.hidden ? Math.min(100, Math.max(0, time - previous)) : 0;
      previous = time;
      if (runtimeRef.current && !outcomeDeliveredRef.current) deliver(runtimeRef.current.advance(dt));
      uiElapsed += dt;
      if (uiElapsed >= 100) { uiElapsed = 0; publish(); }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled, deliver, publish]);
  return { start, stop, act, togglePause, setSlowdown, snapshot, snapshotRef, runtimeRef };
};
