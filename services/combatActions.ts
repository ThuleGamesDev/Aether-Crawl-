import type { Enemy, Player, VFXType } from '../types';
import { enemyAbilities } from '../data/enemyAbilities';
import { playerRecoveryMs } from '../data/combatTiming';
import { calculatePlayerAttack, calculateSkillPower, createStatusEffect, damageEnemies, upsertStatusEffect } from './combat';

export type CombatCommand = { actorId: string; targetId?: string | null } & (
  | { type: 'attack' | 'defend' | 'run' }
  | { type: 'skill' | 'item'; id: string }
);
export interface CombatFeedback {
  logs: string[];
  vfx: Array<{ type: VFXType; targetId?: string }>;
  sound?: 'attack' | 'defend' | 'heal';
}
export interface PlayerActionResult extends CombatFeedback {
  accepted: boolean;
  player: Player;
  enemies: Enemy[];
  recoveryMs: number;
  escaped?: boolean;
}

/** Existing combat arithmetic and skill/item rules, with atomic validation and commit. */
export const resolvePlayerCombatAction = (initialPlayer: Player, initialEnemies: Enemy[], command: CombatCommand, random: () => number = Math.random): PlayerActionResult => {
  const logs: string[] = [];
  const vfx: CombatFeedback['vfx'] = [];
  const fail = (message: string): PlayerActionResult => ({ accepted: false, player: initialPlayer, enemies: initialEnemies, recoveryMs: 0, logs: [message], vfx });
  const index = initialPlayer.party.findIndex(character => character.id === command.actorId && character.stats.hp > 0);
  if (index < 0) return fail('That character cannot act.');
  const player: Player = { ...initialPlayer, party: initialPlayer.party.map(c => ({ ...c, stats: { ...c.stats }, statusEffects: [...c.statusEffects] })), inventory: initialPlayer.inventory.map(item => ({ ...item })) };
  const character = player.party[index];
  let enemies = [...initialEnemies];
  const target = enemies.find(enemy => enemy.id === command.targetId && enemy.hp > 0) ?? enemies.find(enemy => enemy.hp > 0);
  let recoveryMs = playerRecoveryMs(character, command.type);
  let sound: CombatFeedback['sound'];
  let escaped = false;
  const status = (targetId: string, type: Parameters<typeof createStatusEffect>[0], duration: number, value: number, enemyTarget: boolean) => {
    if (enemyTarget) {
      const enemy = enemies.find(e => e.id === targetId && e.hp > 0);
      if (!enemy) return;
      const ability = enemy.intent ? enemyAbilities[enemy.intent.abilityId] : undefined;
      const resistance = ability?.interruptResistance ?? enemy.stunResistance ?? 0.5;
      if (type === 'STUN' && enemy.isBoss && random() < resistance) { logs.push(`${enemy.name} resists the stun.`); return; }
      enemies = enemies.map(e => e.id === targetId ? { ...e, statusEffects: upsertStatusEffect(e.statusEffects, createStatusEffect(type, duration, value)) } : e);
    } else {
      player.party = player.party.map(c => c.id === targetId ? { ...c, statusEffects: upsertStatusEffect(c.statusEffects, createStatusEffect(type, duration, value)) } : c);
    }
    logs.push(`${enemyTarget ? enemies.find(e => e.id === targetId)?.name : player.party.find(c => c.id === targetId)?.name} gained ${type}!`);
  };
  if (command.type === 'attack') {
    if (!target) return fail('No living target.');
    const attack = calculatePlayerAttack(character, random);
    enemies = damageEnemies(enemies, target.id, attack.damage);
    logs.push(`${character.name} attacks ${target.name} for ${attack.damage}${attack.critical ? ' (CRIT!)' : ''}.`);
    vfx.push({ type: attack.critical ? 'CRITICAL' : 'ATTACK', targetId: target.id });
    sound = 'attack';
  } else if (command.type === 'defend') {
    character.isDefending = true;
    logs.push(`${character.name} guards for 2.8 seconds.`);
    vfx.push({ type: 'BUFF', targetId: character.id }); sound = 'defend';
  } else if (command.type === 'run') {
    escaped = !enemies.some(enemy => enemy.isBoss) && random() > 0.5;
    logs.push(escaped ? 'Escaped safely!' : "Couldn't escape!");
  } else if (command.type === 'skill') {
    const skill = character.skills.find(s => s.id === command.id);
    if (!skill) return fail('Unknown skill.');
    if (character.stats.mp < skill.cost && skill.id !== 'soul_pact') return fail('Not enough MP!');
    const offensive = skill.type !== 'HEAL' && skill.type !== 'BUFF' && skill.id !== 'soul_pact';
    if (offensive && !target) return fail('No living target.');
    recoveryMs = playerRecoveryMs(character, 'skill', skill);
    if (skill.id === 'soul_pact') {
      if (character.stats.hp <= 20) return fail('Not enough HP!');
      character.stats.hp -= 20; character.stats.mp = Math.min(character.stats.maxMp, character.stats.mp + 40);
      logs.push(`${character.name} trades life for power.`); vfx.push({ type: 'DARK', targetId: character.id });
    } else {
      if (skill.id === 'sacrifice') {
        if (character.stats.hp <= 15) return fail('Too weak to sacrifice!');
        character.stats.hp -= 15;
      } else character.stats.mp -= skill.cost;
      const power = calculateSkillPower(character, skill);
      if (skill.type === 'HEAL' || skill.type === 'BUFF') {
        const ally = skill.targetType === 'ALLY' ? [...player.party].sort((a, b) => a.stats.hp / a.stats.maxHp - b.stats.hp / b.stats.maxHp)[0] : character;
        if (skill.type === 'HEAL') {
          ally.stats.hp = Math.min(ally.stats.maxHp, ally.stats.hp + power);
          logs.push(`${character.name} heals ${ally.name} for ${power}.`); sound = 'heal';
          vfx.push({ type: 'HEAL', targetId: ally.id });
        } else if (skill.effect) { status(ally.id, skill.effect.type, skill.effect.duration, skill.effect.val, false); vfx.push({ type: 'BUFF', targetId: ally.id }); }
      } else if (target) {
        enemies = damageEnemies(enemies, target.id, power, skill.targetType === 'MULTI');
        logs.push(`${character.name} casts ${skill.name} for ${power} damage.`);
        vfx.push({ type: skill.vfxType, targetId: target.id }); sound = 'attack';
        if (skill.type === 'DRAIN') character.stats.hp = Math.min(character.stats.maxHp, character.stats.hp + Math.floor(power * 0.8));
        if (skill.effect && random() < skill.effect.chance) {
          const targets = skill.targetType === 'MULTI' ? enemies.filter(e => e.hp > 0) : enemies.filter(e => e.id === target.id && e.hp > 0);
          targets.forEach(e => status(e.id, skill.effect!.type, skill.effect!.duration, skill.effect!.val, true));
        }
      }
    }
  } else if (command.type === 'item') {
    const item = player.inventory.find(i => i.id === command.id && i.quantity > 0);
    // SCROLL has no authored effect in the current data; reject instead of consuming a fake action.
    if (!item || item.type !== 'POTION' || (!item.id.includes('hp') && !item.id.includes('mp'))) return fail('No usable potion.');
    if (item.id.includes('hp')) character.stats.hp = Math.min(character.stats.maxHp, character.stats.hp + item.value);
    if (item.id.includes('mp')) character.stats.mp = Math.min(character.stats.maxMp, character.stats.mp + item.value);
    item.quantity -= 1; player.inventory = player.inventory.filter(i => i.quantity > 0);
    logs.push(`${character.name} used ${item.name}.`); vfx.push({ type: 'HEAL', targetId: character.id }); sound = 'heal';
  }
  return { accepted: true, player, enemies, recoveryMs, logs, vfx, sound, escaped };
};
