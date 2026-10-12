import React from 'react';
import type { Character } from '../types';
import type { CombatSnapshot } from '../services/combatRuntime';

const CombatPartyPicker: React.FC<{ party: Character[]; snapshot: CombatSnapshot | null; onSelect: (index: number) => void; onClose: () => void }> = ({ party, snapshot, onSelect, onClose }) => <div className="absolute bottom-40 left-1/2 z-40 w-[min(92vw,360px)] -translate-x-1/2 rounded-xl border border-amber-100/30 bg-slate-950/95 p-3 shadow-xl">
  <div className="mb-2 flex items-center justify-between text-xs text-amber-200"><span>SELECT READY CHARACTER · 20% speed</span><button onClick={onClose} aria-label="Close character selection" className="min-h-11 min-w-11">✕</button></div>
  {party.map((character, index) => {
    const actor = snapshot?.actors[character.id];
    return <button key={character.id} disabled={!actor?.ready} onClick={() => onSelect(index)} className="mb-1 flex min-h-12 w-full items-center justify-between rounded-lg border border-white/20 px-3 text-xs text-white disabled:opacity-50">
      <span>{index + 1} · {character.name}</span><span>{character.stats.hp <= 0 ? 'DEFEATED' : actor?.ready ? 'READY' : ((actor?.remainingMs ?? 0) / 1000).toFixed(1) + 's'}</span>
    </button>;
  })}
</div>;
export default CombatPartyPicker;
