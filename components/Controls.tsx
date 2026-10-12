import React from 'react';
import type { Character, CombatMenu, GamePhase, Item } from '../types';
import { playerRecoveryMs } from '../data/combatTiming';

export interface ControlsProps {
  phase: GamePhase;
  combatMenu: CombatMenu;
  activeCharacter: Character | null;
  inventory: Item[];
  actionReady: boolean;
  paused: boolean;
  onAction: (action: string) => void;
  onSubAction: (type: 'skill' | 'item', id: string) => void;
  onBack: () => void;
  onPause: () => void;
  onCharacters: () => void;
}

/** Shared compact quickbar for mouse and touch; selection panels slow the clock. */
const Controls: React.FC<ControlsProps> = ({ phase, combatMenu, activeCharacter, inventory, actionReady, paused, onAction, onSubAction, onBack, onPause, onCharacters }) => {
  if (phase !== 'COMBAT') return null;
  const button = 'min-h-12 min-w-11 rounded-lg border border-white/20 bg-slate-900/90 px-2 text-[10px] font-bold text-white touch-manipulation disabled:opacity-40 hover:bg-slate-700';
  return <div className="relative w-full">
    <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-amber-100">
      <span>{activeCharacter?.name ?? 'Party'} · {actionReady ? 'READY' : 'RECOVERING'}</span>
      <span>{paused ? 'PAUSED' : combatMenu !== 'MAIN' ? '20% SPEED' : 'SPACE · PAUSE'}</span>
    </div>
    {combatMenu !== 'MAIN' && <div className="absolute bottom-full left-0 mb-3 flex max-h-[42dvh] w-full flex-col rounded-xl border border-white/25 bg-slate-950/95 p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between text-xs text-amber-200"><span>{combatMenu === 'SKILLS' ? 'Skills' : 'Potions'} · 20% speed</span><button className={button} onClick={onBack}>BACK</button></div>
      <div className="space-y-1 overflow-y-auto">
        {combatMenu === 'SKILLS' && activeCharacter?.skills.map(skill => <button key={skill.id} className={button + ' flex w-full items-center justify-between gap-2 text-left'} disabled={!actionReady || (skill.id !== 'soul_pact' && activeCharacter.stats.mp < skill.cost)} onClick={() => onSubAction('skill', skill.id)}>
          <span>{skill.name}</span><span className="shrink-0 text-blue-200">{skill.cost} MP · {(playerRecoveryMs(activeCharacter, 'skill', skill) / 1000).toFixed(1)}s</span>
        </button>)}
        {combatMenu === 'SKILLS' && !activeCharacter?.skills.length && <p className="py-3 text-xs text-white/60">No learned skills.</p>}
        {combatMenu === 'ITEMS' && inventory.filter(item => item.type === 'POTION').map(item => <button key={item.id} className={button + ' flex w-full items-center justify-between text-left'} disabled={!actionReady} onClick={() => onSubAction('item', item.id)}><span>{item.icon} {item.name}</span><span>x{item.quantity}</span></button>)}
        {combatMenu === 'ITEMS' && !inventory.some(item => item.type === 'POTION') && <p className="py-3 text-xs text-white/60">No usable potions.</p>}
      </div>
    </div>}
    <div className="grid grid-cols-4 gap-1 sm:grid-cols-7">
      <button className={button + ' bg-red-900/90'} disabled={!actionReady} onClick={() => onAction('attack')}>ATTACK</button>
      <button className={button + ' bg-blue-900/90'} disabled={!actionReady} onClick={() => onAction('defend')}>DEFEND</button>
      <button className={button} onClick={() => onAction('skill')}>SKILL</button>
      <button className={button} onClick={() => onAction('item')}>ITEM</button>
      <button className={button} onClick={onCharacters}>PARTY</button>
      <button className={button + (paused ? ' bg-amber-700/90' : '')} aria-pressed={paused} onClick={onPause}>{paused ? 'RESUME' : 'PAUSE'}</button>
      <button className={button} disabled={!actionReady} onClick={() => onAction('run')}>FLEE</button>
    </div>
  </div>;
};
export default Controls;
