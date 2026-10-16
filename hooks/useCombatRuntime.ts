import { useCallback, useEffect, useRef, useState } from 'react';
import type { Enemy, Player } from '../types';
import { CombatRuntime, type CombatSnapshot, type CombatUpdate } from '../services/combatRuntime';
import type { CombatCommand } from '../services/combatActions';

export const useCombatRuntime = (enabled: boolean, onUpdate: (update: CombatUpdate) => void) => {
  const runtimeRef = useRef<CombatRuntime | null>(null);
  const callbackRef = useRef(onUpdate); callbackRef.current = onUpdate;
  const [snapshot, setSnapshot] = useState<CombatSnapshot | null>(null);
  const snapshotRef = useRef<CombatSnapshot | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const outcomeDeliveredRef = useRef(false);
  const publish = useCallback(() => {
    snapshotRef.current = runtimeRef.current?.snapshot() ?? null; setSnapshot(snapshotRef.current);
  }, []);
  const deliver = useCallback((update: CombatUpdate) => {
    if (outcomeDeliveredRef.current) return;
    if (update.outcome) outcomeDeliveredRef.current = true;
    if (update.changed || update.logs.length || update.outcome) callbackRef.current(update);
  }, []);
  const start = useCallback((player: Player, enemies: Enemy[]) => {
    runtimeRef.current = new CombatRuntime(player, enemies); outcomeDeliveredRef.current = false; setPanelOpen(false); publish();
    return runtimeRef.current;
  }, [publish]);
  const stop = useCallback(() => { runtimeRef.current = null; publish(); }, [publish]);
  const act = useCallback((command: CombatCommand) => {
    if (!enabled || !runtimeRef.current || outcomeDeliveredRef.current) return;
    const update = runtimeRef.current.act(command); deliver(update); publish(); return update;
  }, [enabled, deliver, publish]);
  useEffect(() => {
    if (!enabled || !runtimeRef.current || outcomeDeliveredRef.current) return;
    const runtime = runtimeRef.current;
    deliver(runtime.flush());
    if (runtime.outcome || runtime.actors[runtime.turnId ?? '']?.side !== 'enemy' || panelOpen) return;
    const id = runtime.turnId!, round = runtime.round;
    // A delay separates visual/log feedback only. It never advances a hero's turn.
    const timer = setTimeout(() => {
      if (document.hidden || runtimeRef.current !== runtime) { publish(); return; }
      deliver(runtime.stepEnemy(id, round)); publish();
    }, 1000);
    return () => clearTimeout(timer);
  }, [enabled, snapshot, panelOpen, deliver, publish]);
  return { start, stop, act, setPanelOpen, snapshot, snapshotRef, runtimeRef };
};
