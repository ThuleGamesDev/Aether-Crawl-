import React from 'react';
import { getAbility } from '../combat/AbilityRegistry';
import { getClassSkillKit } from '../data/classSkillKits';
import { getRankedAbility, type SkillUpgradeOption } from '../player/SkillProgression';
import { calculateDerivedStats } from '../player/DerivedStats';
import type { PlayerCharacter } from '../types';
import ActionGlyph, { actionGlyphForSkill } from './ActionGlyph';

interface SkillUpgradeScreenProps {
  player: PlayerCharacter;
  options: SkillUpgradeOption[];
  onChoose: (abilityId: string) => void;
  onLater: () => void;
}

const SkillUpgradeScreen: React.FC<SkillUpgradeScreenProps> = ({ player, options, onChoose, onLater }) => {
  const kit = getClassSkillKit(player.classId);
  const points = player.skillPoints ?? 0;
  const derived = calculateDerivedStats(player);
  return <section className="fps-skill-upgrade" aria-label="Class skill upgrade choices">
    <p className="fps-overlay-copy">{kit?.name ?? player.name} · {points} unspent {points === 1 ? 'point' : 'points'}. Each rank improves power or effect; skill costs and cooldowns stay the same.</p>
    {kit && <div className="fps-passive-note"><b>{kit.passive.name}</b><span>{kit.passive.description}</span></div>}
    {options.length > 0 ? <div className="fps-skill-choice-grid">
      {options.map(option => {
        const base = getAbility(option.abilityId);
        const current = option.currentRank > 0
          ? getRankedAbility({ ...player, skills: [...player.skills.filter(skill => skill.abilityId !== option.abilityId), { abilityId: option.abilityId, rank: option.currentRank }] }, option.abilityId)
          : base;
        const next = getRankedAbility({ ...player, skills: [...player.skills.filter(skill => skill.abilityId !== option.abilityId), { abilityId: option.abilityId, rank: option.nextRank }] }, option.abilityId);
        if (!base || !current || !next) return null;
        const preview = getPreview(current, next, option.action);
        return <button className="fps-skill-choice" key={option.abilityId} onClick={() => onChoose(option.abilityId)}>
          <span className="fps-skill-choice-heading"><ActionGlyph kind={actionGlyphForSkill(next)} /><span><small className="fps-skill-choice-role">{option.action === 'UNLOCK' ? 'NEW ACTIVE SKILL' : option.role.toUpperCase()}</small><strong>{option.name}</strong></span></span>
          <span className="fps-skill-choice-rank">{option.action === 'UNLOCK' ? 'Unlock · Rank 1' : `Rank ${option.currentRank} → ${option.nextRank}`}</span>
          <span className="fps-skill-choice-unlock">Level {option.unlockLevel} requirement met</span>
          <span className="fps-skill-choice-copy">{option.description}</span>
          <span className="fps-skill-choice-preview">{preview.join(' · ')}</span>
          <span className="fps-skill-choice-cost">1 skill point · {(next.manaCost * derived.manaCostMultiplier).toFixed(next.manaCost * derived.manaCostMultiplier % 1 ? 1 : 0)} MP · {(next.cooldownSeconds * derived.cooldownMultiplier).toFixed(1)}s cooldown</span>
        </button>;
      })}
    </div> : <p className="fps-skill-mastered">All four active skills have reached Rank 5. This point remains saved.</p>}
    <button className="fps-button fps-skill-later" onClick={onLater}>Choose later · keep point</button>
  </section>;
};

function getPreview(base: NonNullable<ReturnType<typeof getAbility>>, next: NonNullable<ReturnType<typeof getAbility>>, action: SkillUpgradeOption['action']): string[] {
  const lines: string[] = [];
  const change = (label: string, before: string, after: string) => lines.push(action === 'UNLOCK' ? `${label} ${after} at Rank 1` : `${label} ${before} → ${after}`);
  if (base.damage > 0) change('Damage', String(base.damage), String(next.damage));
  if ((base.radius ?? 0) > 0) change('Radius', `${(base.radius ?? 0).toFixed(1)}m`, `${(next.radius ?? 0).toFixed(1)}m`);
  if ((base.dashDistance ?? 0) > 0) change('Step', `${base.dashDistance!.toFixed(1)}m`, `${next.dashDistance!.toFixed(1)}m`);
  if (base.selfEffect?.type === 'GUARD' && next.selfEffect?.type === 'GUARD') change('Guard', `${Math.round((base.selfEffect.magnitude ?? 0) * 100)}%`, `${Math.round((next.selfEffect.magnitude ?? 0) * 100)}%`);
  if (base.selfStatuses?.length && next.selfStatuses?.length) {
    change(base.selfStatuses[0].statusId.toLowerCase(), `${Math.round(base.selfStatuses[0].magnitude * 100)}%`, `${Math.round(next.selfStatuses[0].magnitude * 100)}%`);
  }
  if (base.onHitStatus && next.onHitStatus) change(base.onHitStatus.statusId.toLowerCase(), `${Math.round(base.onHitStatus.magnitude)}`, `${Math.round(next.onHitStatus.magnitude)}`);
  return lines.slice(0, 2).length ? lines.slice(0, 2) : ['Effect strength improves'];
}

export default SkillUpgradeScreen;
