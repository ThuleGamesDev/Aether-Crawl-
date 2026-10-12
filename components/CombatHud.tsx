import React from 'react';
import type { useCombatRuntime } from '../hooks/useCombatRuntime';
import type { CombatControls } from '../hooks/useCombatControls';
import Controls from './Controls';

export default function CombatHud({ combat, control, activeCharIndex, selectedEnemyId }: { combat: ReturnType<typeof useCombatRuntime>; control: CombatControls; activeCharIndex: number; selectedEnemyId: string | null }) {
  const rt = combat.runtimeRef.current;
  const snapshot = combat.snapshot;
  if (!rt || !snapshot) return null;
  const target = rt.enemies.find(e => e.id === selectedEnemyId && e.hp > 0);
  const cast = target ? snapshot.actors[target.id]?.casting : undefined;
  const actor = control.character ? snapshot.actors[control.character.id] : undefined;
  return <div className="pointer-events-none absolute inset-0 z-30">
    {target && <div className={'combat-target absolute left-1/2 top-14 w-[min(420px,85vw)] -translate-x-1/2 rounded-lg border bg-black/80 p-2 text-center text-xs text-white lg:top-3 ' + (cast?.intent.type === 'HEAVY_ATTACK' ? 'border-red-400/70' : 'border-amber-200/30')}>
      <b className="text-amber-200">◎ {target.name}{target.phase === 2 ? ' · PHASE II' : ''}</b><span className="ml-2 text-[10px]">{target.hp}/{target.maxHp} HP</span>
      {target.intent && <p className="mt-1">{target.intent.icon} <b>{target.intent.type.replace('_', ' ')}</b> · {target.intent.label} {cast ? `${(cast.remainingMs / 1000).toFixed(1)}s` : '· preparing'}</p>}
      {cast && <><div className="mt-1 h-1 rounded bg-white/15"><div className="h-full bg-orange-400" style={{ width: `${100 * (1 - cast.remainingMs / Math.max(1, cast.totalMs))}%` }} /></div><p className="mt-1 text-[9px] text-amber-100">{cast.interruptible ? `STUN INTERRUPTS${target.isBoss ? ` · resistance ${Math.round((cast.intent.interruptResistance ?? 0.5) * 100)}%` : ''}` : '🔒 UNINTERRUPTIBLE'}</p></>}
    </div>}
    <div className="combat-dock pointer-events-auto absolute bottom-2 left-1/2 w-[min(760px,96vw)] -translate-x-1/2 rounded-xl border border-white/20 bg-black/75 p-2 shadow-lg backdrop-blur-sm">
      <div className="combat-party-strip mb-1 flex gap-1">
        {rt.player.party.map((hero, index) => {
          const a = snapshot.actors[hero.id];
          const active = activeCharIndex === index;
          return <button key={hero.id} aria-label={`Select ${hero.name}`} aria-pressed={active} disabled={hero.stats.hp <= 0} onClick={() => control.select(index)} className={'combat-party min-h-12 min-w-0 flex-1 rounded border px-2 py-1 text-left text-[10px] text-white disabled:opacity-40 ' + (active ? 'border-amber-200 bg-amber-900/50' : 'border-white/15 bg-slate-950/70')}>
            <span className="block truncate font-bold">{index + 1} · {hero.name} {active ? '◀' : ''}</span>
            <span className="block truncate text-[8px]">HP {hero.stats.hp}/{hero.stats.maxHp} · MP {hero.stats.mp}/{hero.stats.maxMp}</span>
            <span className="block truncate text-[9px] text-amber-200">{hero.stats.hp <= 0 ? 'DEFEATED' : a?.queued ? 'BUFFERED' : a?.ready ? 'READY' : `${((a?.remainingMs ?? 0) / 1000).toFixed(1)}s`}{a && a.guardUntil > snapshot.clock.elapsedMs ? ' · 🛡 GUARD' : ''} {hero.statusEffects.map(e => e.icon).join('')}</span>
            <div className="mt-1 h-1 overflow-hidden rounded bg-white/15"><div className="h-full bg-amber-300" style={{ width: `${a ? a.ready ? 100 : 100 * (1 - a.remainingMs / Math.max(1, a.recoveryMs)) : 0}%` }} /></div>
          </button>;
        })}
      </div>
      <Controls control={control} ready={actor?.ready ?? false} remainingMs={actor?.remainingMs ?? 0} paused={snapshot.clock.paused} />
      <div className="combat-notice mt-1 truncate text-center text-[10px] text-amber-200" role="status" aria-live="polite">{control.notice && control.notice.until > Date.now() ? control.notice.text : snapshot.clock.paused ? 'TACTICAL PAUSE' : snapshot.clock.timeScale === 0.2 ? 'TACTICAL SLOWDOWN · 20%' : actor?.queued ? 'SKILL BUFFERED · Esc cancels' : 'Quick skills Q E R F · no automatic character switch'}</div>
    </div>
  </div>;
}
