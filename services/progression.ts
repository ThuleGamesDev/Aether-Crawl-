import { MASTER_SKILL_POOL } from '../constants';
import { Character, Perk } from '../types';

export const generatePerksForCharacter = (character: Character): Perk[] => {
  const existingUpgrades: Perk[] = character.skills
    .filter(skill => skill.level < skill.maxLevel)
    .map((skill, index) => ({
      id: `upgrade_${skill.id}_${Date.now()}_${index}`,
      type: 'UPGRADE',
      skillId: skill.id,
      title: `Upgrade: ${skill.name} (Lv.${skill.level + 1})`,
      description: 'Increase power/efficiency.',
      cost: 0,
    }));
  const knownSkillIds = character.skills.map(skill => skill.id);
  const potentialSkills = MASTER_SKILL_POOL.filter(skill => !knownSkillIds.includes(skill.id));
  const stats = { STR: character.stats.str, DEX: character.stats.dex, INT: character.stats.int };
  const maxStat = Math.max(stats.STR, stats.DEX, stats.INT);
  const primaryStats = Object.keys(stats).filter(key => stats[key as keyof typeof stats] >= maxStat - 2);
  const relevantSkills = potentialSkills.filter(skill => primaryStats.includes(skill.scalingStat));
  const selectedSkills = relevantSkills.length > 0 ? relevantSkills : potentialSkills;
  const newSkillPerks: Perk[] = selectedSkills.map((skill, index) => ({
    id: `new_${skill.id}_${Date.now()}_${index}`,
    type: 'NEW',
    skillId: skill.id,
    title: `Learn: ${skill.name}`,
    description: skill.description,
    cost: 0,
  }));

  const choices: Perk[] = [];
  if (existingUpgrades.length > 0) choices.push(existingUpgrades[Math.floor(Math.random() * existingUpgrades.length)]);
  if (newSkillPerks.length > 0) choices.push(newSkillPerks[Math.floor(Math.random() * newSkillPerks.length)]);
  const remaining = [
    ...existingUpgrades.filter(perk => !choices.includes(perk)),
    ...newSkillPerks.filter(perk => !choices.includes(perk)),
  ];
  for (let index = remaining.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [remaining[index], remaining[randomIndex]] = [remaining[randomIndex], remaining[index]];
  }
  while (choices.length < 3 && remaining.length > 0) choices.push(remaining.pop()!);
  choices.push({ id: 'heal_self', title: 'Full Restore', description: 'Fully heal HP & MP', type: 'NEW', skillId: '', cost: 0 });
  return choices;
};
