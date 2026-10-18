import { characterInitiative, enemyInitiative } from '../services/initiative';
import React, { useEffect, useRef } from 'react';
import type { useCombatRuntime } from '../hooks/useCombatRuntime';
import type { CombatControls } from '../hooks/useCombatControls';
import Controls from './Controls';

export default function CombatHud({ combat, control, selectedEnemyId }: { combat: ReturnType<typeof useCombatRuntime>; control: CombatControls; activeCharIndex: number; selectedEnemyId: string | null }) {
  const rt = combat.runtimeRef.current, snapshot = combat.snapshot;
  const orderRef = useRef<HTMLOListElement>(null);
  useEffect(() => { if (orderRef.current) orderRef.current.scrollLeft = 0; }, [snapshot?.turnId, snapshot?.round]);
  if (!rt || !snapshot) return null;
  const target = rt.enemies.find(e => e.id === selectedEnemyId && e.hp > 0);
  const current = rt.player.party.find(c => c.id === snapshot.turnId) ?? rt.enemies.find(e => e.id === snapshot.turnId);
  const ready = control.character ? rt.isReady(control.character.id) : false;
  const interruptible = target?.intent?.interruptible === true || !target?.isBoss && target?.intent?.interruptible !== false;
  const name = (id: string) => rt.player.party.find(c => c.id === id)?.name ?? rt.enemies.find(e => e.id === id)?.name ?? id;
  return <div className="pointer-events-none absolute inset-0 z-30">
    {target && <div className={'combat-target absolute left-1/2 top-14 w-[min(420px,85vw)] -translate-x-1/2 rounded-lg border bg-black/85 p-2 text-center text-xs text-white lg:top-3 ' + (target.intent?.type === 'HEAVY_ATTACK' ? 'border-red-400/70' : 'border-amber-200/30')}>
      <b className="text-amber-200">◎ {target.name}{target.phase === 2 ? ' · PHASE II' : ''}</b><span className="ml-2 text-[10px]">{target.hp}/{target.maxHp} HP · INIT {enemyInitiative(target)}</span>
      {target.intent && <p className="mt-1">{target.intent.icon} <b>{target.intent.type.replace('_', ' ')}</b> · {target.intent.label} · next turn</p>}
      <p className="mt-1 text-[9px] text-amber-100">{interruptible ? `STUN CANCELS NEXT ACTION${target.isBoss ? ` · resistance ${Math.round((target.intent?.interruptResistance ?? 0.5) * 100)}%` : ''}` : '🔒 CANNOT BE INTERRUPTED'}</p>
    </div>}
    <div className="combat-dock pointer-events-auto absolute bottom-2 left-1/2 w-[min(760px,96vw)] -translate-x-1/2 rounded-xl border border-white/20 bg-black/85 p-2 shadow-lg backdrop-blur-sm">
      <p className="combat-round mb-1 text-xs text-amber-100" role="status" aria-live="polite">ROUND {snapshot.round} · {current?.name} {ready ? '— YOUR TURN' : '— ENEMY TURN'}</p>
      <ol ref={orderRef} aria-label="Turn order" className="combat-order mb-2 flex gap-1 overflow-x-auto text-[10px] text-white/80">{snapshot.order.map((id, index) => <li key={id} aria-current={index === 0 ? 'step' : undefined} className={'shrink-0 rounded border px-2 py-1 ' + (index === 0 ? 'border-amber-300 bg-amber-900/70 text-amber-100' : 'border-white/15')}>{index + 1}. {name(id)} · {snapshot.actors[id]?.initiative}</li>)}</ol>
      <div className="combat-party-strip mb-1 flex gap-1">
        {rt.player.party.map((hero, index) => {
          const actor = snapshot.actors[hero.id], active = snapshot.turnId === hero.id;
          return <button key={hero.id} aria-label={`Select ${hero.name}`} aria-pressed={active} disabled={!active} onClick={() => control.select(index)} className={'combat-party min-h-12 min-w-0 flex-1 rounded border px-2 py-1 text-left text-[10px] text-white ' + (active ? 'border-amber-200 bg-amber-900/50' : 'border-white/15 bg-slate-950/70')}>
            <span className="block truncate font-bold">{hero.name} {active ? '◀' : ''}</span><span className="block text-[9px] text-amber-100">INIT {characterInitiative(hero)}</span>
            <span className="block text-[9px]">HP {hero.stats.hp}/{hero.stats.maxHp}</span><span className="block text-[9px] text-blue-200">MP {hero.stats.mp}/{hero.stats.maxMp}</span>
            <span className="block truncate text-[9px] text-amber-200">{hero.stats.hp <= 0 ? 'DEFEATED' : active ? 'YOUR TURN' : actor?.eligibleRound > snapshot.round ? 'NEXT ROUND' : actor?.actedRound === snapshot.round ? 'ACTED' : 'WAITING'}{hero.isDefending ? ' · GUARD' : ''} {hero.statusEffects.map(e => e.icon).join('')}</span>
          </button>;
        })}
      </div>
      <Controls control={control} ready={ready} />
      <div className="combat-notice mt-1 truncate text-center text-[10px] text-amber-200">{control.notice && control.notice.until > Date.now() ? control.notice.text : ready ? 'Take your time · one action ends this turn' : 'Enemies act one at a time'}</div>
    </div>
  </div>;
}
