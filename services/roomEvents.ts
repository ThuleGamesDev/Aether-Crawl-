import { Character, ClassType, RoomEventCheckModifier, RoomEventDefinition, CharacterEventCheckResult, ActiveRoomEvent, RoomHazardType, RoomEventStat, StatusType } from '../types';
import { createStatusEffect, upsertStatusEffect } from './combat';

export const ROOM_EVENT_DEFINITIONS: RoomEventDefinition[] = [
  {
    id: 'trap_corridor',
    title: 'Trap-Filled Corridor',
    subtitle: 'Concealed tripwires & swinging scythes',
    icon: '🏹',
    description: 'Subtle clicks betray ancient mechanisms. Razor-sharp scythes and poisoned dart volleys sweep across the narrow stone corridor!',
    primaryStat: 'DEX',
    hazardType: 'TRAP',
    accentColor: 'amber',
  },
  {
    id: 'mana_mist',
    title: 'Mana-Draining Mist',
    subtitle: 'Chilling cerulean vapors siphon magical energy',
    icon: '🌫️',
    description: 'Luminous blue mist pours through the cracked flagstones. Its icy touch feeds upon spiritual reserves, threatening to enfeeble the unwary.',
    primaryStat: 'INT',
    hazardType: 'MIST',
    accentColor: 'cyan',
  },
  {
    id: 'toxic_spores',
    title: 'Toxic Fungal Spores',
    subtitle: 'Noxious cloud released from subterranean blooms',
    icon: '🍄',
    description: 'Giant fungal pods rupture with a sickening hiss, releasing a dense emerald cloud of choking spores that burn the lungs.',
    primaryStat: 'STR',
    hazardType: 'SPORES',
    accentColor: 'emerald',
  },
  {
    id: 'crumbling_ceiling',
    title: 'Crumbling Vault Archway',
    subtitle: 'Structural tremors rain masonry from above',
    icon: '🪨',
    description: 'The ancient masonry groans under immense pressure. Heavy blocks of stone and jagged rubble plummet from the fractured ceiling!',
    primaryStat: 'STR',
    hazardType: 'COLLAPSE',
    accentColor: 'stone',
  },
  {
    id: 'arcane_surge',
    title: 'Unstable Leyline Rift',
    subtitle: 'Planar conduits crackle with raw wild magic',
    icon: '⚡',
    description: 'A glowing fracture in reality arcs with volatile violet lightning. The erratic discharges test the magical endurance of everyone present.',
    primaryStat: 'INT',
    hazardType: 'ARCANE_SURGE',
    accentColor: 'purple',
  },
  {
    id: 'frostbound_draft',
    title: 'Frostbound Gale',
    subtitle: 'Sub-zero subterranean draft numbs the body',
    icon: '❄️',
    description: 'A glacial wind rushes through a jagged chasm. The bone-chilling cold threatens to freeze muscle and dull combat reflexes.',
    primaryStat: 'STR',
    hazardType: 'FROST',
    accentColor: 'sky',
  },
];

export const calculateEnvironmentalDC = (dungeonLevel: number): number => {
  return 10 + Math.floor(dungeonLevel * 0.75);
};

export const getCharacterEventModifiers = (
  character: Character,
  hazardType: RoomHazardType,
): RoomEventCheckModifier[] => {
  const modifiers: RoomEventCheckModifier[] = [];
  const effects = character.statusEffects || [];

  const hasShield = effects.some(e => e.type === 'SHIELD');
  const hasWeakness = effects.some(e => e.type === 'WEAKNESS');
  const hasStun = effects.some(e => e.type === 'STUN');
  const hasPoison = effects.some(e => e.type === 'POISON');
  const hasRegen = effects.some(e => e.type === 'REGEN');
  const hasStrength = effects.some(e => e.type === 'STRENGTH');
  const hasBurn = effects.some(e => e.type === 'BURN');
  const hasEquippedShield = character.equipment?.offhand?.type === 'SHIELD';

  if (hasShield) {
    if (hazardType === 'TRAP' || hazardType === 'COLLAPSE') {
      modifiers.push({ label: 'Shield Ward (+3)', value: 3 });
    } else if (hazardType === 'ARCANE_SURGE') {
      modifiers.push({ label: 'Arcane Insulation (+3)', value: 3 });
    } else if (hazardType === 'MIST') {
      modifiers.push({ label: 'Aegis Barrier (+2)', value: 2 });
    }
  }

  if (hasEquippedShield && (hazardType === 'TRAP' || hazardType === 'COLLAPSE')) {
    modifiers.push({ label: 'Raised Buckler (+2)', value: 2 });
  }

  if (hasWeakness) {
    if (hazardType === 'TRAP' || hazardType === 'COLLAPSE' || hazardType === 'SPORES' || hazardType === 'FROST') {
      modifiers.push({ label: 'Enfeebled Reflexes (-3)', value: -3 });
    } else {
      modifiers.push({ label: 'Faltering Will (-2)', value: -2 });
    }
  }

  if (hasStun) {
    modifiers.push({ label: 'Stunned Disorientation (-4)', value: -4 });
  }

  if (hasPoison) {
    if (hazardType === 'SPORES') {
      modifiers.push({ label: 'Compromised Lungs (-4)', value: -4 });
    } else if (hazardType === 'TRAP' || hazardType === 'FROST') {
      modifiers.push({ label: 'Poison Fatigue (-2)', value: -2 });
    }
  }

  if (hasRegen) {
    if (hazardType === 'SPORES') {
      modifiers.push({ label: 'Cellular Vitality (+3)', value: 3 });
    } else if (hazardType === 'MIST') {
      modifiers.push({ label: 'Purifying Flow (+2)', value: 2 });
    }
  }

  if (hasStrength) {
    if (hazardType === 'COLLAPSE') {
      modifiers.push({ label: 'Surging Might (+3)', value: 3 });
    } else if (hazardType === 'SPORES' || hazardType === 'FROST') {
      modifiers.push({ label: 'Hearty Constitution (+2)', value: 2 });
    }
  }

  if (hasBurn) {
    if (hazardType === 'FROST') {
      modifiers.push({ label: 'Inner Flame Resists Chill (+4)', value: 4 });
    } else if (hazardType === 'MIST' || hazardType === 'ARCANE_SURGE') {
      modifiers.push({ label: 'Searing Distraction (-2)', value: -2 });
    }
  }

  if (character.stats.hp < character.stats.maxHp * 0.3) {
    modifiers.push({ label: 'Critical Wounds (-2)', value: -2 });
  }

  if (hazardType === 'MIST' && character.stats.mp <= 0) {
    modifiers.push({ label: 'Depleted Spirit (-3)', value: -3 });
  }

  if (hazardType === 'ARCANE_SURGE' && (character.classType === 'SORCERER' || character.classType === 'CLERIC' || character.classType === 'NECROMANCER')) {
    modifiers.push({ label: 'Arcane Affinity (+2)', value: 2 });
  }

  return modifiers;
};

export const resolveCharacterCheck = (
  character: Character,
  event: RoomEventDefinition,
  dungeonLevel: number,
  forcedRoll?: number,
): CharacterEventCheckResult => {
  let primaryStat: RoomEventStat = event.primaryStat;
  if (event.hazardType === 'COLLAPSE') {
    primaryStat = character.stats.str >= character.stats.dex ? 'STR' : 'DEX';
  }

  const statKey = primaryStat === 'STR' ? 'str' : primaryStat === 'DEX' ? 'dex' : 'int';
  const statValue = character.stats[statKey];
  const statBonus = Math.floor(statValue / 3);
  const modifiers = getCharacterEventModifiers(character, event.hazardType);
  const modifierSum = modifiers.reduce((acc, m) => acc + m.value, 0);

  const roll = forcedRoll !== undefined ? forcedRoll : Math.floor(Math.random() * 20) + 1;
  const totalScore = roll + statBonus + modifierSum;
  const difficultyClass = calculateEnvironmentalDC(dungeonLevel);

  const criticalSuccess = roll === 20 || (roll >= 15 && totalScore >= difficultyClass + 5);
  const criticalFailure = roll === 1 || totalScore <= difficultyClass - 6;
  const success = totalScore >= difficultyClass;

  let hpChange = 0;
  let mpChange = 0;
  let statusApplied: StatusType | undefined;
  let statusDuration: number | undefined;
  let logSummary = '';

  const hasProtection = (character.statusEffects || []).some(e => e.type === 'SHIELD') || character.equipment?.offhand?.type === 'SHIELD';

  if (success) {
    switch (event.hazardType) {
      case 'TRAP':
        if (criticalSuccess) {
          logSummary = `${character.name} deftly disarmed a pressure plate, securing passage!`;
        } else {
          logSummary = `${character.name} rolled under swinging blades with nimble agility.`;
        }
        break;
      case 'MIST':
        if (criticalSuccess) {
          mpChange = 8 + dungeonLevel * 2;
          logSummary = `${character.name} channeled the luminous mist, restoring ${mpChange} MP!`;
        } else {
          logSummary = `${character.name} centered their mind and shrugged off the spirit drain.`;
        }
        break;
      case 'SPORES':
        logSummary = `${character.name} covered their mouth and resisted the fungal spores without harm.`;
        break;
      case 'COLLAPSE':
        logSummary = `${character.name} vaulted clear of the falling masonry unscathed!`;
        break;
      case 'ARCANE_SURGE':
        statusApplied = 'SHIELD';
        statusDuration = 3;
        mpChange = 5;
        logSummary = `${character.name} attuned with the leyline, gaining a 12pt Shield and +5 MP!`;
        break;
      case 'FROST':
        logSummary = `${character.name} braced against the howling draft and pushed through untouched.`;
        break;
    }
  } else {
    // Failure / Critical Failure
    switch (event.hazardType) {
      case 'TRAP': {
        let baseDmg = 8 + dungeonLevel * 3;
        if (criticalFailure) baseDmg = Math.floor(baseDmg * 1.4);
        if (hasProtection) baseDmg = Math.max(2, Math.floor(baseDmg * 0.5));
        hpChange = -baseDmg;
        logSummary = `${character.name} triggered a trap! Took ${baseDmg} physical damage${hasProtection ? ' (partially shielded)' : ''}.`;
        break;
      }
      case 'MIST': {
        const drain = 6 + dungeonLevel * 2;
        mpChange = -drain;
        if (character.stats.mp <= 0 || character.stats.mp - drain < 0) {
          const backlashDmg = 5 + dungeonLevel * 2;
          hpChange = -backlashDmg;
          statusApplied = 'WEAKNESS';
          statusDuration = 3;
          logSummary = `${character.name}'s spirit was drained dry! Lost ${drain} MP, took ${backlashDmg} vitality damage, and gained WEAKNESS!`;
        } else {
          logSummary = `${character.name}'s mana was siphoned by the cold mist (-${drain} MP).`;
        }
        break;
      }
      case 'SPORES': {
        const dmg = 5 + dungeonLevel * 2;
        hpChange = -dmg;
        statusApplied = 'POISON';
        statusDuration = 3;
        logSummary = `${character.name} inhaled toxic spores! Took ${dmg} poison damage and is afflicted with POISON!`;
        break;
      }
      case 'COLLAPSE': {
        let dmg = 10 + dungeonLevel * 3;
        if (criticalFailure) {
          dmg = Math.floor(dmg * 1.3);
          statusApplied = 'STUN';
          statusDuration = 1;
        }
        if (hasProtection) dmg = Math.max(3, Math.floor(dmg * 0.6));
        hpChange = -dmg;
        logSummary = `${character.name} was struck by falling masonry for ${dmg} damage${criticalFailure ? ' and STUNNED' : ''}!`;
        break;
      }
      case 'ARCANE_SURGE': {
        const dmg = 7 + dungeonLevel * 2;
        hpChange = -dmg;
        statusApplied = 'BURN';
        statusDuration = 2;
        logSummary = `${character.name} was scorched by planar lightning for ${dmg} damage and afflicted with BURN!`;
        break;
      }
      case 'FROST': {
        const dmg = 6 + dungeonLevel * 2;
        hpChange = -dmg;
        statusApplied = 'WEAKNESS';
        statusDuration = 3;
        logSummary = `${character.name} suffered biting frostbite (-${dmg} HP) and became WEAKENED!`;
        break;
      }
    }
  }

  return {
    characterId: character.id,
    characterName: character.name,
    classType: character.classType,
    baseStat: primaryStat,
    statValue,
    statBonus,
    modifiers,
    roll,
    totalScore,
    difficultyClass,
    success,
    criticalSuccess,
    criticalFailure,
    hpChange,
    mpChange,
    statusApplied,
    statusDuration,
    logSummary,
  };
};

export const createRoomEvent = (
  party: Character[],
  dungeonLevel: number,
  preferredEventId?: string,
  forcedRolls?: Record<string, number>,
): ActiveRoomEvent => {
  const definition = preferredEventId
    ? ROOM_EVENT_DEFINITIONS.find(e => e.id === preferredEventId) || ROOM_EVENT_DEFINITIONS[0]
    : ROOM_EVENT_DEFINITIONS[Math.floor(Math.random() * ROOM_EVENT_DEFINITIONS.length)];

  const difficultyClass = calculateEnvironmentalDC(dungeonLevel);
  const results = party
    .filter(c => c.stats.hp > 0)
    .map(c => resolveCharacterCheck(c, definition, dungeonLevel, forcedRolls?.[c.id]));

  let scrapsFound = 0;
  if (definition.hazardType === 'TRAP') {
    const crits = results.filter(r => r.criticalSuccess).length;
    if (crits > 0) {
      scrapsFound = crits * (4 + dungeonLevel);
    }
  }

  const passCount = results.filter(r => r.success).length;
  const summary = passCount === results.length
    ? `The entire party weathered the ${definition.title} successfully!`
    : passCount === 0
    ? `The entire party suffered casualties from the ${definition.title}!`
    : `${passCount} of ${results.length} party members passed their environmental checks.`;

  return {
    event: definition,
    dungeonLevel,
    difficultyClass,
    results,
    scrapsFound,
    summary,
  };
};

export const applyRoomEventToParty = (
  party: Character[],
  results: CharacterEventCheckResult[],
): Character[] => {
  return party.map(character => {
    const result = results.find(r => r.characterId === character.id);
    if (!result || character.stats.hp <= 0) return character;

    const nextHp = Math.min(character.stats.maxHp, Math.max(0, character.stats.hp + result.hpChange));
    const nextMp = Math.min(character.stats.maxMp, Math.max(0, character.stats.mp + result.mpChange));

    let updatedEffects = character.statusEffects || [];
    if (result.statusApplied && result.statusDuration) {
      const effectValue = result.statusApplied === 'SHIELD' ? 12 : result.statusApplied === 'BURN' ? 3 : 2;
      const effect = createStatusEffect(result.statusApplied, result.statusDuration, effectValue);
      updatedEffects = upsertStatusEffect(updatedEffects, effect);
    }

    return {
      ...character,
      stats: {
        ...character.stats,
        hp: nextHp,
        mp: nextMp,
      },
      statusEffects: updatedEffects,
    };
  });
};

export const shouldTriggerRoomEvent = (
  stepsSinceLastEvent: number,
  isCombatTriggered: boolean,
  isExitTile: boolean,
  isBossDefeated: boolean,
  randomValue = Math.random(),
): boolean => {
  if (isCombatTriggered || isExitTile) return false;
  // Minimum cooldown of 9 steps
  if (stepsSinceLastEvent < 9) return false;
  // Guaranteed after 24 steps, otherwise scaling chance between steps 9 and 24
  if (stepsSinceLastEvent >= 24) return true;
  const chance = 0.08 + (stepsSinceLastEvent - 9) * 0.02; // 8% to 38%
  return randomValue < chance;
};
