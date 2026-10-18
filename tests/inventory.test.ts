import { describe, expect, it } from "vitest";
import {
  addInventoryItem,
  equipInventoryItem,
  scrapInventoryItem,
} from "../services/inventory";
import { CLASSES } from "../constants";
import type { Character, Item, Player } from "../types";
const ring = (id: string, value = 2, quantity = 1): Item => ({
  id,
  name: "Sigil",
  type: "ACCESSORY",
  statBonus: "STR",
  value,
  quantity,
  description: "",
});
function player(inventory: Item[]): Player {
  const hero: Character = {
    id: "hero",
    name: "Paladin",
    classType: "PALADIN",
    stats: { ...CLASSES.PALADIN.stats },
    equipment: { weapon: null, offhand: null, armor: null, accessory: null },
    skills: [],
    statusEffects: [],
    isDefending: false,
  };
  return { pos: { x: 1, y: 1 }, dir: "E", party: [hero], inventory, scrap: 0 };
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

describe("run inventory transactions", () => {
  it("equips one item from a stack and applies one bonus even when React replays an updater", () => {
    const p = freeze(player([ring("sigil", 2, 3)]));
    const a = equipInventoryItem(p, "sigil", 0),
      b = equipInventoryItem(p, "sigil", 0);
    expect(a).toEqual(b);
    expect(a.inventory[0].quantity).toBe(2);
    expect(a.party[0].equipment.accessory?.quantity).toBe(1);
    expect(a.party[0].stats.str).toBe(p.party[0].stats.str + 2);
    expect(p.inventory[0].quantity).toBe(3);
  });
  it("conserves item counts and removes old bonuses when switching accessory stats", () => {
    const p = player([
      ring("a", 2, 2),
      { ...ring("b", 5), name: "Wisdom", statBonus: "INT" },
    ]);
    const first = equipInventoryItem(p, "a", 0),
      second = equipInventoryItem(freeze(first), "b", 0);
    expect(second.party[0].stats.str).toBe(p.party[0].stats.str);
    expect(second.party[0].stats.int).toBe(p.party[0].stats.int + 5);
    expect(second.inventory.find((i) => i.id === "a")?.quantity).toBe(2);
    expect(second.inventory.find((i) => i.id === "b")).toBeUndefined();
    const returned = equipInventoryItem(second, "a", 0);
    expect(returned.party[0].stats).toEqual(first.party[0].stats);
  });
  it("merges equivalent loot without mutating rewards or merging differently powered namesakes", () => {
    const p = freeze(player([ring("a")])),
      reward = freeze(ring("b"));
    expect(addInventoryItem(p, reward)).toEqual(addInventoryItem(p, reward));
    expect(addInventoryItem(p, reward).inventory[0].quantity).toBe(2);
    expect(p.inventory[0].quantity).toBe(1);
    expect(addInventoryItem(p, ring("c", 4)).inventory).toHaveLength(2);
  });
  it("scraps exactly one unit for 10 scrap and preserves invalid requests", () => {
    const p = freeze(player([ring("a", 2, 2)]));
    const a = scrapInventoryItem(p, "a");
    expect(a.scrap).toBe(10);
    expect(a.inventory[0].quantity).toBe(1);
    expect(a).toEqual(scrapInventoryItem(p, "a"));
    expect(scrapInventoryItem(a, "missing")).toBe(a);
    expect(equipInventoryItem(p, "a", 99)).toBe(p);
  });
  it("clamps current resources when replacing maximum-resource accessories without reviving", () => {
    const hp = { ...ring("hp", 30), name: "Health", statBonus: "HP" as const };
    let p = equipInventoryItem(player([hp, ring("str")]), "hp", 0);
    p.party[0].stats.hp = p.party[0].stats.maxHp;
    const removed = equipInventoryItem(freeze(p), "str", 0);
    expect(removed.party[0].stats.hp).toBe(CLASSES.PALADIN.stats.maxHp);
    const dead = player([hp]);
    dead.party[0].stats.hp = 0;
    expect(equipInventoryItem(dead, "hp", 0).party[0].stats.hp).toBe(0);
  });
});
