import type { ClassPassiveId, ClassType } from '../types';

export interface ClassSkillDefinition {
  abilityId: string;
  slot: 1 | 2 | 3 | 4;
  unlockLevel: number;
  role: string;
  description: string;
}

export interface ClassSkillKit {
  classId: ClassType;
  name: string;
  identity: string;
  passive: { id: ClassPassiveId; name: string; description: string };
  archetypes: Array<{ name: string; description: string }>;
  skills: [ClassSkillDefinition, ClassSkillDefinition, ClassSkillDefinition, ClassSkillDefinition];
}

export const CLASS_SKILL_KITS: Partial<Record<ClassType, ClassSkillKit>> = {
  BARBARIAN: {
    classId: 'BARBARIAN',
    name: 'Myrmidon',
    identity: 'A relentless bronze-age warrior who trades safety for decisive close-range pressure.',
    passive: { id: 'war_momentum', name: 'War Momentum', description: 'A successful melee action builds one stack, up to five. Each stack adds 4% physical damage for 3 seconds; misses and repeated hit events do not build stacks.' },
    archetypes: [
      { name: 'Heavy Bruiser', description: 'Use Ares’ Quake to control space, then finish a durable target.' },
      { name: 'Combo Berserker', description: 'Keep War Momentum alive with deliberate, reliable melee hits.' },
      { name: 'Blood Warrior', description: 'Trade a short-lived defensive penalty for a capped damage surge.' },
    ],
    skills: [
      { abilityId: 'barbarian_ground_slam', slot: 1, unlockLevel: 1, role: 'Control', description: 'A close shockwave that staggers nearby foes.' },
      { abilityId: 'barbarian_bronze_cyclone', slot: 2, unlockLevel: 2, role: 'Sweep', description: 'Three measured sweeps cover a full circle during a short active window.' },
      { abilityId: 'barbarian_blood_oath', slot: 3, unlockLevel: 4, role: 'Risk / reward', description: 'Gain physical damage while taking increased incoming damage.' },
      { abilityId: 'barbarian_heroic_execution', slot: 4, unlockLevel: 6, role: 'Finisher', description: 'Deals increased damage to enemies already below the health threshold.' },
    ],
  },
  PALADIN: {
    classId: 'PALADIN',
    name: 'Hoplite',
    identity: 'A disciplined defender whose wards create short, earned attack windows. Weapon skills remain independent from shield equipment.',
    passive: { id: 'unbroken_line', name: 'Unbroken Line', description: 'A successful shield block grants one 18% melee counter window for 3 seconds, at most once every 4 seconds.' },
    archetypes: [
      { name: 'Defensive Counter', description: 'Block deliberately and spend the resulting counter on a confirmed melee action.' },
      { name: 'Reach Control', description: 'Use Aegis Lance’s narrow, wall-aware lane to punish approaching enemies.' },
      { name: 'Guard-Heavy Tank', description: 'Layer Phalanx Stand and Reprisal without needing a shield every second.' },
    ],
    skills: [
      { abilityId: 'paladin_consecration', slot: 1, unlockLevel: 1, role: 'Guard', description: 'A self-centered stance that reduces incoming damage for a short time.' },
      { abilityId: 'paladin_dory_impale', slot: 2, unlockLevel: 2, role: 'Reach', description: 'Call a narrow, long-reaching ward-lance that respects walls.' },
      { abilityId: 'paladin_bronze_reprisal', slot: 3, unlockLevel: 4, role: 'Counter', description: 'Create a brief personal ward and a capped next-hit counter window.' },
      { abilityId: 'paladin_aspis_charge', slot: 4, unlockLevel: 6, role: 'Engage', description: 'Advance a short, collision-safe distance and strike with warding force.' },
    ],
  },
  SORCERER: {
    classId: 'SORCERER',
    name: 'Oracle',
    identity: 'An elemental caster who alternates schools to earn a small, non-stacking burst.',
    passive: { id: 'omen_weaving', name: 'Omen Weaving', description: 'Alternating Fire, Lightning, and Arcane casts empowers the next eligible cast by 18%. Repeating one school does not refresh or stack the bonus.' },
    archetypes: [
      { name: 'Fire Explosion', description: 'Ignite groups with Promethean Flame and capitalize on the burn window.' },
      { name: 'Chain Lightning', description: 'Lead with Storm Invocation and let bounded arcs seek nearby targets.' },
      { name: 'Burst Cast / Defense', description: 'Alternate spell schools and use Prophetic Veil to reposition safely.' },
    ],
    skills: [
      { abilityId: 'sorcerer_fireburst', slot: 1, unlockLevel: 1, role: 'Fire area', description: 'Aimed fireburst that applies a bounded burn.' },
      { abilityId: 'sorcerer_storm_invocation', slot: 2, unlockLevel: 2, role: 'Chain lightning', description: 'A small aimed strike that chains to at most two additional foes.' },
      { abilityId: 'sorcerer_prophetic_veil', slot: 3, unlockLevel: 4, role: 'Reposition', description: 'A short collision-safe step with a brief defensive veil.' },
      { abilityId: 'sorcerer_omenfall', slot: 4, unlockLevel: 6, role: 'Arcane burst', description: 'A precise arcane impact rewards alternating spell schools.' },
    ],
  },
  ROGUE: {
    classId: 'ROGUE',
    name: 'Trickster',
    identity: 'A mobile opportunist who converts a dodge, stagger, or flank into one precise opening.',
    passive: { id: 'opportunist', name: 'Opportunist', description: 'A successful dodge primes one hit for 22% extra damage. A melee hit against a staggered or flanked target can also qualify; one action consumes at most one opportunity.' },
    archetypes: [
      { name: 'Poison', description: 'Build a poison window with Venomous Cut, then disengage.' },
      { name: 'Mobility Crit', description: 'Create openings with dodges and Shadow Lunge before committing.' },
      { name: 'Fast Combo', description: 'Use Shadow Flurry’s short active window to keep pressure on one lane.' },
    ],
    skills: [
      { abilityId: 'rogue_knife_fan', slot: 1, unlockLevel: 1, role: 'Phantom blade', description: 'A quick spectral blade keeps pressure while repositioning.' },
      { abilityId: 'rogue_kopis_flurry', slot: 2, unlockLevel: 2, role: 'Combo', description: 'Three class-driven strikes resolve across a short active window.' },
      { abilityId: 'rogue_venomous_cut', slot: 3, unlockLevel: 4, role: 'Poison', description: 'A precise forward feint applies a bounded poison effect.' },
      { abilityId: 'rogue_shadow_lunge', slot: 4, unlockLevel: 6, role: 'Gap close', description: 'A short, collision-safe lunge followed by a focused cut.' },
    ],
  },
  RANGER: {
    classId: 'RANGER',
    name: 'Hunter',
    identity: 'An Artemis-inspired hunter who controls a lane with focused projectiles, snares, and short repositioning bursts.',
    passive: { id: 'marked_prey', name: 'Marked Prey', description: 'Directly hitting your aimed target with a projectile builds up to 3 focus stacks for 4 seconds. Your next projectile at that same target gains 6% damage per stack and consumes the focus.' },
    archetypes: [
      { name: 'Piercing Crit', description: 'Build focus with projectile attacks and spend it on Moonpiercer against a clear target line.' },
      { name: 'Trapper', description: 'Control a short lane with Hunter’s Snare, then send Spirit Volley through the slowed group.' },
      { name: 'Mobile Hunter', description: 'Use Moonlit Pursuit to reposition, then maintain pressure with a focused ranged attack.' },
    ],
    skills: [
      { abilityId: 'ranger_volley', slot: 1, unlockLevel: 1, role: 'Spirit volley', description: 'Three moonlit spirit shafts in a narrow fan; 62% damage each.' },
      { abilityId: 'ranger_piercing_hunt', slot: 2, unlockLevel: 2, role: 'Piercing spell', description: 'A spectral point can pass through its first target and up to two more.' },
      { abilityId: 'ranger_hunters_snare', slot: 3, unlockLevel: 4, role: 'Trap / slow', description: 'A small aimed trap slows caught foes by 28% for 3 seconds.' },
      { abilityId: 'ranger_moonlit_pursuit', slot: 4, unlockLevel: 6, role: 'Mobility / precision', description: 'Step up to 0.8m and gain 18% move/action speed plus 15% projectile damage.' },
    ],
  },
  CLERIC: {
    classId: 'CLERIC',
    name: 'Asclepiad',
    identity: 'A self-reliant healer-warrior who spends mana on measured recovery and short defensive rites.',
    passive: { id: 'measured_remedy', name: 'Measured Remedy', description: 'Healing that crosses you from below to at least 50% health grants 22% guard for 2.25 seconds. It can trigger once every 10 seconds.' },
    archetypes: [
      { name: 'Sustain Fighter', description: 'Use Serpent’s Renewal between attacks and reserve Asclepius’ Grace for a larger recovery.' },
      { name: 'Protective Priest', description: 'Prevent a dangerous hit with Sacred Aegis; use Purifying Rite for one lingering affliction.' },
      { name: 'Sacred Damage', description: 'Use Temple Light to pressure safely while keeping a costly heal for emergencies.' },
    ],
    skills: [
      { abilityId: 'cleric_restoration', slot: 1, unlockLevel: 1, role: 'Self heal', description: 'Restore up to 30% of maximum health, with an 8-second cooldown and 10 mana cost.' },
      { abilityId: 'cleric_serpents_renewal', slot: 2, unlockLevel: 2, role: 'Regeneration', description: 'Restore 5 health once per second for 5 seconds; this effect refreshes instead of stacking.' },
      { abilityId: 'cleric_purifying_rite', slot: 3, unlockLevel: 4, role: 'Cleanse', description: 'Remove one poison, burn, bleed, slow, or weakness effect.' },
      { abilityId: 'cleric_sacred_aegis', slot: 4, unlockLevel: 6, role: 'Protection', description: 'Reduce incoming damage by 35% for 4 seconds.' },
    ],
  },
  MONK: {
    classId: 'MONK',
    name: 'Pankratiast',
    identity: 'A fast, unarmed arena fighter who rewards a steady close-range rhythm and well-timed counters.',
    passive: { id: 'flow_state', name: 'Flow State', description: 'A successful physical melee action builds one stack, up to five. Each stack adds 3% physical damage for 1.6 seconds; timed hits within one action only build once.' },
    archetypes: [
      { name: 'Fast Combo', description: 'Keep Flow State alive with Pankration Strike and spend the window on Twin Palm.' },
      { name: 'Counter Fighter', description: 'Use Grappler’s Counter during an enemy windup or dodge window, then answer with a melee strike.' },
      { name: 'Mobility', description: 'Use Olympian Kick to close a short gap and Champion’s Rush to sustain a brief speed window.' },
    ],
    skills: [
      { abilityId: 'monk_flying_kick', slot: 1, unlockLevel: 1, role: 'Lunge / knockback', description: 'Advance up to 0.55m and kick one foe back up to 0.65m.' },
      { abilityId: 'monk_twin_palm', slot: 2, unlockLevel: 2, role: 'Timed combo', description: 'Two separate palm-hit windows, each dealing 56% damage.' },
      { abilityId: 'monk_grapplers_counter', slot: 3, unlockLevel: 4, role: 'Reactive counter', description: 'Use during a dodge window or a nearby enemy windup for guard and one empowered melee counter.' },
      { abilityId: 'monk_champions_rush', slot: 4, unlockLevel: 6, role: 'Mobility / speed', description: 'Gain 20% movement and action speed for 4 seconds.' },
    ],
  },
  NECROMANCER: {
    classId: 'NECROMANCER',
    name: 'Shadebinder',
    identity: 'A chthonic spellcaster who marks a single foe, converts measured kills into one burst, and wards against retaliation.',
    passive: { id: 'soul_tribute', name: 'Soul Tribute', description: 'Every 3 rewarded kills grant one charge for 4 seconds. Your next spell gains 20% damage; charges are limited to one and the passive has a 10-second cooldown.' },
    archetypes: [
      { name: 'Curse Burst', description: 'Apply Shade Mark, then detonate Death Burst for 35% extra damage to cursed foes.' },
      { name: 'Drain Sustain', description: 'Use Hades’ Grasp to recover up to 5 health on a hit and keep the capped unique heal hook relevant.' },
      { name: 'Soul Ward', description: 'Use Soul Ward to blunt a telegraphed threat while keeping the kill-earned charge for a spell.' },
    ],
    skills: [
      { abilityId: 'necromancer_corpse_burst', slot: 1, unlockLevel: 1, role: 'Chthonic area', description: 'Detonate an aimed blast with Underworld VFX.' },
      { abilityId: 'necromancer_shade_mark', slot: 2, unlockLevel: 2, role: 'Curse', description: 'Cause a marked foe to take 20% more damage for 5 seconds; bosses resist half.' },
      { abilityId: 'necromancer_death_burst', slot: 3, unlockLevel: 4, role: 'Curse burst', description: 'An aimed blast deals 35% extra damage to cursed targets.' },
      { abilityId: 'necromancer_soul_ward', slot: 4, unlockLevel: 6, role: 'Defense', description: 'Reduce incoming damage by 28% for 3 seconds.' },
    ],
  },
};

export function getClassSkillKit(classId: ClassType): ClassSkillKit | undefined {
  return CLASS_SKILL_KITS[classId];
}

export function getClassSkill(classId: ClassType, abilityId: string): ClassSkillDefinition | undefined {
  return getClassSkillKit(classId)?.skills.find(skill => skill.abilityId === abilityId);
}

