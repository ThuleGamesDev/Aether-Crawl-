import React, { useEffect, useRef, useState } from 'react';
import type { CombatControls } from '../hooks/useCombatControls';
import { playerRecoveryMs } from '../data/combatTiming';
import { QUICK_SKILL_KEYS, skillEffectSummary } from '../services/combatInput';
import type { Skill } from '../types';

const button = 'min-h-12 min-w-11 rounded-lg border border-white/20 bg-slate-900/95 px-1 text-[10px] font-bold text-white touch-manipulation hover:bg-slate-700 disabled:opacity-35';
function SkillButton({ skill, slot, control }: { skill: Skill; slot: number; control: CombatControls }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPress = useRef(false);
  const [hover, setHover] = useState(false);
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => () => clear(), []);
  const hero = control.character!;
  return <div className="relative min-w-0">
    <button className={button + ' h-full w-full overflow-hidden'} aria-label={`${QUICK_SKILL_KEYS[slot]} · ${skill.name}`} onPointerEnter={event => { if (event.pointerType === 'mouse') setHover(true); }} onPointerLeave={() => setHover(false)}
      onPointerDown={event => { longPress.current = false; if (event.pointerType !== 'mouse') { event.currentTarget.setPointerCapture(event.pointerId); timer.current = setTimeout(() => { longPress.current = true; control.setDetailSlot(slot); }, 450); } }}
      onPointerUp={clear} onPointerCancel={() => { clear(); longPress.current = true; }} onLostPointerCapture={clear}
      onContextMenu={event => { event.preventDefault(); control.setDetailSlot(slot); }}
      onClick={() => { clear(); if (!longPress.current) control.input({ type: 'quickSkill', slot }); longPress.current = false; }}>
      <span className="block truncate text-amber-200">{QUICK_SKILL_KEYS[slot]} · {skill.name}</span><span className="text-blue-200">{skill.id === 'soul_pact' ? '20 HP' : skill.id === 'sacrifice' ? '15 HP' : `${skill.cost} MP`}</span>
    </button>
    {hover && <div role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-52 -translate-x-1/2 rounded-lg border border-amber-200/30 bg-slate-950 p-3 text-xs text-white shadow-xl lg:block">
      <b>{skill.name}</b><p>{skillEffectSummary(hero, skill)}</p><p>{skill.id === 'soul_pact' ? '20 HP' : skill.id === 'sacrifice' ? '15 HP' : `${skill.cost} MP`} · {(playerRecoveryMs(hero, 'skill', skill) / 1000).toFixed(1)}s recovery · instant</p>
    </div>}
  </div>;
}
export default function Controls({ control, ready, paused, remainingMs }: { control: CombatControls; ready: boolean; paused: boolean; remainingMs: number }) {
  const hero = control.character;
  const [more, setMore] = useState(false);
  const skills = hero?.skills.slice(0, 4) ?? [];
  const detail = control.detailSlot === null ? undefined : skills[control.detailSlot];
  useEffect(() => { if (control.combatMenu === 'MAIN') setMore(false); }, [control.combatMenu]);
  return <div className="combat-controls relative w-full">
    <div className="mb-1 flex items-center justify-between text-[10px] text-amber-100">
      <span>{hero?.name} · {ready ? 'READY' : `${(remainingMs / 1000).toFixed(1)}s`}</span>
      <button className="min-h-11 rounded px-3 text-white/75" onClick={() => { setMore(value => !value); control.setCombatMenu(more ? 'MAIN' : 'SKILLS'); }}>MORE {control.autoBasic ? '· AUTO' : '· MANUAL'}</button>
    </div>
    <div className="grid grid-cols-5 gap-1">
      <button className={button + ' bg-red-900 text-xs'} aria-label="Attack" onClick={() => control.input({ type: 'attack' })}>ATTACK<span className="block text-[9px] text-red-200">LMB</span></button>
      {Array.from({ length: 4 }, (_, slot) => skills[slot] ? <SkillButton key={skills[slot].id} skill={skills[slot]} slot={slot} control={control} /> : <button key={slot} className={button} disabled>{QUICK_SKILL_KEYS[slot]} · —</button>)}
    </div>
    <div className="mt-1 grid grid-cols-5 gap-1">
      <button className={button + ' bg-blue-950'} onClick={() => control.input({ type: 'defend' })}>GUARD · V</button>
      <button className={button} aria-label={`Quick potion · ${control.potion?.name ?? 'empty'}`} onClick={() => control.input({ type: 'item' })}>POTION · G<span className="block text-[9px] text-emerald-200">{control.potion ? `${control.potion.id.includes('hp') ? 'HP' : 'MP'} ×${control.potion.quantity}` : 'EMPTY'}</span></button>
      <button className={button} onClick={() => control.input({ type: 'targetCycle', direction: 1 })}>TARGET<span className="block text-[9px] text-white/50">TAB</span></button>
      <button className={button} onClick={() => control.input({ type: 'characterCycle' })}>PARTY<span className="block text-[9px] text-white/50">1–4</span></button>
      <button className={button + (paused ? ' bg-amber-800' : '')} aria-pressed={paused} onClick={() => control.input({ type: 'pause' })}>{paused ? 'RESUME' : 'PAUSE'}<span className="block text-[9px] text-white/50">SPACE</span></button>
    </div>
    {(more || control.combatMenu !== 'MAIN' || detail) && <div className="absolute bottom-full left-0 z-40 mb-1 flex max-h-[42dvh] w-full flex-col overflow-y-auto rounded-xl border border-amber-200/30 bg-slate-950/95 p-3 text-xs text-white shadow-xl">
      <div className="mb-2 flex items-center justify-between text-amber-200"><span>TACTICAL · 20% SPEED</span><button className={button} onClick={() => { setMore(false); control.cancel(); }}>CLOSE</button></div>
      {detail && hero ? <><b>{detail.name}</b><p className="my-2">{skillEffectSummary(hero, detail)}</p><p>{detail.id === 'soul_pact' ? '20 HP' : detail.id === 'sacrifice' ? '15 HP' : `${detail.cost} MP`} · {(playerRecoveryMs(hero, 'skill', detail) / 1000).toFixed(1)}s recovery · instant</p><button className={button + ' mt-2'} onClick={() => control.input({ type: 'quickSkill', slot: control.detailSlot! })}>USE {detail.name}</button></> : <>
        <div className="mb-2 grid grid-cols-3 gap-1"><button className={button} onClick={() => control.setCombatMenu('SKILLS')}>ALL SKILLS</button><button className={button} onClick={() => control.setCombatMenu('ITEMS')}>BIND POTION</button><button className={button} onClick={() => control.action('run')}>FLEE</button></div>
        <button className={button + ' mb-2'} aria-pressed={control.autoBasic} onClick={() => control.input({ type: 'auto' })}>AUTO BASIC {control.autoBasic ? 'ON' : 'OFF'} · B</button><p className="mb-2 text-[10px] text-white/55">Inactive heroes only · no skills or items. Hold a quick skill for details. Right-click / Esc cancels a buffered skill.</p>
        {control.combatMenu === 'SKILLS' && hero?.skills.map(skill => <button key={skill.id} className={button + ' mb-1 text-left'} onClick={() => control.subAction('skill', skill.id)}>{skill.name} · {skill.id === 'soul_pact' ? '20 HP' : skill.id === 'sacrifice' ? '15 HP' : `${skill.cost} MP`} · {(playerRecoveryMs(hero, 'skill', skill) / 1000).toFixed(1)}s</button>)}
        {control.combatMenu === 'ITEMS' && control.character && <PotionChoices control={control} />}
      </>}
    </div>}
  </div>;
}
function PotionChoices({ control }: { control: CombatControls }) {
  return <>{control.potionChoices.map(item => <button key={item.id} className={button + ' mb-1 text-left'} onClick={() => control.subAction('item', item.id)}>Bind {item.name} ×{item.quantity}</button>)}{!control.potionChoices.length && <p>No usable potions.</p>}</>;
}
