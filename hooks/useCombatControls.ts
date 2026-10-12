import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { CombatMenu } from '../types';
import type { useCombatRuntime } from './useCombatRuntime';
import { combatKeyInput, combatTouchInput, cycleTarget, quickCommand, quickPotion, selectCharacter, type CombatInput } from '../services/combatInput';
import type { CombatCommand } from '../services/combatActions';

type Props = {
  enabled: boolean;
  combat: ReturnType<typeof useCombatRuntime>;
  activeCharIndex: number;
  setActiveCharIndex: Dispatch<SetStateAction<number>>;
  selectedEnemyId: string | null;
  setSelectedEnemyId: Dispatch<SetStateAction<string | null>>;
};
/** All combat UI routes share one dispatcher and authoritative runtime checks. */
export function useCombatControls({ enabled, combat, activeCharIndex, setActiveCharIndex, selectedEnemyId, setSelectedEnemyId }: Props) {
  const [combatMenu, setCombatMenu] = useState<CombatMenu>('MAIN');
  const [detailSlot, setDetailSlot] = useState<number | null>(null);
  const [potionId, setPotionId] = useState<string | null>(null);
  const [autoBasic, setAutoBasic] = useState(false);
  const [notice, setNotice] = useState<{ text: string; until: number } | null>(null);
  const tell = useCallback((text: string) => setNotice({ text, until: Date.now() + 1800 }), []);
  const runtime = combat.runtimeRef.current;
  const character = runtime?.player.party[activeCharIndex];
  useEffect(() => {
    combat.runtimeRef.current?.setControl(character?.id ?? '', selectedEnemyId, autoBasic);
    combat.setSlowdown(combatMenu !== 'MAIN' || detailSlot !== null);
  }, [character?.id, selectedEnemyId, autoBasic, combatMenu, detailSlot, combat.setSlowdown, combat.runtimeRef]);
  const reset = useCallback(() => {
    setCombatMenu('MAIN'); setDetailSlot(null); setPotionId(null); setAutoBasic(false); setNotice(null);
  }, []);
  const select = useCallback((index: number, cycle = false) => {
    const rt = combat.runtimeRef.current;
    if (!enabled || !rt) return;
    const next = selectCharacter(rt.player.party, index, cycle);
    if (next === null) { tell('That character is defeated.'); return; }
    // Character change cancels the previous active character's manual buffer.
    combat.cancelQueued(rt.player.party[activeCharIndex]?.id);
    setActiveCharIndex(next); setDetailSlot(null); setCombatMenu('MAIN');
    rt.setControl(rt.player.party[next].id, selectedEnemyId, autoBasic);
  }, [enabled, combat.runtimeRef, activeCharIndex, selectedEnemyId, autoBasic, setActiveCharIndex, tell, combat.cancelQueued]);
  const submit = useCallback((command: CombatCommand, buffer = false) => {
    const rt = combat.runtimeRef.current;
    if (!enabled || !rt || rt.outcome) return;
    if (!rt.isReady(command.actorId)) {
      if (buffer && combat.queueSkill(command)) { tell('Skill buffered · Esc / right-click cancels'); setCombatMenu('MAIN'); setDetailSlot(null); }
      else tell(`Recovering · ${((rt.actors[command.actorId]?.remainingMs ?? 0) / 1000).toFixed(1)}s`);
      return;
    }
    const update = combat.act(command);
    if (update && !update.changed) tell(update.logs[0] ?? 'Action unavailable.');
    setCombatMenu('MAIN'); setDetailSlot(null);
  }, [enabled, combat.act, combat.queueSkill, combat.runtimeRef, tell]);
  const cancel = useCallback(() => {
    const rt = combat.runtimeRef.current;
    const queued = Boolean(rt?.actors[rt.player.party[activeCharIndex]?.id]?.queued);
    if (queued) { combat.cancelQueued(rt?.player.party[activeCharIndex]?.id); tell('Buffered skill cancelled.'); }
    const panel = combatMenu !== 'MAIN' || detailSlot !== null;
    if (panel) { setCombatMenu('MAIN'); setDetailSlot(null); }
    return queued || panel;
  }, [combat.runtimeRef, combat.cancelQueued, activeCharIndex, combatMenu, detailSlot, tell]);
  const input = useCallback((action: CombatInput): boolean => {
    const rt = combat.runtimeRef.current;
    if (!enabled || !rt) return false;
    if (action.type === 'cancel') return cancel();
    if (action.type === 'pause') { combat.togglePause(); return true; }
    if (action.type === 'character') { select(action.index); return true; }
    if (action.type === 'characterCycle') { select(activeCharIndex, true); return true; }
    if (action.type === 'targetCycle') {
      const target = cycleTarget(rt.enemies, selectedEnemyId, action.direction);
      setSelectedEnemyId(target); rt.setControl(rt.player.party[activeCharIndex]?.id ?? '', target, autoBasic); return true;
    }
    if (action.type === 'auto') { setAutoBasic(value => !value); rt.setControl(rt.player.party[activeCharIndex]?.id ?? '', selectedEnemyId, !autoBasic); return true; }
    const command = quickCommand(rt.player.party[activeCharIndex], selectedEnemyId, action, rt.player.inventory, potionId);
    if (command) submit(command, action.type === 'quickSkill');
    else tell(action.type === 'item' ? 'Quick potion slot is empty · choose a potion in Items.' : 'No skill in this slot.');
    return true;
  }, [enabled, combat.runtimeRef, combat.togglePause, cancel, select, activeCharIndex, selectedEnemyId, autoBasic, potionId, submit, setSelectedEnemyId, tell]);
  const key = (code: string, shift = false) => { const action = combatKeyInput(code, shift); return action ? input(action) : false; };
  const touch = (action: string) => { const mapped = combatTouchInput(action); if (mapped) input(mapped); };
  const basicAttack = (targetId?: string) => {
    const rt = combat.runtimeRef.current;
    const hero = rt?.player.party[activeCharIndex];
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
    else if (character) submit({ type, id, actorId: character.id, targetId: selectedEnemyId }, true);
  };
  return { potionChoices: runtime?.player.inventory.filter(i => i.type === 'POTION' && i.quantity > 0 && (i.id.includes('hp') || i.id.includes('mp'))) ?? [], combatMenu, setCombatMenu, detailSlot, setDetailSlot, autoBasic, notice, potion: runtime ? quickPotion(runtime.player.inventory, potionId) : undefined, character, reset, select, key, touch, input, cancel, basicAttack, action, subAction };
}
export type CombatControls = ReturnType<typeof useCombatControls>;
