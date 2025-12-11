
import { Skill, CharacterTemplate, Item } from './types';

export const MAP_SIZE = 12;
export const VIEW_DISTANCE = 4;

export const PREFER_AI_GENERATION = false; 

export const ASSET_LIBRARY: any = {
    hands: { left: "", right: "" },
    torch: "",
    biome_dungeon: { wall: "", floor: "", ceiling: "", door: "" },
    biome_mossy: { wall: "", floor: "", ceiling: "", door: "" },
    biome_obsidian: { wall: "", floor: "", ceiling: "", door: "" },
    enemies: { "Rat": "", "Spider": "", "Goblin": "", "Skeleton": "", "Orc": "", "Shadow": "" }
};

// --- SKILLS ---

export const MASTER_SKILL_POOL: Skill[] = [
    // --- INT SKILLS (Magic / Elemental / Utility) ---
    { id: 'fireball', name: 'Fireball', type: 'DAMAGE', targetType: 'SINGLE', cost: 8, basePower: 16, scaling: 1.4, scalingStat: 'INT', description: 'Hurls fire. Chance to burn.', level: 1, maxLevel: 5, vfxType: 'FIREBALL', effect: { type: 'BURN', duration: 3, chance: 0.6, val: 5 } },
    { id: 'ice_shard', name: 'Ice Shard', type: 'DAMAGE', targetType: 'SINGLE', cost: 5, basePower: 10, scaling: 1.0, scalingStat: 'INT', description: 'Quick frozen projectile.', level: 1, maxLevel: 5, vfxType: 'ICE' },
    { id: 'frost_nova', name: 'Frost Nova', type: 'DAMAGE', targetType: 'MULTI', cost: 15, basePower: 8, scaling: 0.8, scalingStat: 'INT', description: 'Freezes all enemies.', level: 1, maxLevel: 5, vfxType: 'ICE', effect: { type: 'STUN', duration: 1, chance: 0.3, val: 0 } },
    { id: 'thunder', name: 'Thunder', type: 'DAMAGE', targetType: 'SINGLE', cost: 12, basePower: 24, scaling: 1.7, scalingStat: 'INT', description: 'Heavy lightning damage.', level: 1, maxLevel: 5, vfxType: 'LIGHTNING' },
    { id: 'chain_lightning', name: 'Chain Lightning', type: 'DAMAGE', targetType: 'MULTI', cost: 18, basePower: 14, scaling: 1.2, scalingStat: 'INT', description: 'Arcs between enemies.', level: 1, maxLevel: 5, vfxType: 'LIGHTNING' },
    { id: 'firestorm', name: 'Firestorm', type: 'DAMAGE', targetType: 'MULTI', cost: 20, basePower: 18, scaling: 1.2, scalingStat: 'INT', description: 'Burn all enemies.', level: 1, maxLevel: 5, vfxType: 'FIREBALL', effect: { type: 'BURN', duration: 3, chance: 0.4, val: 5 } },
    { id: 'meteor', name: 'Meteor', type: 'DAMAGE', targetType: 'SINGLE', cost: 30, basePower: 40, scaling: 2.0, scalingStat: 'INT', description: 'Massive single target dmg.', level: 1, maxLevel: 5, vfxType: 'FIREBALL' },
    { id: 'arcane_ward', name: 'Arcane Ward', type: 'BUFF', targetType: 'ALLY', cost: 10, basePower: 0, scaling: 1.2, scalingStat: 'INT', description: 'Magical shield reduces dmg.', level: 1, maxLevel: 3, vfxType: 'BUFF', effect: { type: 'SHIELD', duration: 4, chance: 1.0, val: 15 } },
    { id: 'heal', name: 'Restoration', type: 'HEAL', targetType: 'ALLY', cost: 12, basePower: 30, scaling: 1.4, scalingStat: 'INT', description: 'Restores HP.', level: 1, maxLevel: 5, vfxType: 'HEAL' },
    { id: 'group_heal', name: 'Healing Rain', type: 'HEAL', targetType: 'ALLY', cost: 25, basePower: 15, scaling: 1.0, scalingStat: 'INT', description: 'Heals everyone slightly.', level: 1, maxLevel: 5, vfxType: 'HEAL' },
    { id: 'regen_aura', name: 'Regrowth', type: 'BUFF', targetType: 'ALLY', cost: 12, basePower: 0, scaling: 0.8, scalingStat: 'INT', description: 'Heals over time.', level: 1, maxLevel: 3, vfxType: 'BUFF', effect: { type: 'REGEN', duration: 5, chance: 1.0, val: 8 } },

    // --- NECROMANCER SKILLS (Dark / Drain) ---
    { id: 'life_drain', name: 'Life Drain', type: 'DRAIN', targetType: 'SINGLE', cost: 10, basePower: 12, scaling: 1.0, scalingStat: 'INT', description: 'Steals health from enemy.', level: 1, maxLevel: 5, vfxType: 'DARK' },
    { id: 'bone_spear', name: 'Bone Spear', type: 'DAMAGE', targetType: 'SINGLE', cost: 8, basePower: 18, scaling: 1.3, scalingStat: 'INT', description: 'Piercing bone projectile.', level: 1, maxLevel: 5, vfxType: 'ATTACK' },
    { id: 'decay', name: 'Curse of Decay', type: 'DAMAGE', targetType: 'SINGLE', cost: 12, basePower: 5, scaling: 0.5, scalingStat: 'INT', description: 'Heavy poison damage.', level: 1, maxLevel: 5, vfxType: 'POISON', effect: { type: 'POISON', duration: 5, chance: 1.0, val: 12 } },
    { id: 'soul_pact', name: 'Soul Pact', type: 'BUFF', targetType: 'SELF', cost: 0, basePower: 0, scaling: 1.0, scalingStat: 'INT', description: 'Sacrifice HP for MP.', level: 1, maxLevel: 3, vfxType: 'DARK', effect: { type: 'REGEN', duration: 1, chance: 1.0, val: 20 } }, // Custom logic handled in App.tsx potentially or just generic buff
    { id: 'dark_nova', name: 'Dark Nova', type: 'DAMAGE', targetType: 'MULTI', cost: 22, basePower: 20, scaling: 1.1, scalingStat: 'INT', description: 'Dark energy explosion.', level: 1, maxLevel: 5, vfxType: 'DARK' },
    { id: 'weaken', name: 'Weaken', type: 'DEBUFF', targetType: 'SINGLE', cost: 10, basePower: 0, scaling: 1.0, scalingStat: 'INT', description: 'Reduces enemy damage.', level: 1, maxLevel: 3, vfxType: 'DEBUFF', effect: { type: 'WEAKNESS', duration: 4, chance: 1.0, val: 10 } },

    // --- STR SKILLS (Physical / Tank / Heavy) ---
    { id: 'bash', name: 'Shield Bash', type: 'DAMAGE', targetType: 'SINGLE', cost: 6, basePower: 12, scaling: 1.2, scalingStat: 'STR', description: 'Stunning heavy hit.', level: 1, maxLevel: 5, vfxType: 'ATTACK', effect: { type: 'STUN', duration: 1, chance: 0.5, val: 0 } },
    { id: 'heavy_slash', name: 'Heavy Slash', type: 'DAMAGE', targetType: 'SINGLE', cost: 8, basePower: 18, scaling: 1.4, scalingStat: 'STR', description: 'Powerful weapon swing.', level: 1, maxLevel: 5, vfxType: 'ATTACK' },
    { id: 'execute', name: 'Execute', type: 'DAMAGE', targetType: 'SINGLE', cost: 15, basePower: 25, scaling: 1.8, scalingStat: 'STR', description: 'Devastating blow.', level: 1, maxLevel: 5, vfxType: 'ATTACK' },
    { id: 'cleave', name: 'Cleave', type: 'DAMAGE', targetType: 'MULTI', cost: 12, basePower: 14, scaling: 1.0, scalingStat: 'STR', description: 'Hit all enemies.', level: 1, maxLevel: 5, vfxType: 'ATTACK' },
    { id: 'whirlwind', name: 'Whirlwind', type: 'DAMAGE', targetType: 'MULTI', cost: 18, basePower: 16, scaling: 1.1, scalingStat: 'STR', description: 'Spin attack hitting all.', level: 1, maxLevel: 5, vfxType: 'ATTACK' },
    { id: 'iron_skin', name: 'Iron Skin', type: 'BUFF', targetType: 'SELF', cost: 8, basePower: 0, scaling: 1.0, scalingStat: 'STR', description: 'Reduces physical damage.', level: 1, maxLevel: 3, vfxType: 'BUFF', effect: { type: 'SHIELD', duration: 4, chance: 1.0, val: 20 } },
    { id: 'rally', name: 'War Cry', type: 'BUFF', targetType: 'SELF', cost: 15, basePower: 0, scaling: 0.5, scalingStat: 'STR', description: 'Buffs Strength.', level: 1, maxLevel: 3, vfxType: 'BUFF', effect: { type: 'STRENGTH', duration: 3, chance: 1.0, val: 6 } },
    { id: 'sacrifice', name: 'Sacrifice', type: 'DAMAGE', targetType: 'SINGLE', cost: 0, basePower: 35, scaling: 1.5, scalingStat: 'STR', description: 'Cost HP to deal dmg.', level: 1, maxLevel: 5, vfxType: 'HOLY' }, // Logic: Costs HP
    { id: 'smite', name: 'Holy Smite', type: 'DAMAGE', targetType: 'SINGLE', cost: 10, basePower: 20, scaling: 1.2, scalingStat: 'STR', description: 'Divine damage.', level: 1, maxLevel: 5, vfxType: 'HOLY' },
    { id: 'consecration', name: 'Consecration', type: 'DAMAGE', targetType: 'MULTI', cost: 20, basePower: 15, scaling: 1.0, scalingStat: 'STR', description: 'Holy ground damage.', level: 1, maxLevel: 5, vfxType: 'HOLY' },

    // --- DEX SKILLS (Speed / Crit / Evasion) ---
    { id: 'backstab', name: 'Backstab', type: 'DAMAGE', targetType: 'SINGLE', cost: 10, basePower: 22, scaling: 1.6, scalingStat: 'DEX', description: 'High critical damage.', level: 1, maxLevel: 5, vfxType: 'ATTACK' },
    { id: 'shiv', name: 'Shiv', type: 'DAMAGE', targetType: 'SINGLE', cost: 4, basePower: 8, scaling: 1.0, scalingStat: 'DEX', description: 'Low cost, fast hit.', level: 1, maxLevel: 5, vfxType: 'ATTACK' },
    { id: 'poison_tip', name: 'Poison Edge', type: 'DAMAGE', targetType: 'SINGLE', cost: 6, basePower: 8, scaling: 0.7, scalingStat: 'DEX', description: 'Applies strong poison.', level: 1, maxLevel: 5, vfxType: 'POISON', effect: { type: 'POISON', duration: 4, chance: 1.0, val: 8 } },
    { id: 'venom_spray', name: 'Venom Spray', type: 'DAMAGE', targetType: 'MULTI', cost: 14, basePower: 6, scaling: 0.6, scalingStat: 'DEX', description: 'Poisons all enemies.', level: 1, maxLevel: 5, vfxType: 'POISON', effect: { type: 'POISON', duration: 3, chance: 0.8, val: 6 } },
    { id: 'arrow_rain', name: 'Arrow Rain', type: 'DAMAGE', targetType: 'MULTI', cost: 14, basePower: 12, scaling: 1.1, scalingStat: 'DEX', description: 'Shower enemies with arrows.', level: 1, maxLevel: 5, vfxType: 'ATTACK' },
    { id: 'multishot', name: 'Multishot', type: 'DAMAGE', targetType: 'MULTI', cost: 10, basePower: 10, scaling: 1.0, scalingStat: 'DEX', description: 'Hit random targets.', level: 1, maxLevel: 5, vfxType: 'ATTACK' },
    { id: 'flurry', name: 'Flurry', type: 'DAMAGE', targetType: 'SINGLE', cost: 6, basePower: 8, scaling: 1.1, scalingStat: 'DEX', description: 'Rapid multi-hits.', level: 1, maxLevel: 5, vfxType: 'ATTACK' },
    { id: 'blur', name: 'Blur', type: 'BUFF', targetType: 'SELF', cost: 8, basePower: 0, scaling: 0.8, scalingStat: 'DEX', description: 'Increases evasion (Shield).', level: 1, maxLevel: 3, vfxType: 'BUFF', effect: { type: 'SHIELD', duration: 3, chance: 1.0, val: 25 } },
    { id: 'focus', name: 'Focus', type: 'BUFF', targetType: 'SELF', cost: 0, basePower: 10, scaling: 1.0, scalingStat: 'DEX', description: 'Restores MP.', level: 1, maxLevel: 1, vfxType: 'HEAL', effect: { type: 'REGEN', duration: 3, chance: 1.0, val: 8 } }
];

// --- CLASSES ---

export const CLASSES: Record<string, CharacterTemplate> = {
    BARBARIAN: {
        name: 'Barbarian',
        description: 'STR. High HP/Dmg. Tanky.',
        stats: { hp: 130, maxHp: 130, mp: 20, maxMp: 20, str: 14, dex: 10, int: 6, xp: 0, level: 1 },
        startItems: [
            { id: 'axe_start', name: 'Battle Axe', type: 'WEAPON', value: 5, description: 'Heavy chopper.', icon: '🪓', quantity: 1 }
        ],
        startSkills: [
            MASTER_SKILL_POOL.find(s => s.id === 'heavy_slash')!, 
            MASTER_SKILL_POOL.find(s => s.id === 'iron_skin')!   
        ]
    },
    PALADIN: {
        name: 'Paladin',
        description: 'STR/INT. Holy Knight.',
        stats: { hp: 110, maxHp: 110, mp: 40, maxMp: 40, str: 12, dex: 8, int: 10, xp: 0, level: 1 },
        startItems: [
            { id: 'mace_start', name: 'Iron Mace', type: 'WEAPON', value: 4, description: 'Crushes bones.', icon: '🔨', quantity: 1 },
            { id: 'shield_start', name: 'Kite Shield', type: 'SHIELD', value: 2, description: 'Basic protection.', icon: '🛡️', quantity: 1 }
        ],
        startSkills: [
            MASTER_SKILL_POOL.find(s => s.id === 'smite')!, 
            MASTER_SKILL_POOL.find(s => s.id === 'heal')!   
        ]
    },
    SORCERER: {
        name: 'Sorcerer',
        description: 'INT. High Magic Damage.',
        stats: { hp: 80, maxHp: 80, mp: 80, maxMp: 80, str: 6, dex: 12, int: 15, xp: 0, level: 1 },
        startItems: [
            { id: 'staff_start', name: 'Wooden Staff', type: 'WEAPON', value: 2, description: 'Focus for magic.', icon: '🪄', quantity: 1 },
            { id: 'potion_mp', name: 'Mana Potion', type: 'POTION', value: 30, description: 'Restores MP', icon: '🧪', quantity: 1 }
        ],
        startSkills: [
            MASTER_SKILL_POOL.find(s => s.id === 'fireball')!, 
            MASTER_SKILL_POOL.find(s => s.id === 'arcane_ward')! 
        ]
    },
    ROGUE: {
        name: 'Rogue',
        description: 'DEX. Stealth & Crits.',
        stats: { hp: 90, maxHp: 90, mp: 40, maxMp: 40, str: 8, dex: 15, int: 8, xp: 0, level: 1 },
        startItems: [
            { id: 'dagger_start', name: 'Iron Dagger', type: 'WEAPON', value: 4, description: 'Sharp edge.', icon: '🗡️', quantity: 1 }
        ],
        startSkills: [
            MASTER_SKILL_POOL.find(s => s.id === 'backstab')!, 
            MASTER_SKILL_POOL.find(s => s.id === 'blur')!      
        ]
    },
    RANGER: {
        name: 'Ranger',
        description: 'DEX. Ranged Attacks.',
        stats: { hp: 100, maxHp: 100, mp: 50, maxMp: 50, str: 10, dex: 14, int: 10, xp: 0, level: 1 },
        startItems: [
            { id: 'bow_start', name: 'Short Bow', type: 'WEAPON', value: 4, description: 'Ranged attack.', icon: '🏹', quantity: 1 }
        ],
        startSkills: [
            MASTER_SKILL_POOL.find(s => s.id === 'arrow_rain')!, 
            MASTER_SKILL_POOL.find(s => s.id === 'blur')!        
        ]
    },
    CLERIC: {
        name: 'Cleric',
        description: 'INT/STR. Healer & Tank.',
        stats: { hp: 100, maxHp: 100, mp: 60, maxMp: 60, str: 11, dex: 9, int: 12, xp: 0, level: 1 },
        startItems: [
            { id: 'hammer_start', name: 'War Hammer', type: 'WEAPON', value: 5, description: 'Heavy hitter.', icon: '⚒️', quantity: 1 }
        ],
        startSkills: [
            MASTER_SKILL_POOL.find(s => s.id === 'smite')!, 
            MASTER_SKILL_POOL.find(s => s.id === 'heal')!   
        ]
    },
    MONK: {
        name: 'Monk',
        description: 'DEX/STR. Fast Fighter.',
        stats: { hp: 110, maxHp: 110, mp: 30, maxMp: 30, str: 12, dex: 14, int: 8, xp: 0, level: 1 },
        startItems: [
            { id: 'gloves_start', name: 'Leather Wraps', type: 'WEAPON', value: 3, description: 'Fast attacks.', icon: '🥊', quantity: 1 },
            { id: 'potion_hp', name: 'Health Potion', type: 'POTION', value: 30, description: 'Restores HP', icon: '🍷', quantity: 1 }
        ],
        startSkills: [
            MASTER_SKILL_POOL.find(s => s.id === 'flurry')!, 
            MASTER_SKILL_POOL.find(s => s.id === 'focus')!   
        ]
    },
    NECROMANCER: {
        name: 'Necromancer',
        description: 'INT. Life drain & Dark magic.',
        stats: { hp: 90, maxHp: 90, mp: 60, maxMp: 60, str: 6, dex: 10, int: 14, xp: 0, level: 1 },
        startItems: [
            { id: 'wand_bone', name: 'Bone Wand', type: 'WEAPON', value: 3, description: 'Channel dark energy.', icon: '🦴', quantity: 1 },
            { id: 'potion_mp', name: 'Mana Potion', type: 'POTION', value: 30, description: 'Restores MP', icon: '🧪', quantity: 1 }
        ],
        startSkills: [
            MASTER_SKILL_POOL.find(s => s.id === 'life_drain')!,
            MASTER_SKILL_POOL.find(s => s.id === 'bone_spear')!
        ]
    }
};

export const MOCK_TEXTURES = {
    wall: '#444444',
    floor: '#222222',
    ceiling: '#111111',
    door: '#5c4033'
}
