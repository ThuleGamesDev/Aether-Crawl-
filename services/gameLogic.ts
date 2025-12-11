
import { Item, HighScore, SaveData, Enemy } from '../types';

// Reduced XP requirement (was level * 100)
export const XP_THRESHOLD = (level: number) => level * 50;

export const CRAFTING_RECIPES = [
    { id: 'potion_hp', name: 'Health Potion', cost: 50, type: 'POTION', desc: 'Restores 30 HP' },
    { id: 'potion_mp', name: 'Mana Potion', cost: 50, type: 'POTION', desc: 'Restores 30 MP' },
    { id: 'gamble_weapon', name: 'Mystery Weapon', cost: 150, type: 'WEAPON', desc: 'Random Weapon' },
    { id: 'gamble_armor', name: 'Mystery Armor', cost: 150, type: 'ARMOR', desc: 'Random Armor' },
    { id: 'gamble_access', name: 'Mystery Relic', cost: 200, type: 'ACCESSORY', desc: 'Random Accessory' }
];

export const generateLoot = (level: number, isBoss = false): Item | null => {
    // 30% chance of no loot for normal enemies
    if (!isBoss && Math.random() > 0.7) return null;

    // Bosses drop higher tier loot
    const tierBonus = isBoss ? 1 : 0;
    const tier = Math.floor(level / 3) + 1 + tierBonus;
    const rand = Math.random();

    if (rand < 0.25) {
        // Potions
        if (Math.random() > 0.5) {
             return { id: `potion_hp`, name: 'Health Potion', description: 'Restores 30 HP', type: 'POTION', value: 30, icon: '🍷', quantity: 1 };
        } else {
             return { id: `potion_mp`, name: 'Mana Potion', description: 'Restores 30 MP', type: 'POTION', value: 30, icon: '🧪', quantity: 1 };
        }
    } else if (rand < 0.45) {
        // Weapon
        const wRand = Math.random();
        let name = "Blade";
        let icon = "🗡️";
        if (wRand > 0.6) { name = "Mace"; icon = "🔨"; }
        else if (wRand > 0.3) { name = "Dagger"; icon = "🔪"; }

        return {
            id: `weapon_t${tier}_${Date.now()}`,
            name: `${name} +${tier}`,
            description: 'Deadly weapon.',
            type: 'WEAPON',
            value: 5 + (tier * 2),
            icon: icon,
            quantity: 1
        };
    } else if (rand < 0.65) {
        // Armor
        return {
            id: `armor_t${tier}_${Date.now()}`,
            name: `Armor +${tier}`,
            description: 'Protective gear.',
            type: 'ARMOR',
            value: 2 + tier,
            icon: '👕',
            quantity: 1
        };
    } else if (rand < 0.8) {
        // Shield
        return {
            id: `shield_t${tier}_${Date.now()}`,
            name: `Shield +${tier}`,
            description: 'Blocks damage.',
            type: 'SHIELD',
            value: 1 + tier,
            icon: '🛡️',
            quantity: 1
        };
    } else {
        // Accessory
        const accType = Math.random();
        if (accType < 0.25) {
            return { id: `ring_str_${tier}_${Date.now()}`, name: `Ring of Might +${tier}`, description: 'Boosts Strength.', type: 'ACCESSORY', value: tier, statBonus: 'STR', icon: '💍', quantity: 1 };
        } else if (accType < 0.5) {
            return { id: `amulet_int_${tier}_${Date.now()}`, name: `Amulet of Wisdom +${tier}`, description: 'Boosts Intelligence.', type: 'ACCESSORY', value: tier, statBonus: 'INT', icon: '📿', quantity: 1 };
        } else if (accType < 0.75) {
            return { id: `charm_dex_${tier}_${Date.now()}`, name: `Charm of Speed +${tier}`, description: 'Boosts Dexterity.', type: 'ACCESSORY', value: tier, statBonus: 'DEX', icon: '🧿', quantity: 1 };
        } else {
             return { id: `ring_hp_${tier}_${Date.now()}`, name: `Ring of Life +${tier}`, description: 'Boosts Max HP.', type: 'ACCESSORY', value: tier * 10, statBonus: 'HP', icon: '💍', quantity: 1 };
        }
    }
};

const LB_KEY = 'aether_crawl_leaderboard';
const SAVE_KEY = 'aether_crawl_save_v1';

export const getLeaderboard = (): HighScore[] => {
    try {
        const data = localStorage.getItem(LB_KEY);
        if (!data) return [];
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
};

export const saveHighScore = (score: HighScore) => {
    const scores = getLeaderboard();
    scores.push(score);
    // Sort by Dungeon Level desc, then XP desc
    scores.sort((a, b) => {
        if (b.dungeonLevel !== a.dungeonLevel) return b.dungeonLevel - a.dungeonLevel;
        return b.xp - a.xp;
    });
    // Keep top 10
    const top10 = scores.slice(0, 10);
    localStorage.setItem(LB_KEY, JSON.stringify(top10));
    return top10;
};

export const saveGame = (data: SaveData) => {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        return true;
    } catch (e) {
        console.error("Save failed", e);
        return false;
    }
};

export const loadGame = (): SaveData | null => {
    try {
        const data = localStorage.getItem(SAVE_KEY);
        if (!data) return null;
        return JSON.parse(data);
    } catch (e) {
        return null;
    }
};

export const hasSaveGame = (): boolean => {
    return !!localStorage.getItem(SAVE_KEY);
};

// Internal templates to ensure variety if AI fails
export const FALLBACK_ENEMIES = [
    { name: "Giant Rat", hp: 15, damage: 4, xp: 10, minLvl: 1 },
    { name: "Acid Spider", hp: 25, damage: 6, xp: 15, minLvl: 1 },
    { name: "Goblin Scavenger", hp: 40, damage: 8, xp: 20, minLvl: 2 },
    { name: "Skeleton Warrior", hp: 60, damage: 10, xp: 30, minLvl: 3 },
    { name: "Bandit Rogue", hp: 50, damage: 12, xp: 35, minLvl: 4 },
    { name: "Orc Brute", hp: 100, damage: 15, xp: 50, minLvl: 5 },
    { name: "Dark Cultist", hp: 80, damage: 20, xp: 60, minLvl: 6 },
    { name: "Green Slime", hp: 120, damage: 8, xp: 60, minLvl: 7 },
    { name: "Cave Troll", hp: 200, damage: 25, xp: 100, minLvl: 8 },
    { name: "Fire Elemental", hp: 150, damage: 30, xp: 120, minLvl: 9 },
    { name: "Specter", hp: 100, damage: 30, xp: 110, minLvl: 10 },
    { name: "Stone Golem", hp: 300, damage: 20, xp: 150, minLvl: 11 },
    { name: "Vampire Spawn", hp: 180, damage: 35, xp: 180, minLvl: 13 },
    { name: "Beholder", hp: 250, damage: 45, xp: 250, minLvl: 15 },
    { name: "Ice Elemental", hp: 280, damage: 35, xp: 220, minLvl: 18 },
    { name: "Void Dragon", hp: 500, damage: 40, xp: 500, minLvl: 20 },
    { name: "Chaos Knight", hp: 600, damage: 60, xp: 600, minLvl: 25 },
];

export const MINI_BOSS_TEMPLATES = [
    { name: "Dungeon Warden", hp: 120, damage: 15, xp: 100 },
    { name: "Giant Slime", hp: 150, damage: 12, xp: 100 },
    { name: "Cursed Knight", hp: 140, damage: 18, xp: 120 },
    { name: "Bandit King", hp: 130, damage: 20, xp: 130 },
    { name: "Mimic Queen", hp: 200, damage: 25, xp: 200 },
];

export const BIOME_BOSS_TEMPLATES = [
    { name: "The Necromancer", hp: 400, damage: 25, xp: 500 }, // Lvl 5
    { name: "Moss Golem", hp: 600, damage: 30, xp: 800 },     // Lvl 10
    { name: "Lich Lord", hp: 800, damage: 40, xp: 1200 },      // Lvl 15 (Catacomb)
    { name: "Frost Giant", hp: 1000, damage: 45, xp: 1600 },    // Lvl 20 (Ice)
    { name: "Golden Emperor", hp: 1500, damage: 55, xp: 2500 }, // Lvl 25 (Gilded)
    { name: "Obsidian Lord", hp: 2000, damage: 70, xp: 3000 },  // Lvl 30+
];

export const generateBoss = (level: number, isBiomeBoss: boolean): Enemy => {
    let template;
    if (isBiomeBoss) {
        // Every 5 levels
        const idx = Math.min(Math.floor(level / 5) - 1, BIOME_BOSS_TEMPLATES.length - 1);
        template = BIOME_BOSS_TEMPLATES[Math.max(0, idx)];
    } else {
        template = MINI_BOSS_TEMPLATES[Math.floor(Math.random() * MINI_BOSS_TEMPLATES.length)];
    }

    // Scale slightly by level
    const scale = 1 + (level * 0.1);
    
    return {
        id: `boss_${Date.now()}`,
        name: template.name,
        hp: Math.floor(template.hp * scale),
        maxHp: Math.floor(template.hp * scale),
        damage: Math.floor(template.damage * scale),
        xpReward: Math.floor(template.xp * scale),
        image: '', // Will be generated
        isBoss: true,
        statusEffects: []
    };
};
