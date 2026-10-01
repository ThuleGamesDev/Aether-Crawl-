import { enemyAbilities, type EnemyAbilityDefinition } from '../data/enemyAbilities';
import { createEnemyById } from './gameLogic';
import { calculateEnemyAttack, createStatusEffect, estimateEnemyDamageRange, resolveStatusTurn, upsertStatusEffect } from './combat';
import type { Character, Enemy, EnemyIntent, StatusEffect, StatusType, VFXType } from '../types';

export const MAX_COMBAT_ENEMIES = 5;

export interface EnemyVfxRequest {
  type: VFXType;
  targetId: string;
}

export interface EnemyActionResolution {
  enemies: Enemy[];
  party: Character[];
  scrap: number;
  logs: string[];
  vfx: EnemyVfxRequest[];
  acted: boolean;
  defeated: boolean;
  stunned: boolean;
}

const statusLabel: Record<StatusType, string> = {
  POISON: 'poison', BURN: 'burn', REGEN: 'regeneration', SHIELD: 'guard', STRENGTH: 'strength', WEAKNESS: 'weakness', STUN: 'stun',
};

const flagsOf = (enemy: Enemy): string[] => enemy.combatFlags ?? [];
const withFlags = (enemy: Enemy, consume?: string, add?: string): Enemy => {
  const flags = flagsOf(enemy).filter(flag => flag !== consume);
  if (add && !flags.includes(add)) flags.push(add);
  return { ...enemy, combatFlags: flags };
};

const satisfiesCondition = (ability: EnemyAbilityDefinition, enemy: Enemy, enemies: Enemy[], scrap: number): boolean => {
  const ratio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0;
  if (ability.minHpRatio !== undefined && ratio < ability.minHpRatio) return false;
  if (ability.maxHpRatio !== undefined && ratio > ability.maxHpRatio) return false;
  if (ability.minPhase !== undefined && (enemy.phase ?? 1) < ability.minPhase) return false;
  if (ability.maxPhase !== undefined && (enemy.phase ?? 1) > ability.maxPhase) return false;
  if (ability.requiredFlag && !flagsOf(enemy).includes(ability.requiredFlag)) return false;
  if (ability.forbiddenFlag && flagsOf(enemy).includes(ability.forbiddenFlag)) return false;
  if (ability.requiresSummon && !enemies.some(candidate => candidate.hp > 0 && candidate.summonedBy === enemy.id)) return false;
  if (ability.requiresScrap && scrap <= 0) return false;
  if (ability.requiresCanSplit && enemy.canSplit !== true) return false;
  return true;
};

const buildIntent = (enemy: Enemy, ability: EnemyAbilityDefinition): EnemyIntent => {
  const damageMultiplier = ability.damageMultiplier ?? (ability.effect.kind === 'damage' ? ability.effect.multiplier : undefined);
  const damage = damageMultiplier === undefined || ability.intentType !== 'ATTACK'
    ? {}
    : estimateEnemyDamageRange(enemy, damageMultiplier);
  return {
    type: ability.intentType,
    label: ability.name,
    shortLabel: ability.shortName,
    icon: ability.icon,
    description: ability.description,
    abilityId: ability.id,
    interruptible: ability.interruptible,
    ...damage,
  };
};

const chooseWeighted = <T extends { weight: number }>(items: T[], random: () => number): T => {
  const totalWeight = items.reduce((total, item) => total + Math.max(0, item.weight), 0);
  let roll = random() * totalWeight;
  for (const item of items) {
    roll -= Math.max(0, item.weight);
    if (roll < 0) return item;
  }
  return items[items.length - 1];
};

/** Makes the intent part of enemy state before the next player phase begins. */
export const planEnemyIntent = (enemy: Enemy, enemies: Enemy[], scrap: number, random: () => number = Math.random): Enemy => {
  if (enemy.hp <= 0) return enemy;
  const abilityCooldowns = { ...(enemy.abilityCooldowns ?? {}) };
  const abilityIds = enemy.abilityIds?.length ? enemy.abilityIds : ['basic_attack'];
  const available = abilityIds
    .map(id => enemyAbilities[id])
    .filter((ability): ability is EnemyAbilityDefinition => Boolean(ability))
    .filter(ability => (abilityCooldowns[ability.id] ?? 0) <= 0 && satisfiesCondition(ability, enemy, enemies, scrap));

  // A prepared follow-up is deterministic; it cannot be replaced by a random attack.
  const forced = available.filter(ability => ability.requiredFlag && flagsOf(enemy).includes(ability.requiredFlag));
  const followUps = available.filter(ability => ability.afterAbilityId === enemy.previousAbilityId);
  const nonRepeating = available.filter(ability => ability.id !== enemy.previousAbilityId);
  const candidates = forced.length ? forced : followUps.length ? followUps : nonRepeating.length ? nonRepeating : available;
  const selected = candidates.length ? chooseWeighted(candidates, random) : enemyAbilities.basic_attack;
  const intent = buildIntent(enemy, selected);
  return { ...enemy, abilityCooldowns, intent };
};

export const planEnemyIntents = (enemies: Enemy[], scrap: number, random: () => number = Math.random): Enemy[] => {
  const living = enemies.filter(enemy => enemy.hp > 0);
  return enemies.map(enemy => enemy.hp > 0 ? planEnemyIntent(enemy, living, scrap, random) : enemy);
};

export const activateEnemyPhases = (enemies: Enemy[]): { enemies: Enemy[]; logs: string[] } => {
  const logs: string[] = [];
  const updated = enemies.map(enemy => {
    if (enemy.definitionId !== 'the_necromancer' || enemy.hp <= 0 || (enemy.phase ?? 1) >= 2 || enemy.hp / enemy.maxHp > 0.6) return enemy;
    logs.push(`${enemy.name} enters Phase II. Mass Raise is now possible.`);
    return withFlags({ ...enemy, phase: 2 }, undefined, 'necromancer_mass_due');
  });
  return { enemies: updated, logs };
};

export const settleDefeatedEnemyTheft = (enemies: Enemy[]): { enemies: Enemy[]; refundedScrap: number; logs: string[] } => {
  let refundedScrap = 0;
  const logs: string[] = [];
  const updated = enemies.map(enemy => {
    if (enemy.hp > 0 || (enemy.stolenScrap ?? 0) <= 0) return enemy;
    refundedScrap += enemy.stolenScrap ?? 0;
    logs.push(`${enemy.name} drops ${enemy.stolenScrap} stolen scrap.`);
    return { ...enemy, stolenScrap: 0 };
  });
  return { enemies: updated, refundedScrap, logs };
};

const applyEffect = (effects: StatusEffect[] = [], type: StatusType, duration: number, value: number): StatusEffect[] =>
  upsertStatusEffect(effects, createStatusEffect(type, duration, value));

const getLivingPartyIndexes = (party: Character[]): number[] => party
  .map((character, index) => character.stats.hp > 0 ? index : -1)
  .filter(index => index >= 0);

const applyDamageToParty = (party: Character[], index: number, damage: number): Character[] => party.map((character, characterIndex) =>
  characterIndex === index
    ? { ...character, stats: { ...character.stats, hp: Math.max(0, character.stats.hp - damage) } }
    : character);

/** Resolves the exact ability referenced by the intent. It never rolls a replacement action. */
export const resolveEnemyIntent = (
  enemyId: string,
  initialEnemies: Enemy[],
  initialParty: Character[],
  initialScrap: number,
  random: () => number = Math.random,
  maxEnemies = MAX_COMBAT_ENEMIES,
): EnemyActionResolution => {
  let enemies = [...initialEnemies];
  let party = [...initialParty];
  let scrap = initialScrap;
  const logs: string[] = [];
  const vfx: EnemyVfxRequest[] = [];
  let acted = false;
  let wasStunned = false;
  let actor = enemies.find(enemy => enemy.id === enemyId);
  if (!actor || actor.hp <= 0) {
    return { enemies, party, scrap, logs, vfx, acted, defeated: true, stunned: false };
  }

  // Status duration is consumed at the acting enemy's turn, but STUN is checked before expiry.
  const hadStun = actor.statusEffects?.some(effect => effect.type === 'STUN') ?? false;
  const statusTurn = resolveStatusTurn(actor.hp, actor.maxHp, actor.statusEffects);
  statusTurn.ticks.forEach(tick => {
    logs.push(`${actor!.name} ${tick.type === 'REGEN' ? 'recovers' : 'takes'} ${tick.value} ${statusLabel[tick.type]}.`);
    vfx.push({ type: tick.type === 'POISON' ? 'POISON' : tick.type === 'BURN' ? 'FIREBALL' : 'HEAL', targetId: actor!.id });
  });
  actor = { ...actor, hp: statusTurn.hp, statusEffects: statusTurn.statusEffects };
  enemies = enemies.map(enemy => enemy.id === enemyId ? actor! : enemy);
  if (statusTurn.defeated) {
    logs.push(`${actor.name} falls to its wounds.`);
    vfx.push({ type: 'ENEMY_DEATH', targetId: actor.id });
    return { enemies, party, scrap, logs, vfx, acted, defeated: true, stunned: false };
  }

  const intent = actor.intent ?? buildIntent(actor, enemyAbilities.basic_attack);
  const ability = enemyAbilities[intent.abilityId] ?? enemyAbilities.basic_attack;
  if (hadStun && (!actor.isBoss || intent.interruptible)) {
    wasStunned = true;
    const abilityCooldowns = Object.fromEntries(Object.entries(actor.abilityCooldowns ?? {})
      .map(([id, turns]) => [id, Math.max(0, turns - 1)]));
    actor = withFlags({ ...actor, previousAbilityId: ability.id, abilityCooldowns }, ability.cancelFlagOnInterrupt);
    enemies = enemies.map(enemy => enemy.id === enemyId ? actor! : enemy);
    logs.push(`${actor.name} is stunned and loses ${ability.name}.`);
    return { enemies, party, scrap, logs, vfx, acted, defeated: false, stunned: wasStunned };
  }
  if (hadStun) logs.push(`${actor.name} resists the stun; ${ability.name} is not interruptible.`);

  const livingIndexes = getLivingPartyIndexes(party);
  const targetIndex = livingIndexes.length ? livingIndexes[Math.floor(random() * livingIndexes.length)] : -1;
  const effect = ability.effect;
  const target = targetIndex >= 0 ? party[targetIndex] : undefined;
  actor = { ...actor, previousAbilityId: ability.id };
  const cooldowns = Object.fromEntries(Object.entries(actor.abilityCooldowns ?? {})
    .map(([id, turns]) => [id, Math.max(0, turns - 1)]));
  if (ability.cooldown) cooldowns[ability.id] = ability.cooldown;
  actor.abilityCooldowns = cooldowns;
  acted = true;

  if (effect.kind === 'damage') {
    if (target && targetIndex >= 0) {
      const damage = calculateEnemyAttack(actor, target, effect.multiplier);
      party = applyDamageToParty(party, targetIndex, damage);
      logs.push(`${actor.name} uses ${ability.name} on ${target.name} for ${damage} damage.`);
      vfx.push({ type: 'DAMAGE', targetId: target.id });
      if (effect.status && random() <= (effect.status.chance ?? 1)) {
        party = party.map((character, index) => index === targetIndex
          ? { ...character, statusEffects: applyEffect(character.statusEffects, effect.status!.type, effect.status!.duration, effect.status!.value) }
          : character);
        logs.push(`${target.name} is afflicted with ${statusLabel[effect.status.type]}.`);
        vfx.push({ type: effect.status.type === 'POISON' ? 'POISON' : 'DEBUFF', targetId: target.id });
      }
    } else {
      logs.push(`${actor.name} uses ${ability.name}, but finds no target.`);
    }
  } else if (effect.kind === 'guard') {
    actor = { ...actor, guard: Math.min(30, (actor.guard ?? 0) + effect.amount) };
    enemies = enemies.map(enemy => enemy.id === enemyId ? actor! : enemy);
    logs.push(`${actor.name} raises its guard${effect.protectAlly ? ' and shields an ally' : ''}.`);
    if (effect.protectAlly) {
      const ally = enemies.filter(enemy => enemy.hp > 0 && enemy.id !== enemyId)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (ally) {
        enemies = enemies.map(enemy => enemy.id === ally.id ? { ...enemy, guard: Math.min(30, (enemy.guard ?? 0) + effect.amount) } : enemy);
        logs.push(`${ally.name} gains ${effect.amount} guard.`);
      }
    }
  } else if (effect.kind === 'buff_all') {
    actor = { ...actor, statusEffects: applyEffect(actor.statusEffects, effect.type, effect.duration, effect.value) };
    enemies = enemies.map(enemy => enemy.hp > 0
      ? { ...enemy, statusEffects: applyEffect(enemy.statusEffects, effect.type, effect.duration, effect.value) }
      : enemy);
    logs.push(`${actor.name} empowers all living enemies with ${statusLabel[effect.type]}.`);
    vfx.push({ type: 'BUFF', targetId: actor.id });
  } else if (effect.kind === 'debuff') {
    if (target && targetIndex >= 0) {
      if (effect.multiplier) {
        const damage = calculateEnemyAttack(actor, target, effect.multiplier);
        party = applyDamageToParty(party, targetIndex, damage);
        vfx.push({ type: 'DAMAGE', targetId: target.id });
        logs.push(`${actor.name} hits ${target.name} for ${damage} damage.`);
      }
      party = party.map((character, index) => index === targetIndex
        ? { ...character, statusEffects: applyEffect(character.statusEffects, effect.type, effect.duration, effect.value) }
        : character);
      logs.push(`${actor.name} applies ${statusLabel[effect.type]} to ${target.name}.`);
      vfx.push({ type: 'DEBUFF', targetId: target.id });
    }
  } else if (effect.kind === 'steal_scrap') {
    const amount = Math.min(scrap, effect.maxAmount);
    if (amount > 0) {
      scrap -= amount;
      actor = { ...actor, stolenScrap: (actor.stolenScrap ?? 0) + amount };
      enemies = enemies.map(enemy => enemy.id === enemyId ? actor! : enemy);
      logs.push(`${actor.name} steals ${amount} scrap. Defeating it will recover the scrap.`);
    } else {
      logs.push(`${actor.name} searches for scrap but finds none.`);
    }
  } else if (effect.kind === 'prepare') {
    actor = withFlags(actor, effect.consumeFlag, effect.flag);
    enemies = enemies.map(enemy => enemy.id === enemyId ? actor! : enemy);
    logs.push(`${actor.name} prepares ${ability.name}.`);
    vfx.push({ type: ability.vfxType ?? 'BUFF', targetId: actor.id });
  } else if (effect.kind === 'summon' || effect.kind === 'split') {
    const activeCount = enemies.filter(enemy => enemy.hp > 0).length;
    const availableSlots = maxEnemies - activeCount + (effect.kind === 'split' ? 1 : 0);
    const summonCount = Math.max(0, Math.min(effect.count, availableSlots));
    if (effect.consumeFlag || effect.setFlag) actor = withFlags(actor, effect.consumeFlag, effect.setFlag);
    if (effect.kind === 'split' && summonCount > 0) actor = { ...actor, hp: 0, guard: 0 };
    enemies = enemies.map(enemy => enemy.id === enemyId ? actor! : enemy);
    const summoned: Enemy[] = [];
    const levelScale = actor.definitionId === 'the_necromancer' ? Math.max(1, actor.maxHp / 400) : 1;
    for (let index = 0; index < summonCount; index += 1) {
      summoned.push(createEnemyById(effect.enemyId, effect.scale * levelScale, {
        isBoss: false,
        isSummoned: true,
        summonedBy: effect.kind === 'summon' ? actor.id : actor.summonedBy ?? actor.id,
        canSplit: false,
      }));
    }
    enemies = [...enemies, ...summoned];
    if (summonCount) {
      const resultingCount = activeCount - (effect.kind === 'split' ? 1 : 0) + summonCount;
      logs.push(`${actor.name} ${effect.kind === 'split' ? 'splits into' : 'summons'} ${summonCount} ${summoned[0]?.name ?? 'enemy'}${summonCount === 1 ? '' : 's'}${resultingCount >= maxEnemies ? ' (enemy limit reached)' : ''}.`);
      vfx.push({ type: ability.vfxType ?? 'DARK', targetId: effect.kind === 'split' ? summoned[0].id : actor.id });
    } else {
      logs.push(`${actor.name} cannot summon more; the enemy limit is reached.`);
    }
  } else if (effect.kind === 'harvest_summon') {
    const minion = enemies.find(enemy => enemy.hp > 0 && enemy.summonedBy === actor!.id);
    if (minion) {
      enemies = enemies.map(enemy => enemy.id === minion.id ? { ...enemy, hp: 0, guard: 0 } : enemy);
      const restored = Math.min(effect.heal, actor.maxHp - actor.hp);
      actor = { ...actor, hp: actor.hp + restored };
      if (effect.consumeFlag) actor = withFlags(actor, effect.consumeFlag);
      enemies = enemies.map(enemy => enemy.id === enemyId ? actor! : enemy);
      logs.push(`${actor.name} consumes ${minion.name} and restores ${restored} HP.`);
      vfx.push({ type: 'HEAL', targetId: actor.id });
    } else {
      logs.push(`${actor.name} tries to harvest a soul, but no summon remains.`);
    }
  }

  if (ability.consumeFlagOnResolve || ability.setFlagOnResolve) {
    actor = withFlags(actor, ability.consumeFlagOnResolve, ability.setFlagOnResolve);
  }
  // Ensure the actor's last-used ability and cooldown are retained if the effect modified allies.
  enemies = enemies.map(enemy => enemy.id === enemyId ? actor! : enemy);
  return { enemies, party, scrap, logs, vfx, acted, defeated: false, stunned: wasStunned };
};
