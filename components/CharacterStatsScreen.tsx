import React from 'react';
import { getUniqueItem } from '../data/uniqueItems';
import type { DerivedCharacterStats, PlayerCharacter } from '../types';
import { xpToNextLevel } from '../player/PlayerProgression';
import { uniqueEffectRemaining } from '../player/UniqueEffects';
import { describeItem } from '../services/itemization';
import { ItemIcon } from './ItemIcon';
import { EQUIPMENT_SLOTS, equipmentSlotLabel } from '../services/equipmentRules';

export const CharacterStatsScreen: React.FC<{ player: PlayerCharacter; derived: DerivedCharacterStats }> = ({ player, derived }) => {
  const nextLevelXp = xpToNextLevel(player.stats.level);
  const xpPercent = Math.max(0, Math.min(100, player.stats.xp / nextLevelXp * 100));
  const uniques = EQUIPMENT_SLOTS.flatMap(slot => {
    const item = player.equipment[slot];
    const definition = item?.uniqueEffectId ? getUniqueItem(item.uniqueEffectId) : undefined;
    return item && definition ? [{ item, definition }] : [];
  });

  return <div className="fps-character-stats" aria-label="Character stats">
    <section className="fps-character-identity">
      <div className="fps-character-monogram" aria-hidden="true">{player.name.slice(0, 1)}</div>
      <div className="fps-character-identity-copy">
        <span>LABYRINTH RUNNER</span>
        <h3>{player.name}</h3>
        <p>{player.classId} · Level {player.stats.level}</p>
        <div className="fps-character-xp" aria-label={`${player.stats.xp} of ${nextLevelXp} experience toward the next level`}>
          <i style={{ width: xpPercent + '%' }} />
        </div>
        <small>{player.stats.xp} / {nextLevelXp} XP to next level</small>
      </div>
      <div className="fps-character-resources">
        <StatLine label="Health" value={`${Math.ceil(player.stats.hp)} / ${Math.ceil(derived.maxHealth)}`} />
        <StatLine label="Mana" value={`${Math.floor(player.stats.mp)} / ${Math.floor(derived.maxMana)}`} />
      </div>
    </section>

    <div className="fps-character-stat-columns">
      <section className="fps-build-summary fps-character-stat-card">
        <h3>Attributes & defense</h3>
        <StatLine label="Strength" value={derived.strength} />
        <StatLine label="Dexterity" value={derived.dexterity} />
        <StatLine label="Intelligence" value={derived.intelligence} />
        <StatLine label="Armor" value={derived.armor} />
        <StatLine label="Weapon power" value={derived.weaponPower} />
        <StatLine label="Main-hand power" value={derived.mainHandWeaponPower} />
        <StatLine label="Off-hand power" value={derived.offHandWeaponPower} />
      </section>
      <section className="fps-build-summary fps-character-stat-card">
        <h3>Combat</h3>
        <StatLine label="Physical damage" value={percent(derived.physicalDamageMultiplier)} />
        <StatLine label="Flat physical damage" value={signed(derived.physicalDamageFlat)} />
        <StatLine label="Spell damage" value={percent(derived.spellDamageMultiplier)} />
        <StatLine label="Flat spell damage" value={signed(derived.spellDamageFlat)} />
        <StatLine label="Projectile damage" value={percent(derived.projectileDamageMultiplier)} />
        <StatLine label="Attack speed" value={percent(derived.attackSpeedMultiplier)} />
        <StatLine label="Cast speed" value={percent(derived.castSpeedMultiplier)} />
        <StatLine label="Critical chance" value={percent(derived.criticalChance)} />
        <StatLine label="Critical damage" value={percent(derived.criticalDamageMultiplier)} />
        <StatLine label="Projectile speed" value={percent(derived.projectileSpeedMultiplier)} />
      </section>
      <section className="fps-build-summary fps-character-stat-card">
        <h3>Survival & utility</h3>
        <StatLine label="Movement speed" value={percent(derived.movementSpeedMultiplier)} />
        <StatLine label="Cooldown recovery" value={percent(1 - derived.cooldownMultiplier)} />
        <StatLine label="Mana cost reduction" value={percent(1 - derived.manaCostMultiplier)} />
        <StatLine label="Bleed chance / power" value={`${percent(derived.bleedChance)} / ${percent(derived.bleedPowerMultiplier)}`} />
        <StatLine label="Poison chance / power" value={`${percent(derived.poisonChance)} / ${percent(derived.poisonPowerMultiplier)}`} />
        <StatLine label="Fire chance / power" value={`${percent(derived.fireChance)} / ${percent(derived.firePowerMultiplier)}`} />
        <StatLine label="Life on hit / kill" value={`${derived.lifeOnHit} / ${derived.lifeOnKill}`} />
      </section>
    </div>

    <section className="fps-character-equipment-card">
      <div className="fps-inventory-section-heading"><h3>Equipped loadout</h3><span>Live from the active equipment slots</span></div>
      <div className="fps-character-equipment-list">{EQUIPMENT_SLOTS.map(slot => {
        const item = player.equipment[slot];
        return <div className="fps-character-equipment-item" key={slot}>
          <span className="fps-equipment-icon">{item ? <ItemIcon item={item} /> : <i>◇</i>}</span>
          <span><small>{equipmentSlotLabel(slot)}</small><strong>{item ? describeItem(item) : 'Empty'}</strong>{item && <small>{item.rarity} · Item Level {item.itemLevel}</small>}</span>
        </div>;
      })}</div>
    </section>

    {uniques.length > 0 && <section className="fps-character-uniques">
      <div className="fps-inventory-section-heading"><h3>Mythic powers</h3><span>{uniques.length} equipped</span></div>
      <div className="fps-character-unique-list">{uniques.map(({ item, definition }) => {
        const state = player.uniqueEffectStates?.find(candidate => candidate.effectId === definition.effectId);
        const remaining = uniqueEffectRemaining(player, definition.effectId);
        const incompatible = Boolean(definition.requiredClass && definition.requiredClass !== player.classId);
        return <article className="fps-character-unique" key={item.instanceId}>
          <ItemIcon item={item} />
          <div><strong>{definition.name}</strong><p>{incompatible ? definition.fallbackSummary : definition.effectSummary}</p>
            {!incompatible && <small>{remaining > 0 ? `Active · ${remaining.toFixed(1)}s` : state?.charges ? `${state.charges} charge ready` : state?.cooldownRemaining ? `Cooldown · ${state.cooldownRemaining.toFixed(1)}s` : 'Ready'} · {definition.triggerRule}</small>}
          </div>
        </article>;
      })}</div>
    </section>}

    {player.statusEffects.some(effect => effect.durationSeconds > 0) && <section className="fps-character-effects">
      <div className="fps-inventory-section-heading"><h3>Active effects</h3><span>Current combat state</span></div>
      <div>{player.statusEffects.filter(effect => effect.durationSeconds > 0).map(effect => <span key={effect.id}>{effect.statusId} · {effect.durationSeconds.toFixed(1)}s</span>)}</div>
    </section>}
  </div>;
};

const StatLine: React.FC<{ label: string; value: number | string }> = ({ label, value }) => <div className="fps-stat-line"><span>{label}</span><b>{typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(1)) : value}</b></div>;

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function signed(value: number): string {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}`;
}
