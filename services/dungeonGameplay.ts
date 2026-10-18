import { TileType, type ActiveRoomEvent, type DungeonRoom, type FloorState, type Item, type Player, type Position, type Enemy } from '../types';
import { cellKey, isClosedTile } from './dungeonPlan';
import { floorHash, floorRandom } from './floorRandom';
import { createEnemyById } from './gameLogic';
import { applyRoomEventToParty, calculateEnvironmentalDC, resolveCharacterCheck, ROOM_EVENT_DEFINITIONS } from './roomEvents';
import { createStatusEffect, upsertStatusEffect } from './combat';
import { biomeStory, roomPresentation, roomTitle } from '../data/dungeonRooms';
export interface RoomOption { id: string; label: string; detail: string; enabled: boolean }
export interface RoomDecision { title: string; description: string; options: RoomOption[] }
export interface RoomResolution { floor: FloorState; player: Player; map: number[][]; logs: string[]; encounter?: Enemy[]; hazard?: ActiveRoomEvent; accepted: boolean }
const living = (p: Player) => p.party.filter(c => c.stats.hp > 0);
const updateRoom = (f: FloorState, id: string, values: Partial<DungeonRoom>): FloorState => ({ ...f, rooms: f.rooms.map(r => r.id === id ? { ...r, ...values } : r) });
export function visitFloor(floor: FloorState, pos: Position, explored: boolean[][]): { floor: FloorState; logs: string[]; encounterRoom?: string } {
  const key = cellKey(pos), logs: string[] = [];
  let changed = !floor.visitedCells.includes(key);
  const rooms = floor.rooms.map(room => {
    const at = room.cells.some(c => cellKey(c) === key);
    const seen = room.type !== 'SECRET' && (at || Boolean(explored[room.anchor.y]?.[room.anchor.x]));
    const visited = room.visited || at && (room.type !== 'SECRET' || room.discovered);
    if (visited && !room.visited && room.type !== 'NORMAL') logs.push(room.type === 'BOSS_ANTECHAMBER' ? 'Beyond these stones waits the guardian. The shelter offers one preparation, not a full recovery.' : `${roomPresentation[room.type].title}: ${room.type === 'ELITE' ? 'a dangerous alliance guards a better reward.' : 'a choice remains here.'}`);
    if (seen && !room.discovered || visited !== room.visited) changed = true;
    return seen && !room.discovered || visited !== room.visited ? { ...room, discovered: room.discovered || seen, visited } : room;
  });
  const next = changed ? { ...floor, rooms, visitedCells: floor.visitedCells.includes(key) ? floor.visitedCells : [...floor.visitedCells, key] } : floor;
  const encounter = rooms.find(r => r.type === 'COMBAT' && !r.resolved && cellKey(r.anchor) === key);
  return { floor: next, logs, encounterRoom: !next.pendingEncounterId ? encounter?.id : undefined };
}
export function roomInteraction(floor: FloorState | null, map: number[][], transform: { x: number; y: number; angle: number }): DungeonRoom | undefined {
  if (!floor) return;
  const seen = new Set<string>();
  let underfoot: DungeonRoom | undefined;
  for (let d = 0; d <= 1.5; d += 0.04) {
    const pos = { x: Math.floor(transform.x + Math.cos(transform.angle) * d), y: Math.floor(transform.y + Math.sin(transform.angle) * d) }, key = cellKey(pos);
    if (seen.has(key)) continue; seen.add(key);
    const room = floor.rooms.find(r => !r.resolved && !['NORMAL', 'BOSS_ANTECHAMBER', 'BOSS'].includes(r.type) && cellKey(r.gate && (map[r.gate.y][r.gate.x] === TileType.LOCKED && !r.unlocked || map[r.gate.y][r.gate.x] === TileType.SECRET && !r.discovered) ? r.gate : r.anchor) === key);
    if (d === 0) underfoot = room;
    else if (room) return room;
    const tile = map[pos.y]?.[pos.x];
    // A declined choice under the player must not hide the ordinary door ahead.
    if (tile === TileType.DOOR) return;
    if (tile === undefined || isClosedTile(tile)) return underfoot;
  }
  return underfoot;
}
export function roomReward(floor: FloorState, room: DungeonRoom, quality: 'NORMAL' | 'GOOD' | 'RARE', variant = 0): Item {
  const rng = floorRandom(floor.seed ^ floorHash(room.id + quality + variant));
  const tier = Math.floor(floor.level / 3) + 1 + (quality === 'RARE' ? 2 : quality === 'GOOD' ? 1 : 0);
  const type = variant || Math.floor(rng() * 3);
  if (quality === 'RARE') return { id: `${room.id}_relic_${variant}`, name: `Expedition Sigil +${tier}`, description: `${quality} floor relic.`, type: 'ACCESSORY', value: tier, statBonus: 'STR', icon: '◆', quantity: 1 };
  if (type === 1) return { id: `${room.id}_armor_${variant}`, name: `Vault Armor +${tier}`, description: `${quality} floor reward.`, type: 'ARMOR', armorWeight: 'MEDIUM', value: 2 + tier, icon: '👕', quantity: 1 };
  if (type === 2) return { id: `${room.id}_relic_${variant}`, name: `Expedition Sigil +${tier}`, description: `${quality} floor relic.`, type: 'ACCESSORY', value: tier, statBonus: 'STR', icon: '◆', quantity: 1 };
  return { id: `${room.id}_weapon_${variant}`, name: `Expedition Blade +${tier}`, description: `${quality} floor reward.`, type: 'WEAPON', visualType: 'sword', value: 5 + tier * 2, icon: '🗡', quantity: 1 };
}
const mergeItem = (p: Player, item: Item): Player => ({ ...p, inventory: p.inventory.some(i => i.id === item.id) ? p.inventory.map(i => i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i) : [...p.inventory, item] });
export function hazardPreview(floor: FloorState, room: DungeonRoom, player: Player): string {
  const definition = ROOM_EVENT_DEFINITIONS.find(d => d.id === room.hazardId)!;
  if (!definition) return 'Unknown hazard.';
  return living(player).map(c => { const checks = Array.from({ length: 20 }, (_, i) => resolveCharacterCheck(c, definition, floor.level, i + 1)), successes = checks.filter(r => r.success).length;
    return `${c.name}: ${successes * 5}% ${checks[0].baseStat} vs DC ${calculateEnvironmentalDC(floor.level)}`; }).join(' · ');
}
export function roomDecision(floor: FloorState, room: DungeonRoom, player: Player, map: number[][]): RoomDecision {
  const option = (id: string, label: string, detail: string, enabled = true): RoomOption => ({ id, label, detail, enabled });
  let options: RoomOption[] = [], description = biomeStory[floor.biome];
  if (room.type === 'TREASURE') options = [option('gear', 'Claim equipment', `Guaranteed GOOD equipment: ${roomReward(floor, room, 'GOOD').name}.`), option('supplies', 'Take supplies', 'Two health potions and 10 scrap instead of equipment.')];
  if (room.type === 'REST') options = [option('rest', 'Rest', 'Recover 25% maximum HP for living heroes. One camp action per floor.'), option('meditate', 'Meditate', 'Recover 35% maximum MP instead of HP.'), option('prepare', 'Prepare', '+3 Strength for the next encounter’s first useful action cycles, instead of recovery.')];
  if (room.type === 'ELITE' || room.type === 'COMBAT') options = [option('fight', 'Challenge', room.type === 'ELITE' ? 'Controller + striker/support alliance. Guaranteed GOOD equipment +15 scrap on victory; fleeing grants nothing.' : 'A marked patrol. Clear it once; no random patrol is stacked on this anchor.')];
  if (room.type === 'SHRINE') {
    if (room.shrine === 'blood') options = [option('blood', 'Offer blood', `Each living hero loses 20% maximum HP. Gain ${roomReward(floor, room, 'RARE').name}.`, living(player).every(c => c.stats.hp > Math.ceil(c.stats.maxHp * 0.2)))];
    else if (room.shrine === 'aether') options = [option('aether', 'Borrow aether', 'Restore 40% maximum MP. Every hero suffers −3 attack damage from Weakness for three own cycles in the next encounter.')];
    else options = [1, 2, 3].map(i => option(`fortune${i}`, `20 scrap · ${roomReward(floor, room, 'GOOD', i).name}`, 'Choose one guaranteed reward; the shrine is then spent.', player.scrap >= 20));
  }
  if (room.type === 'LOCKED') {
    const closed = room.gate && !room.unlocked && map[room.gate.y][room.gate.x] === TileType.LOCKED;
    if (closed) {
      const str = Math.max(0, ...living(player).map(c => c.stats.str)), dc = 12 + Math.floor(floor.level / 2), chance = Math.max(0, Math.min(100, (21 - Math.max(1, dc - Math.floor(str / 3))) * 5));
      options = [option('key', 'Use an Iron Key', `1 floor key (${floor.keys} available). Open a vault containing guaranteed RARE equipment.`, floor.keys > 0), option('pay', 'Break the seal with scrap', 'Spend 15 scrap; no check or wound.', player.scrap >= 15), option('force', 'Force the lock', `Strongest living STR: ${str}. ${chance}% vs DC ${dc}; failure wounds living heroes for 8% max HP. One attempt; key/scrap remain available.`, !room.attempted)];
    } else options = [option('gear', 'Claim vault equipment', `Guaranteed ${roomReward(floor, room, 'RARE').name}.`)];
  }
  if (room.type === 'SECRET') options = [option('relic', 'Claim the hidden relic', `Gain ${roomReward(floor, room, 'RARE').name} and one floor key; −3 damage Weakness for three own cycles next encounter.`), option('salvage', 'Leave the relic; salvage', 'Gain 15 scrap and one floor key without a curse.')];
  if (room.type === 'TRAP') { description = `A salvage cache is trapped here; passing without searching is safe. ${ROOM_EVENT_DEFINITIONS.find(d => d.id === room.hazardId)?.description} ${hazardPreview(floor, room, player)}`;
    options = [option('disarm', 'Attempt the party checks', 'Existing hazard consequences on failure; surviving attempts salvage 15 scrap. Risk shown above; no reroll.'), option('bypass', 'Use safe tools', 'Pay 8 scrap for safe tools to recover 15 scrap (net +7), without hazard consequences.', player.scrap >= 8)]; }
  if (room.type === 'EVENT') options = [option('respect', 'Read the warning; leave offerings', 'Learn the secret-wall clue and gain +2 Strength for the next encounter.'), option('scavenge', 'Scavenge the expedition', 'One floor key and 8 scrap instead of a blessing.')];
  return { title: roomTitle(room), description, options };
}
export function resolveRoom(floor: FloorState, player: Player, map: number[][], id: string, choice: string): RoomResolution {
  const room = floor.rooms.find(r => r.id === id);
  const fail = (message: string): RoomResolution => ({ floor, player, map, logs: [message], accepted: false });
  if (!living(player).length) return fail('No living expedition member can make this choice.');
  if (!room || room.resolved || floor.pendingEncounterId) return fail('This area has already been resolved or an encounter is active.');
  if (room.type === 'SECRET' && !room.discovered && room.gate && map[room.gate.y][room.gate.x] === TileType.SECRET && choice === 'reveal') {
    const nextMap = map.map(r => [...r]); nextMap[room.gate.y][room.gate.x] = TileType.EMPTY;
    return { floor: updateRoom(floor, id, { discovered: true }), player, map: nextMap, logs: ['A cold draft reveals a hidden chamber. Your map records the passage.'], accepted: true };
  }
  if (room.type === 'SECRET' && !room.discovered && room.gate && map[room.gate.y][room.gate.x] === TileType.SECRET) return fail('Reveal the chamber before claiming it.');
  const available = roomDecision(floor, room, player, map).options.find(o => o.id === choice && o.enabled);
  if (!available) return fail('That choice is unavailable.');
  let next = updateRoom(floor, id, { resolved: true, discovered: true, visited: true }), p: Player = { ...player, party: player.party.map(c => ({ ...c, stats: { ...c.stats } })) }, nextMap = map, hazard: ActiveRoomEvent | undefined;
  const effect = (type: 'WEAKNESS' | 'STRENGTH', value: number, duration: number) => { const old = next.pendingEffects.find(e => e.type === type); next = { ...next, pendingEffects: [...next.pendingEffects.filter(e => e.type !== type), { type, value: Math.max(value, old?.value ?? 0), duration: Math.max(duration, old?.duration ?? 0) }] }; };
  if (choice === 'fight') { const ids = room.type === 'ELITE' ? (floor.level <= 3 ? ['acid_spider', 'skeleton_warrior'] : ['orc_brute', 'dark_cultist', 'skeleton_warrior']) : ['giant_rat', floor.level >= 3 ? 'goblin_scavenger' : 'giant_rat'];
    return { floor: updateRoom({ ...floor, pendingEncounterId: id }, id, { discovered: true, visited: true }), player, map, encounter: ids.map(enemy => createEnemyById(enemy, 1 + Math.max(0, floor.level - 2) * 0.1, { isBoss: false })), logs: [room.type === 'ELITE' ? 'Elite alliance challenged.' : 'The patrol closes in.'], accepted: true }; }
  if (room.type === 'LOCKED' && ['key', 'pay', 'force'].includes(choice)) {
    let success = true;
    if (choice === 'key') next = { ...next, keys: next.keys - 1 };
    if (choice === 'pay') p.scrap -= 15;
    if (choice === 'force') { const roll = 1 + Math.floor(floorRandom(floor.seed ^ floorHash(id + 'force'))() * 20); const str = Math.max(0, ...living(p).map(c => c.stats.str)); success = roll + Math.floor(str / 3) >= 12 + Math.floor(floor.level / 2);
      if (!success) p.party = p.party.map(c => c.stats.hp > 0 ? { ...c, stats: { ...c.stats, hp: Math.max(1, c.stats.hp - Math.ceil(c.stats.maxHp * 0.08)) } } : c); }
    next = updateRoom(next, id, { resolved: false, unlocked: success, attempted: room.attempted || choice === 'force' });
    if (success && room.gate) { nextMap = map.map(r => [...r]); nextMap[room.gate.y][room.gate.x] = TileType.EMPTY; }
    return { floor: next, player: p, map: nextMap, logs: [success ? 'The vault opens. Its equipment remains inside.' : 'The lock holds. The wound is the cost; keys or scrap can still open it.'], accepted: true };
  }
  if (choice === 'gear') p = mergeItem(p, roomReward(floor, room, room.type === 'LOCKED' ? 'RARE' : 'GOOD'));
  if (choice === 'supplies') { p = mergeItem(p, { id: 'potion_hp', name: 'Health Potion', description: 'Restores 30 HP', type: 'POTION', value: 30, icon: '🍷', quantity: 2 }); p.scrap += 10; }
  if (choice === 'rest' || choice === 'meditate' || choice === 'aether') p.party = p.party.map(c => c.stats.hp > 0 ? { ...c, stats: { ...c.stats, hp: choice === 'rest' ? Math.min(c.stats.maxHp, c.stats.hp + Math.ceil(c.stats.maxHp * 0.25)) : c.stats.hp, mp: choice !== 'rest' ? Math.min(c.stats.maxMp, c.stats.mp + Math.ceil(c.stats.maxMp * (choice === 'aether' ? 0.4 : 0.35))) : c.stats.mp } } : c);
  if (choice === 'prepare' || choice === 'respect') effect('STRENGTH', choice === 'prepare' ? 3 : 2, 3);
  if (choice === 'blood') { p.party = p.party.map(c => c.stats.hp > 0 ? { ...c, stats: { ...c.stats, hp: c.stats.hp - Math.ceil(c.stats.maxHp * 0.2) } } : c); p = mergeItem(p, roomReward(floor, room, 'RARE')); }
  if (choice === 'aether' || choice === 'relic') effect('WEAKNESS', 3, 3);
  if (choice.startsWith('fortune')) { p.scrap -= 20; const variant = Number(choice.slice(-1)); p = mergeItem(p, roomReward(floor, room, 'GOOD', variant)); }
  if (choice === 'relic') p = mergeItem(p, roomReward(floor, room, 'RARE'));
  if (choice === 'relic' || choice === 'salvage' || choice === 'scavenge') next = { ...next, keys: Math.min(3, next.keys + 1) };
  if (choice === 'salvage' || choice === 'scavenge') p.scrap += choice === 'salvage' ? 15 : 8;
  if (choice === 'bypass') p.scrap += 7;
  if (choice === 'disarm') { const definition = ROOM_EVENT_DEFINITIONS.find(d => d.id === room.hazardId)!;
    const results = living(p).map(c => resolveCharacterCheck(c, definition, floor.level, 1 + Math.floor(floorRandom(floor.seed ^ floorHash(id + c.id))() * 20)));
    hazard = { event: definition, dungeonLevel: floor.level, difficultyClass: calculateEnvironmentalDC(floor.level), results, scrapsFound: 15, summary: 'The salvage has been attempted once; the hazard cannot reward you again.' }; p.party = applyRoomEventToParty(p.party, results); if (living(p).length) p.scrap += 15; }
  return { floor: next, player: p, map: nextMap, logs: [`${available.label}: ${available.detail}`, ...(hazard?.results.map(r => r.logSummary) ?? [])], hazard, accepted: true };
}
export function finishFloorEncounter(floor: FloorState, player: Player, victory: boolean, bossVictory = false): { floor: FloorState; player: Player; elite: boolean; logs: string[] } {
  const room = floor.rooms.find(r => r.id === floor.pendingEncounterId);
  if (!room) return { floor: victory && bossVictory ? { ...floor, rooms: floor.rooms.map(r => r.type === 'BOSS' ? { ...r, resolved: true, discovered: true } : r) } : floor, player, elite: false, logs: [] };
  const next = { ...floor, pendingEncounterId: null };
  if (!victory || room.resolved) return { floor: next, player, elite: false, logs: [] };
  const elite = room.type === 'ELITE';
  return { floor: updateRoom(next, room.id, { resolved: true }), player: elite ? { ...mergeItem(player, roomReward(floor, room, 'GOOD')), scrap: player.scrap + 15 } : player, elite, logs: elite ? ['Elite pact cleared: guaranteed equipment and 15 scrap.'] : [] };
}
export function consumeFloorPreparation(floor: FloorState, player: Player): { floor: FloorState; player: Player } {
  return { floor: { ...floor, pendingEffects: [] }, player: { ...player, party: player.party.map(c => c.stats.hp > 0 ? { ...c, statusEffects: floor.pendingEffects.reduce((effects, e) => upsertStatusEffect(effects, createStatusEffect(e.type, e.duration, e.value)), c.statusEffects) } : c) } };
}
