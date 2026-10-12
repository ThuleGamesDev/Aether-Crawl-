import React from 'react';
import type { RoomDecision } from '../services/dungeonGameplay';
export default function DungeonDecision({ decision, onChoose, onClose }: { decision: RoomDecision; onChoose: (id: string) => void; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={decision.title}>
    <div className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-xl border border-amber-200/30 bg-slate-950 p-4 text-white shadow-xl">
      <div className="mb-2 flex items-center justify-between"><h2 className="font-bold text-amber-200">{decision.title}</h2><button className="min-h-11 min-w-11" onClick={onClose} aria-label="Leave this choice">✕</button></div>
      <p className="mb-3 text-xs leading-relaxed text-white/70">{decision.description}</p>
      <div className="space-y-2 overflow-y-auto">{decision.options.map(option => <button key={option.id} disabled={!option.enabled} onClick={() => onChoose(option.id)} className="min-h-14 w-full rounded-lg border border-white/20 bg-slate-900 p-3 text-left disabled:opacity-40 hover:border-amber-200/60"><b className="block text-sm text-amber-100">{option.label}</b><span className="mt-1 block text-xs text-white/65">{option.detail}</span></button>)}</div>
      <button className="mt-3 min-h-11 rounded border border-white/15 text-xs text-white/70" onClick={onClose}>LEAVE · decide later</button>
    </div>
  </div>;
}
