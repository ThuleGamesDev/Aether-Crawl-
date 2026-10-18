import { describe, expect, it } from "vitest";
import { CLASSES, MASTER_SKILL_POOL } from "../constants";
import {
  calculateEnemyAttack,
  calculateSkillPower,
  resolveStatusTurn,
  createStatusEffect,
  skillEffectValue,
  soulPactRestoration,
} from "../services/combat";
import { skillEffectSummary } from "../services/combatInput";
import { CombatRuntime } from "../services/combatRuntime";
import { createEnemyById } from "../services/gameLogic";
import type { Character, Player } from "../types";
const hero = (): Character => ({
  id: "hero",
  name: "Paladin",
  classType: "PALADIN",
  stats: { ...CLASSES.PALADIN.stats, initiative: 20 },
  equipment: { weapon: null, armor: null, offhand: null, accessory: null },
  statusEffects: [],
  skills: [],
  isDefending: false,
});
describe("earned skill ranks and defensive starter skills", () => {
  it("makes paid damage and healing upgrades stronger without changing rank-one power or MP cost", () => {
    const h = hero();
    for (const id of ["smite", "heal", "arrow_rain"]) {
      const skill = MASTER_SKILL_POOL.find((s) => s.id === id)!;
      const base = calculateSkillPower(h, skill),
        upgraded = { ...skill, level: 2 };
      expect(calculateSkillPower(h, upgraded)).toBe(Math.floor(base * 1.15));
      expect(upgraded.cost).toBe(skill.cost);
      expect(skillEffectSummary(h, upgraded)).toContain(
        String(calculateSkillPower(h, upgraded)),
      );
    }
  });
  it("keeps legacy rank-one fixtures finite and improves small buffs and Soul Pact", () => {
    const h = hero();
    const legacy = {
      basePower: 6,
      scaling: 1,
      scalingStat: "INT",
    } as (typeof MASTER_SKILL_POOL)[number];
    expect(calculateSkillPower(h, legacy)).toBe(16);
    const rally = MASTER_SKILL_POOL.find((s) => s.id === "rally")!;
    expect(skillEffectValue({ ...rally, level: 2 })).toBe(7);
    const pact = {
      ...MASTER_SKILL_POOL.find((s) => s.id === "soul_pact")!,
      level: 2,
    };
    expect(soulPactRestoration(pact)).toBe(46);
    expect(skillEffectSummary(h, pact)).toContain("46 MP");
  });
  it("scales authored buff values and bounds malformed ranks", () => {
    const shield = MASTER_SKILL_POOL.find((s) => s.id === "iron_skin")!;
    expect(skillEffectValue({ ...shield, level: 2 })).toBe(23);
    expect(skillEffectValue({ ...shield, level: 999 })).toBe(
      skillEffectValue({ ...shield, level: shield.maxLevel }),
    );
    expect(skillEffectValue({ ...shield, level: NaN })).toBe(20);
  });
  it("applies Blur/Iron Skin/Ward mitigation to incoming attacks without cancelling poison", () => {
    const h = hero(),
      foe = { ...createEnemyById("the_necromancer"), damage: 40 };
    const normal = calculateEnemyAttack(foe, h);
    h.statusEffects = [createStatusEffect("SHIELD", 3, 20)];
    expect(calculateEnemyAttack(foe, h)).toBe(normal - 20);
    h.isDefending = true;
    expect(calculateEnemyAttack(foe, h)).toBe(1);
    expect(
      resolveStatusTurn(100, 100, [
        ...h.statusEffects,
        createStatusEffect("POISON", 2, 3),
      ]).hp,
    ).toBe(97);
  });
  it("uses upgraded shield values through a real skill turn, then expires on own turns", () => {
    const h = hero();
    h.skills = [
      { ...MASTER_SKILL_POOL.find((s) => s.id === "blur")!, level: 2 },
    ];
    const p: Player = {
      pos: { x: 1, y: 1 },
      dir: "E",
      party: [h],
      inventory: [],
      scrap: 0,
    };
    const foe = { ...createEnemyById("giant_rat"), hp: 1000, maxHp: 1000 };
    const rt = new CombatRuntime(p, [foe], () => 0.5);
    rt.act({ actorId: h.id, type: "skill", id: "blur" });
    expect(rt.player.party[0].statusEffects[0].value).toBe(29);
    const hit = rt.stepEnemy(rt.turnId!, rt.round);
    expect(rt.player.party[0].stats.hp).toBe(h.stats.hp - 1);
    expect(hit.events?.some((e) => e.kind === "block" && e.amount! > 0)).toBe(
      true,
    );
    for (let i = 0; i < 2; i++) {
      rt.act({ actorId: h.id, type: "defend" });
      rt.stepEnemy(rt.turnId!, rt.round);
    }
    expect(
      rt.player.party[0].statusEffects.some((e) => e.type === "SHIELD"),
    ).toBe(false);
  });
});
