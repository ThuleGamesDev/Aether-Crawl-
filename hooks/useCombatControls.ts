import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { CombatMenu } from '../types';
import type { useCombatRuntime } from './useCombatRuntime';
import { combatKeyInput, combatTouchInput, cycleTarget, quickCommand, quickPotion, type CombatInput } from '../services/combatInput';
import type { CombatCommand } from '../services/combatActions';

type Props = {
  enabled: boolean; combat: ReturnType<typeof useCombatRuntime>;
  activeCharIndex: number; setActiveCharIndex: Dispatch<SetStateAction<number>>;
  selectedEnemyId: string | null; setSelectedEnemyId: Dispatch<SetStateAction<string | null>>;
};
/** Selection cannot change turn ownership. Every action is revalidated by the runtime. */
export function useCombatControls({ enabled, combat, activeCharIndex, setActiveCharIndex, selectedEnemyId, setSelectedEnemyId }: Props) {
  const [combatMenu, setCombatMenu] = useState<CombatMenu>('MAIN');
  const [detailSlot, setDetailSlot] = useState<number | null>(null);
  const [potionId, setPotionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; until: number } | null>(null);
  const tell = useCallback((text: string) => setNotice({ text, until: Date.now() + 1800 }), []);
  const runtime = combat.runtimeRef.current;
  const actingIndex = runtime?.player.party.findIndex(c => c.id === runtime.turnId) ?? -1;
  const character = runtime?.player.party[actingIndex >= 0 ? actingIndex : activeCharIndex];
  useEffect(() => {
    if (actingIndex >= 0) setActiveCharIndex(actingIndex);
    setCombatMenu('MAIN'); setDetailSlot(null); setNotice(null);
  }, [combat.snapshot?.turnId, combat.snapshot?.round, actingIndex, setActiveCharIndex]);
  useEffect(() => { combat.setPanelOpen(combatMenu !== 'MAIN' || detailSlot !== null); }, [combatMenu, detailSlot, combat.setPanelOpen]);
  const reset = useCallback(() => { setCombatMenu('MAIN'); setDetailSlot(null); setPotionId(null); setNotice(null); }, []);
  const select = useCallback((index: number) => {
    const rt = combat.runtimeRef.current;
    if (!enabled || !rt) return;
    if (rt.player.party[index]?.id !== rt.turnId) { tell('Initiative determines whose turn it is.'); return; }
    setActiveCharIndex(index);
  }, [enabled, combat.runtimeRef, setActiveCharIndex, tell]);
  const submit = useCallback((command: CombatCommand) => {
    const rt = combat.runtimeRef.current;
    if (!enabled || !rt || rt.outcome) return;
    if (!rt.isReady(command.actorId)) { tell('Wait for this hero’s turn.'); return; }
    const update = combat.act(command);
    if (update && !update.changed) tell(update.logs[0] ?? 'Action unavailable.');
    setCombatMenu('MAIN'); setDetailSlot(null);
  }, [enabled, combat.act, combat.runtimeRef, tell]);
  const cancel = useCallback(() => {
    const panel = combatMenu !== 'MAIN' || detailSlot !== null;
    setCombatMenu('MAIN'); setDetailSlot(null); return panel;
  }, [combatMenu, detailSlot]);
  const input = useCallback((action: CombatInput): boolean => {
    const rt = combat.runtimeRef.current;
    if (!enabled || !rt) return false;
    if (action.type === 'cancel') return cancel();
    if (action.type === 'character') { select(action.index); return true; }
    if (action.type === 'targetCycle') { setSelectedEnemyId(cycleTarget(rt.enemies, selectedEnemyId, action.direction)); return true; }
    const actingHero = rt.player.party.find(c => c.id === rt.turnId);
    const command = quickCommand(actingHero, selectedEnemyId, action, rt.player.inventory, potionId);
    if (!actingHero) tell('Enemy turn.');
    else if (command) submit(command);
    else tell(action.type === 'item' ? 'Quick potion slot is empty · choose a potion in Items.' : 'No skill in this slot.');
    return true;
  }, [enabled, combat.runtimeRef, cancel, select, selectedEnemyId, potionId, submit, setSelectedEnemyId, tell]);
  const key = (code: string, shift = false) => { const action = combatKeyInput(code, shift); return action ? input(action) : false; };
  const touch = (action: string) => { const mapped = combatTouchInput(action); if (mapped) input(mapped); };
  const basicAttack = (targetId?: string) => {
    const rt = combat.runtimeRef.current; const hero = rt?.player.party.find(c => c.id === rt.turnId);
    if (hero) { if (targetId) setSelectedEnemyId(targetId); submit({ type: 'attack', actorId: hero.id, targetId: targetId ?? selectedEnemyId }); }
  };
  const action = (name: string) => {
    if (name === 'skill') { setCombatMenu('SKILLS'); setDetailSlot(null); }
    else if (name === 'items') { setCombatMenu('ITEMS'); setDetailSlot(null); }
    else if (name === 'run') { if (character) submit({ type: 'run', actorId: character.id }); }
    else touch(name);
  };
  const subAction = (type: 'skill' | 'item', id: string) => {
    if (type === 'item') { setPotionId(id); setCombatMenu('MAIN'); tell('Quick potion bound · G / Potion uses it.'); }
    else if (character) submit({ type, id, actorId: character.id, targetId: selectedEnemyId });
  };
  return { potionChoices: runtime?.player.inventory.filter(i => i.type === 'POTION' && i.quantity > 0 && (i.id.includes('hp') || i.id.includes('mp'))) ?? [], combatMenu, setCombatMenu, detailSlot, setDetailSlot, notice, potion: runtime ? quickPotion(runtime.player.inventory, potionId) : undefined, character, reset, select, key, touch, input, cancel, basicAttack, action, subAction };
}
export type CombatControls = ReturnType<typeof useCombatControls>;
