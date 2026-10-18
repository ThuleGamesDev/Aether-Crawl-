import type { Character, Item, Player } from "../types";

type Slot = keyof Character["equipment"];
const slots: Partial<Record<Item["type"], Slot>> = {
  WEAPON: "weapon",
  ARMOR: "armor",
  SHIELD: "offhand",
  ACCESSORY: "accessory",
};
const bonusStats = {
  STR: "str",
  DEX: "dex",
  INT: "int",
  HP: "maxHp",
  MP: "maxMp",
} as const;
const sameStack = (a: Item, b: Item) =>
  a.name === b.name &&
  a.type === b.type &&
  a.value === b.value &&
  a.statBonus === b.statBonus &&
  a.armorWeight === b.armorWeight &&
  a.visualType === b.visualType;

/** React may replay an updater. Never mutate a bag entry or the incoming reward. */
export function addInventoryItem(player: Player, item: Item): Player {
  if (item.quantity <= 0) return player;
  const existing = player.inventory.findIndex((i) => sameStack(i, item));
  const inventory = player.inventory.map((i, index) =>
    index === existing ? { ...i, quantity: i.quantity + item.quantity } : i,
  );
  if (existing < 0) inventory.push({ ...item, isEquipped: false });
  return { ...player, inventory };
}

/** Equip exactly one unit and return exactly one old unit. Base bonuses remain reversible. */
export function equipInventoryItem(
  player: Player,
  itemId: string,
  charIndex: number,
): Player {
  const hero = player.party[charIndex],
    item = player.inventory.find((i) => i.id === itemId && i.quantity > 0);
  const slot = item && slots[item.type];
  if (!hero || !item || !slot) return player;
  const previous = hero.equipment[slot];
  const stats = { ...hero.stats };
  const bonus = (equipment: Item | null, sign: number) => {
    if (equipment?.type === "ACCESSORY" && equipment.statBonus)
      stats[bonusStats[equipment.statBonus]] += equipment.value * sign;
  };
  bonus(previous, -1);
  bonus(item, 1);
  stats.maxHp = Math.max(1, stats.maxHp);
  stats.maxMp = Math.max(0, stats.maxMp);
  stats.hp = Math.min(stats.hp, stats.maxHp);
  stats.mp = Math.min(stats.mp, stats.maxMp);
  const equipped = { ...item, quantity: 1, isEquipped: true };
  const nextHero = {
    ...hero,
    stats,
    equipment: { ...hero.equipment, [slot]: equipped },
  };
  let next: Player = {
    ...player,
    party: player.party.map((h, index) => (index === charIndex ? nextHero : h)),
    inventory: player.inventory.flatMap((i) =>
      i.id !== itemId
        ? [i]
        : i.quantity > 1
          ? [{ ...i, quantity: i.quantity - 1 }]
          : [],
    ),
  };
  if (previous)
    next = addInventoryItem(next, {
      ...previous,
      quantity: 1,
      isEquipped: false,
    });
  return next;
}

export function scrapInventoryItem(player: Player, itemId: string): Player {
  const item = player.inventory.find((i) => i.id === itemId && i.quantity > 0);
  if (!item) return player;
  return {
    ...player,
    scrap: player.scrap + 10,
    inventory: player.inventory.flatMap((i) =>
      i.id !== itemId
        ? [i]
        : i.quantity > 1
          ? [{ ...i, quantity: i.quantity - 1 }]
          : [],
    ),
  };
}
