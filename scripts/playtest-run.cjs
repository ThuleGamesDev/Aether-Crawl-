// Opt-in browser run using normal controls. React state is read only for navigation/diagnostics.
// It does not call game transitions or alter party stats, positions, maps, resources or rewards.
// Requires Playwright and an installed Chromium; see docs/RUN_ACCEPTANCE.md.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("fs"),
  assert = require("assert/strict");
const startLevel = Number(process.env.RUN_START || 1),
  endLevel = Number(process.env.RUN_END || 5);
const port = Number(process.env.RUN_PORT || 5199),
  origin = `http://127.0.0.1:${port}`;
const repo = process.cwd(),
  out = process.env.RUN_OUT || "artifacts/run-playtest";
fs.mkdirSync(out, { recursive: true });
const report = {
  startLevel,
  endLevel,
  resumedFrom: process.env.RUN_SAVE || null,
  party: ["Paladin", "Ranger", "Cleric"],
  floors: [],
  encounters: [],
  choices: [],
  perks: [],
  equipment: [],
  reloads: [],
  errors: [],
};
let page, server, browser;
async function read() {
  return page.evaluate(() => window.readRun());
}
function note(kind, data) {
  console.log(JSON.stringify({ kind, ...data }));
  fs.writeFileSync(out + "/report.json", JSON.stringify(report, null, 2));
}
const sleep = (ms) => page.waitForTimeout(ms);
async function key(key, ms) {
  await page.keyboard.down(key);
  await sleep(ms);
  await page.keyboard.up(key);
}
async function interact() {
  await page.keyboard.press("e");
  await sleep(80);
}
async function face(angle) {
  for (let i = 0; i < 30; i++) {
    const s = await read();
    if (s.phase !== "EXPLORE") return;
    let d =
      ((angle - s.transform.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    if (Math.abs(d) < 0.13) return;
    await key(
      d > 0 ? "ArrowRight" : "ArrowLeft",
      Math.max(12, Math.min(180, (Math.abs(d) / 2.2) * 1000)),
    );
  }
  throw Error("turn did not converge");
}
async function save(label, reload = false) {
  let s = await read();
  if (s.phase !== "EXPLORE") return;
  await page.getByRole("button", { name: "SAVE", exact: true }).click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("aether_crawl_save_v1")),
  );
  assert(saved && saved.dungeonLevel === s.floor.level);
  if(label==='guardian'){
    assert.equal(saved.levelBossDefeated,true,'guardian save precedes victory');
    assert(saved.floor.rooms.some(r=>r.type==='BOSS'&&r.resolved),'boss room not settled');
  }
  fs.writeFileSync(
    out + `/floor-${s.floor.level}-${label}.json`,
    JSON.stringify(saved, null, 2),
  );
  if (reload) {
    await page.reload();
    await page.getByRole("button", { name: "CONTINUE", exact: true }).click();
    await page
      .getByText("FLOOR " + saved.dungeonLevel, { exact: true })
      .waitFor();
    const after = await read();
    assert.deepEqual(after.player.party, s.player.party);
    assert.deepEqual(after.floor, s.floor);
    assert.deepEqual(after.map, s.map);
    report.reloads.push({ floor: s.floor.level, label });
    note("reload", { floor: s.floor.level, label });
  }
}
async function skillsMenu(id) {
  await page.getByRole("button", { name: "MORE", exact: true }).click();
  await page.getByRole("button", { name: "ALL SKILLS", exact: true }).click();
  const s = await read(),
    h = s.runtime.player.party.find((h) => h.id === s.runtime.turnId),
    skill = h.skills.find((x) => x.id === id);
  await page
    .getByRole("button", {
      name: new RegExp(
        "^" + skill.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " ·",
      ),
    })
    .last()
    .click();
}
async function chooseCombat() {
  let s = await read();
  const rt = s.runtime;
  if (!rt) return;
  const h = rt.player.party.find((c) => c.id === rt.turnId);
  if (!h) {
    await sleep(250);
    return;
  }
  const foes = rt.enemies.filter((e) => e.hp > 0);
  const target = [...foes].sort((a, b) => a.hp - b.hp)[0];
  // Cycle through the actual target control rather than calling the resolver.
  for (let i = 0; i < foes.length; i++) {
    const text = await page.locator(".combat-target").innerText();
    if (text.includes(target.name)) break;
    await page.keyboard.press("Tab");
  }
  const ally = [...rt.player.party].sort(
    (a, b) => a.stats.hp / a.stats.maxHp - b.stats.hp / b.stats.maxHp,
  )[0];
  if (fight) fight.commands++;
  const heal = h.skills.find((x) => x.id === "heal" && h.stats.mp >= x.cost);
  let skill;
  if (heal && ally.stats.hp / ally.stats.maxHp < 0.6) skill = heal;
  else if (foes.length >= 2)
    skill = h.skills
      .filter(
        (x) =>
          x.type === "DAMAGE" &&
          x.targetType === "MULTI" &&
          x.cost <= h.stats.mp,
      )
      .sort((a, b) => a.cost - b.cost)[0];
  else if (
    target.isBoss ||
    target.hp > h.stats.str + (h.equipment.weapon?.value || 0) + 5
  )
    skill = h.skills
      .filter(
        (x) =>
          ["DAMAGE", "DRAIN"].includes(x.type) &&
          x.targetType === "SINGLE" &&
          x.cost > 0 &&
          x.cost <= h.stats.mp,
      )
      .sort((a, b) => a.cost - b.cost)[0];
  if (
    h.stats.hp / h.stats.maxHp < 0.38 &&
    !skill?.type.includes("HEAL") &&
    rt.player.inventory.some(
      (i) => i.type === "POTION" && i.id.includes("hp") && i.quantity > 0,
    )
  ) {
    await page.keyboard.press("g");
    return;
  }
  if (skill) {
    const slot = h.skills.slice(0, 4).findIndex((x) => x.id === skill.id);
    if (slot >= 0) await page.keyboard.press(["q", "e", "r", "f"][slot]);
    else await skillsMenu(skill.id);
  } else
    await page.getByRole("button", { name: "Attack", exact: true }).click();
  await sleep(100);
}
let fight = null;
async function settle() {
  for (let i = 0; i < 600; i++) {
    const s = await read();
    if (s.phase === "GAME_OVER") throw Error("Party defeated");
    if (s.phase === "COMBAT") {
      if (!fight) {
        fight = {
          floor: s.floor.level,
          foes: s.runtime.enemies.map((e) => e.definitionId),
          start: summary(s.player),
          commands: 0,
        };
        note("fight", fight);
        if (process.env.RUN_TOUCH) {
          for (const viewport of [
            { width: 390, height: 844 },
            { width: 844, height: 390 },
          ]) {
            await page.setViewportSize(viewport);
            const buttons = await page
              .locator(".combat-dock button")
              .evaluateAll((nodes) =>
                nodes
                  .map((node) => {
                    const r = node.getBoundingClientRect();
                    return {
                      text: node.textContent,
                      x: r.x,
                      y: r.y,
                      w: r.width,
                      h: r.height,
                    };
                  })
                  .filter((r) => r.w > 0 && r.h > 0),
              );
            for (const b of buttons) {
              assert(b.w >= 44 && b.h >= 44, "small touch target " + b.text);
              assert(
                b.x >= 0 &&
                  b.y >= 0 &&
                  b.x + b.w <= viewport.width + 0.1 &&
                  b.y + b.h <= viewport.height + 0.1,
                "clipped touch target " + b.text,
              );
            }
            await page.screenshot({
              path:
                out + `/floor-${s.floor.level}-combat-${viewport.width}.png`,
            });
          }
          await page.setViewportSize({ width: 390, height: 844 });
          report.touchLayouts = true;
        }
      }
      await chooseCombat();
      continue;
    }
    if (fight) {
      fight.end = summary(s.player);
      report.encounters.push(fight);
      note("victory", fight);
      fight = null;
    }
    if (s.phase === "LEVEL_UP") {
      const h = s.player.party[s.levelQueue[0]],
        restore =
          h.stats.hp < h.stats.maxHp * 0.75 || h.stats.mp < h.stats.maxMp * 0.6;
      const perk = restore
        ? s.perks.find((p) => p.id === "heal_self")
        : s.perks.find((p) => p.type === "UPGRADE") || s.perks[0];
      report.perks.push({
        floor: s.floor.level,
        hero: h.name,
        perk: perk.title,
      });
      await page
        .getByRole("button", {
          name: new RegExp(
            "^" + perk.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          ),
        })
        .click();
      continue;
    }
    if (s.hazard) {
      await page
        .getByRole("button", { name: /CONTINUE|Continue|Proceed/ })
        .last()
        .click();
      continue;
    }
    if (s.decision) {
      await resolveDecision(s);
      continue;
    }
    if (s.phase === "EXPLORE") return;
    if (s.phase === "INIT") {
      await sleep(150);
      continue;
    }
    throw Error("Unexpected phase " + s.phase);
  }
  throw Error("settle exceeded budget");
}
function summary(p) {
  return p.party.map((h) => ({
    name: h.name,
    level: h.stats.level,
    hp: h.stats.hp,
    maxHp: h.stats.maxHp,
    mp: h.stats.mp,
    maxMp: h.stats.maxMp,
  }));
}
async function resolveDecision(s) {
  const room = s.floor.rooms.find((r) => r.id === s.decision),
    dialog = page.getByRole("dialog");
  let pattern;
  switch (room.type) {
    case "TREASURE":
      pattern = /^Claim equipment/;
      break;
    case "EVENT":
      pattern = /^Scavenge/;
      break;
    case "REST": {
      const hp = s.player.party.reduce(
          (n, h) => n + (h.stats.maxHp - h.stats.hp) / h.stats.maxHp,
          0,
        ),
        mp = s.player.party.reduce(
          (n, h) => n + (h.stats.maxMp - h.stats.mp) / h.stats.maxMp,
          0,
        );
      pattern = mp > hp ? /^Meditate/ : /^Rest/;
      break;
    }
    case "LOCKED":
      pattern = room.unlocked
        ? /^Claim vault equipment/
        : s.floor.keys > 0
          ? /^Use an Iron Key/
          : s.player.scrap >= 15
            ? /^Break the seal/
            : /^Force the lock/;
      break;
    case "SECRET":
      pattern =
        /^Leave the relic; salvage|^Take safe salvage|^Salvage|^Take salvage/;
      break;
    case "SHRINE":
      pattern = room.shrine === "aether" ? /^Borrow aether/ : /^LEAVE/;
      break;
    case "TRAP":
      pattern =
        s.player.scrap >= 8
          ? /^Use safe tools|^Use tools|^Use scrap|^Spend 8|^Safe/
          : /^Attempt|^Search|^Risk/;
      break;
    case "COMBAT":
    case "ELITE":
      pattern = /^Challenge/;
      break;
    default:
      pattern = /^LEAVE/;
  }
  let b = dialog.getByRole("button", { name: pattern }).first();
  if (!(await b.count()) || !(await b.isEnabled())) {
    console.log("DECISION", room.type, await dialog.innerText());
    b = dialog.getByRole("button", { name: /^LEAVE/ });
  }
  const label = await b.innerText();
  report.choices.push({ floor: s.floor.level, type: room.type, choice: label });
  note("choice", { floor: s.floor.level, type: room.type, choice: label });
  await b.click();
  await sleep(80);
}
function path(map, start, end) {
  const q = [start],
    prev = new Map([[start.x + "," + start.y, null]]);
  for (const p of q) {
    if (p.x === end.x && p.y === end.y) {
      const r = [];
      for (let n = p; n; n = prev.get(n.x + "," + n.y)) r.unshift(n);
      return r;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const n = { x: p.x + dx, y: p.y + dy },
        k = n.x + "," + n.y;
      if (
        map[n.y]?.[n.x] !== undefined &&
        [0, 2, 3].includes(map[n.y][n.x]) &&
        !prev.has(k)
      ) {
        prev.set(k, p);
        q.push(n);
      }
    }
  }
  return null;
}
async function walk(end) {
  for (let tries = 0; tries < 450; tries++) {
    await settle();
    const s = await read(),
      t = s.transform;
    const dist = Math.hypot(t.x - (end.x + 0.5), t.y - (end.y + 0.5));
    if (dist < 0.17) return;
    const cell = { x: Math.floor(t.x), y: Math.floor(t.y) },
      route = path(s.map, cell, end);
    if (!route) throw Error("No route " + JSON.stringify(end));
    const next = route[1] || end;
    if (s.map[next.y][next.x] === 2) {
      await face(Math.atan2(next.y + 0.5 - t.y, next.x + 0.5 - t.x));
      await interact();
      await settle();
      continue;
    }
    const dx = next.x + 0.5 - t.x,
      dy = next.y + 0.5 - t.y,
      c = Math.cos(t.angle),
      sn = Math.sin(t.angle),
      f = dx * c + dy * sn,
      r = -dx * sn + dy * c;
    const keys = [];
    if (Math.abs(f) > 0.08) keys.push(f > 0 ? "w" : "s");
    if (Math.abs(r) > 0.08) keys.push(r > 0 ? "d" : "a");
    const len = Math.hypot(dx, dy);
    for (const k of keys) await page.keyboard.down(k);
    await sleep(Math.max(20, Math.min(110, (len / 2.8) * 1000)));
    for (const k of keys) await page.keyboard.up(k);
  }
  throw Error("Movement did not converge " + JSON.stringify(end));
}
async function equip() {
  let guard = 0;
  while (guard++ < 15) {
    let s = await read();
    const candidates = [];
    for (const item of s.player.inventory) {
      if (item.quantity <= 0) continue;
      const slot = {
        WEAPON: "weapon",
        ARMOR: "armor",
        SHIELD: "offhand",
        ACCESSORY: "accessory",
      }[item.type];
      if (!slot) continue;
      for (let idx = 0; idx < 3; idx++) {
        const old = s.player.party[idx].equipment[slot];
        if (!old || item.value > old.value)
          candidates.push({
            item,
            idx,
            slot,
            gain: item.value - (old?.value || 0),
          });
      }
    }
    if (!candidates.length) return;
    const { item, idx, slot } = candidates.sort((a, b) => b.gain - a.gain)[0];
    const before = s.player.party[idx];
    await page.keyboard.press("i");
    await page.getByRole("button", { name: before.name, exact: true }).click();
    const row = page
      .locator(".space-y-1 > div")
      .filter({ has: page.getByText(item.name, { exact: true }) });
    await row.getByRole("button", { name: "EQUIP", exact: true }).click();
    await page.getByRole("button", { name: "✕", exact: true }).click();
    s = await read();
    const after = s.player.party[idx];
    if (item.type === "ACCESSORY") {
      const stat = {
        STR: "str",
        DEX: "dex",
        INT: "int",
        HP: "maxHp",
        MP: "maxMp",
      }[item.statBonus];
      const old = before.equipment.accessory;
      const expected =
        before.stats[stat] +
        item.value -
        (old?.statBonus === item.statBonus ? old.value : 0);
      assert.equal(
        after.stats[stat],
        expected,
        "equipment stat delta corrupted",
      );
    }
    assert.equal(
      after.equipment[slot].quantity,
      1,
      "equipped stack quantity corrupted",
    );
    report.equipment.push({
      floor: s.floor.level,
      hero: before.name,
      item: item.name,
    });
    note("equip", report.equipment.at(-1));
  }
  throw Error("Equipment loop");
}
(async () => {
  const { createServer } = await import(
    repo + "/node_modules/vite/dist/node/index.js"
  );
  server = await createServer({
    root: repo,
    server: { host: "127.0.0.1", port, strictPort: true },
  });
  await server.listen();
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-zygote"],
  });
  page = await browser.newPage({
    viewport: process.env.RUN_TOUCH
      ? { width: 390, height: 844 }
      : { width: 1000, height: 700 },
    hasTouch: Boolean(process.env.RUN_TOUCH),
    isMobile: Boolean(process.env.RUN_TOUCH),
  });
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.addInitScript(() => {
    window.readRun = () => {
      const el = document.getElementById("root"),
        root =
          el?.[Object.keys(el).find((k) => k.startsWith("__reactContainer"))];
      if (!root) return {};
      const stack = [root.stateNode.current];
      let app;
      while (stack.length) {
        const f = stack.pop();
        if (f.type?.name === "App") {
          app = f;
          break;
        }
        if (f.child) stack.push(f.child);
        if (f.sibling) stack.push(f.sibling);
      }
      const values = [];
      for (let h = app?.memoizedState; h; h = h.next)
        values.push(h.memoizedState);
      const refs = values
          .filter((v) => v && typeof v === "object" && "current" in v)
          .map((v) => v.current),
        floor = refs.find((v) => v?.rooms),
        runtime = refs.find((v) => v?.actors && "turnId" in v);
      return {
        phase: values.find((v) =>
          [
            "MENU",
            "CLASS_SELECT",
            "INIT",
            "EXPLORE",
            "COMBAT",
            "INVENTORY",
            "SKILLS",
            "STATS",
            "CRAFTING",
            "GAME_OVER",
            "LEVEL_UP",
            "OPTIONS",
          ].includes(v),
        ),
        map: values.find(
          (v) =>
            Array.isArray(v) &&
            v.length === 12 &&
            Array.isArray(v[0]) &&
            typeof v[0][0] === "number",
        ),
        floor,
        transform: refs.find((v) => Number.isFinite(v?.angle)),
        player: runtime?.player || values.find((v) => v?.party && v?.inventory),
        runtime: runtime
          ? {
              turnId: runtime.turnId,
              round: runtime.round,
              player: runtime.player,
              enemies: runtime.enemies,
            }
          : null,
        decision: floor
          ? values.find(
              (v) =>
                typeof v === "string" && floor.rooms.some((r) => r.id === v),
            )
          : null,
        hazard: values.find((v) => v?.event && v?.results),
        perks: values.find(
          (v) => Array.isArray(v) && v[0]?.title && v[0]?.type,
        ),
        levelQueue: values.find(
          (v) => Array.isArray(v) && v.length && typeof v[0] === "number",
        ),
        logs: values.find((v) => Array.isArray(v) && v[0]?.text),
      };
    };
  });
  try {
    if (process.env.RUN_SAVE) {
      const resume = JSON.parse(fs.readFileSync(process.env.RUN_SAVE, "utf8"));
      await page.addInitScript((s) => {
        if (!localStorage.getItem("aether_crawl_save_v1"))
          localStorage.setItem("aether_crawl_save_v1", JSON.stringify(s));
      }, resume);
      await page.goto(origin);
      await page.getByRole("button", { name: "CONTINUE", exact: true }).click();
      await page.getByText("FLOOR " + startLevel, { exact: true }).waitFor();
    } else {
      await page.goto(origin);
      await page.getByRole("button", { name: "NEW GAME", exact: true }).click();
      for (const name of report.party)
        await page
          .getByRole("button", { name: new RegExp("^" + name) })
          .click();
      await page
        .getByRole("button", { name: "START ADVENTURE", exact: true })
        .click();
      await page.getByText("FLOOR 1", { exact: true }).waitFor();
    }
    if (process.env.RUN_TOUCH) {
      const stick = await page
          .getByLabel("Move", { exact: true })
          .boundingBox(),
        cdp = await page.context().newCDPSession(page);
      assert(stick, "touch movement control missing");
      const x = stick.x + stick.width / 2,
        y = stick.y + stick.height / 2;
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y, id: 1 }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y - stick.height * 0.3, id: 1 }],
      });
      await sleep(150);
      await page.keyboard.press("Tab");
      const at = (await read()).transform;
      await page.keyboard.press("Tab");
      await sleep(250);
      const after = (await read()).transform;
      assert.deepEqual(after, at, "held touch resumed after map");
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      report.touchMapCancellation = true;
      note("touch-map-cancel", {});
    }
    for (let level = startLevel; level <= endLevel; level++) {
      await settle();
      let s = await read();
      assert.equal(s.floor.level, level);
      report.floors.push({
        level,
        seed: s.floor.seed,
        start: summary(s.player),
      });
      await save("start");
      note("floor", { level, seed: s.floor.seed });
      const order = [
        "TREASURE",
        "EVENT",
        "LOCKED",
        "SECRET",
        "SHRINE",
        "TRAP",
        "COMBAT",
        "ELITE",
        "REST",
        "BOSS",
      ];
      const ids = order.flatMap((type) =>
        s.floor.rooms.filter((r) => r.type === type).map((r) => r.id),
      );
      for (const id of ids) {
        await settle();
        s = await read();
        let room = s.floor.rooms.find((r) => r.id === id);
        if (room.resolved) continue;
        if (room.type === "SHRINE" && room.shrine !== "aether") continue;
        if (room.gate && [4, 5].includes(s.map[room.gate.y][room.gate.x])) {
          const approaches = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]
            .map(([dx, dy]) => ({ x: room.gate.x + dx, y: room.gate.y + dy }))
            .map((p) => ({
              p,
              route: path(
                s.map,
                { x: Math.floor(s.transform.x), y: Math.floor(s.transform.y) },
                p,
              ),
            }))
            .filter((x) => x.route)
            .sort((a, b) => a.route.length - b.route.length);
          assert(approaches.length, "sealed approach unreachable");
          await walk(approaches[0].p);
          s = await read();
          await face(
            Math.atan2(
              room.gate.y + 0.5 - s.transform.y,
              room.gate.x + 0.5 - s.transform.x,
            ),
          );
          await interact();
          await settle();
          s = await read();
          if ([4, 5].includes(s.map[room.gate.y][room.gate.x])) continue;
        }
        await walk(room.anchor);
        await settle();
        s = await read();
        room = s.floor.rooms.find((r) => r.id === id);
        if (!room.resolved) {
          await interact();
          await settle();
        }
        if (room.type === "BOSS") {
          await save("guardian", true);
          await page.screenshot({ path: out + `/floor-${level}-guardian.png` });
          report.floors.at(-1).end = summary((await read()).player);
          note("guardian", { level, party: report.floors.at(-1).end });
        } else {
          await equip();
          await save(
            room.type.toLowerCase(),
            room.type === "TREASURE" && level === 2,
          );
        }
      }
      assert((await read()).floor.rooms.some(r=>r.type==='BOSS'&&r.resolved),'floor ended without guardian victory');
    if (level < endLevel) {
        await interact();
        await page.getByText("FLOOR " + (level + 1), { exact: true }).waitFor();
      }
    }
    report.complete = true;
    assert.deepEqual(report.errors, []);
    note("COMPLETE", {});
  } catch (e) {
    report.failure = e.stack;
    try {
      fs.writeFileSync(
        out + "/failure-state.json",
        JSON.stringify(await read(), null, 2),
      );
      await page.screenshot({ path: out + "/failure.png" });
    } catch {}
    note("FAILED", { message: e.message });
    process.exitCode = 1;
  } finally {
    await browser.close();
    await server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
