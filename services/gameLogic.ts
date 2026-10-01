
import { Item, HighScore, SaveData, Enemy } from '../types';
import { enemyDefinitions, normalEnemyDefinitions, miniBossDefinitions, biomeBossDefinitions } from '../data/enemies';
import { serializeGameplayItem, normalizePlayerWeaponVisuals } from '../data/weaponVisuals';

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
            visualType: name === 'Mace' ? 'mace' : name === 'Dagger' ? 'dagger' : 'sword',
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
        const player = normalizePlayerWeaponVisuals(data.player);
        const savedPlayer = {
            ...player,
            inventory: player.inventory.map(serializeGameplayItem),
            party: player.party.map(character => ({
                ...character,
                equipment: {
                    weapon: character.equipment.weapon ? serializeGameplayItem(character.equipment.weapon) : null,
                    armor: character.equipment.armor ? serializeGameplayItem(character.equipment.armor) : null,
                    offhand: character.equipment.offhand ? serializeGameplayItem(character.equipment.offhand) : null,
                    accessory: character.equipment.accessory ? serializeGameplayItem(character.equipment.accessory) : null,
                },
            })),
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, player: savedPlayer }));
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
        const parsed = JSON.parse(data) as Partial<SaveData>;
        if (!parsed.player || !Array.isArray(parsed.map)) return null;
        return {
            ...parsed,
            player: normalizePlayerWeaponVisuals({
                ...parsed.player,
                pos: parsed.player.pos ?? { x: 1, y: 1 },
                dir: parsed.player.dir ?? 'E',
                party: Array.isArray(parsed.player.party) ? parsed.player.party : [],
                inventory: Array.isArray(parsed.player.inventory) ? parsed.player.inventory : [],
                scrap: Number.isFinite(parsed.player.scrap) ? parsed.player.scrap : 0,
            } as SaveData['player']),
            map: parsed.map,
            decorations: Array.isArray(parsed.decorations) ? parsed.decorations : [],
            explored: Array.isArray(parsed.explored) ? parsed.explored : [],
            clearedTiles: Array.isArray(parsed.clearedTiles) ? parsed.clearedTiles : [],
            dungeonLevel: Number.isFinite(parsed.dungeonLevel) && parsed.dungeonLevel! > 0 ? parsed.dungeonLevel! : 1,
            logs: Array.isArray(parsed.logs) ? parsed.logs : [],
            date: Number.isFinite(parsed.date) ? parsed.date! : Date.now(),
        } as SaveData;
    } catch (e) {
        return null;
    }
};

export const hasSaveGame = (): boolean => {
    return !!localStorage.getItem(SAVE_KEY);
};

let enemySequence = 0;

const instantiateEnemy = (definition: (typeof enemyDefinitions)[number], scale: number, isBoss: boolean): Enemy => {
    const hp = Math.floor(definition.hp * scale);
    return {
        id: `${isBoss ? 'boss' : 'enemy'}_${definition.id}_${++enemySequence}`,
        name: definition.name,
        hp,
        maxHp: hp,
        damage: Math.floor(definition.damage * scale),
        xpReward: Math.floor(definition.xp * scale),
        visualId: definition.visualId,
        isBoss,
        statusEffects: [],
    };
};

export const createRandomEnemy = (level: number): Enemy => {
    const available = normalEnemyDefinitions.filter(enemy => (enemy.minLevel ?? 1) <= level);
    const strongest = available[available.length - 1];
    const template = available.length > 1 && Math.random() < 0.3
        ? available[Math.floor(Math.random() * available.length)]
        : strongest;
    const scale = 1 + (level - (template.minLevel ?? 1)) * 0.1;
    return instantiateEnemy(template, scale, false);
};

export const createBoss = (level: number, isBiomeBoss: boolean): Enemy => {
    const template = isBiomeBoss
        ? biomeBossDefinitions[Math.max(0, Math.min(Math.floor(level / 5) - 1, biomeBossDefinitions.length - 1))]
        : miniBossDefinitions[Math.floor(Math.random() * miniBossDefinitions.length)];
    return instantiateEnemy(template, 1 + (level * 0.1), true);
};
