import { describe, expect, it, vi, afterEach } from 'vitest';
import { generateDungeon } from '../services/dungeonGenerator';
import { isClosedTile, reachableCells, cellKey, migrateFloor } from '../services/dungeonPlan';
import { consumeFloorPreparation, finishFloorEncounter, resolveRoom, roomDecision, roomInteraction, visitFloor } from '../services/dungeonGameplay';
import { isValidFloorState } from '../services/dungeonSave';
import { saveGame, loadGame } from '../services/gameLogic';
import { canOccupyPosition } from '../services/firstPerson';
import { TileType, type Player, type Character, type DungeonRoom, type FloorState } from '../types';
const hero = (id: string): Character => ({ id, name: id, classType: 'PALADIN', stats: { hp: 60, maxHp: 100, mp: 10, maxMp: 40, str: 12, dex: 12, int: 12, xp: 0, level: 1 }, equipment: { weapon:null, armor:null, offhand:null, accessory:null }, skills: [], statusEffects: [], isDefending: false });
const player = (): Player => ({ pos: { x:1,y:1 }, dir:'E', transform:{x:1.5,y:1.5,angle:0}, party:[hero('a'),hero('b')], inventory:[], scrap:50 });
const setup = (level=3,seed=42) => generateDungeon('dungeon',seed,level);
const find = (floor: FloorState, type: DungeonRoom['type']) => floor.rooms.find(r=>r.type===type)!;
afterEach(()=>{ vi.unstubAllGlobals(); });
describe('Dungeon Gameplay 2.0 floor plan',()=>{
 it('is identical for the same floor seed and changes with another seed',()=>{
  expect(setup()).toEqual(setup()); expect(setup(3,43).map).not.toEqual(setup().map);
 });
 it('keeps boss/main path reachable with every lock/secret closed across 1000 early floors',()=>{
  for(let seed=0;seed<200;seed++)for(let level=1;level<=5;level++){
   const d=setup(level,seed), f=d.floor!, reachable=new Set(reachableCells(d.map).map(cellKey));
   expect(reachable.has(cellKey(find(f,'BOSS').anchor))).toBe(true);
   expect(f.rooms.filter(r=>r.type==='TREASURE')).toHaveLength(1);expect(f.rooms.filter(r=>r.type==='REST')).toHaveLength(1);
   expect(f.rooms.filter(r=>r.type==='ELITE').length<=1).toBe(true);expect(f.rooms.filter(r=>r.type==='TRAP').length<=1).toBe(true);
   expect(f.rooms.some(r=>r.type==='NORMAL'&&r.cells.length>1)).toBe(true);
   for(const r of f.rooms){ if(!['LOCKED','SECRET'].includes(r.type))expect(reachable.has(cellKey(r.anchor))).toBe(true); }
   if(level<=2||level%2===1)expect(f.rooms.some(r=>r.type==='LOCKED')).toBe(true);
   if(level>=3)expect(f.rooms.some(r=>r.type==='SECRET')).toBe(true);
   expect(isValidFloorState(f,d.map)).toBe(true);
  }
 });
 it('assigns biome hazards and a bounded vertical-slice budget',()=>{
  for(const biome of ['dungeon','moss','catacombs','frost','gilded','obsidian'] as const){const d=generateDungeon(biome,42,4);expect(Boolean(find(d.floor!,'TRAP').hazardId)).toBe(true);expect(d.floor!.rooms.filter(r=>r.type==='SHRINE')).toHaveLength(1);}
 });
 it('preserves old save geometry and does not insert new combat or gates into the old run',()=>{
  const d=setup(1); const old=d.map.map(row=>row.map(t=>t===TileType.LOCKED||t===TileType.SECRET?TileType.WALL:t));const before=JSON.stringify(old);
  const f=migrateFloor(old,d.decorations,1,'dungeon');expect(JSON.stringify(old)).toBe(before);expect(f.rooms.some(r=>['LOCKED','SECRET','COMBAT'].includes(r.type))).toBe(false);
 });
});
describe('Dungeon risk/reward and memory',()=>{
 it('allows choosing treasure equipment or supplies only once',()=>{
  const d=setup(),r=find(d.floor!,'TREASURE'),p=player();const first=resolveRoom(d.floor!,p,d.map,r.id,'supplies');
  expect(first.player.scrap).toBe(60);expect(first.player.inventory[0].quantity).toBe(2);
  const again=resolveRoom(first.floor,first.player,first.map,r.id,'gear');expect(again.accepted).toBe(false);expect(again.player).toEqual(first.player);
 });
 it('spends a shrine once and rejects blood offers that would kill a living hero',()=>{
  const d=setup(2),r=find(d.floor!,'SHRINE');const p=player();p.party[0].stats.hp=20;
  expect(roomDecision(d.floor!,r,p,d.map).options[0].enabled).toBe(false);expect(resolveRoom(d.floor!,p,d.map,r.id,'blood').accepted).toBe(false);
  const first=resolveRoom(d.floor!,player(),d.map,r.id,'blood');expect(first.player.party[0].stats.hp).toBe(40);expect(first.player.inventory[0].type).toBe('ACCESSORY');
  expect(resolveRoom(first.floor,first.player,d.map,r.id,'blood').accepted).toBe(false);
 });
 it('offers three distinct fortune rewards and charges for exactly one',()=>{
  const d=setup(4),r=find(d.floor!,'SHRINE'),p=player();const options=roomDecision(d.floor!,r,p,d.map).options;expect(new Set(options.map(o=>o.label)).size).toBe(3);
  const first=resolveRoom(d.floor!,p,d.map,r.id,'fortune1');expect(first.player.scrap).toBe(30);expect(first.player.inventory).toHaveLength(1);expect(resolveRoom(first.floor,first.player,d.map,r.id,'fortune2').accepted).toBe(false);
 });
 it('uses one rest action, without reviving dead heroes or granting both HP and MP',()=>{
  const d=setup(),r=find(d.floor!,'REST'),p=player();p.party[1].stats.hp=0;const first=resolveRoom(d.floor!,p,d.map,r.id,'rest');
  expect(first.player.party[0].stats.hp).toBe(85);expect(first.player.party[0].stats.mp).toBe(10);expect(first.player.party[1].stats.hp).toBe(0);
  expect(resolveRoom(first.floor,first.player,d.map,r.id,'meditate').accepted).toBe(false);
 });
 it('keeps lock gates solid until paid, opens a side pocket and leaves its reward claim independent',()=>{
  const d=setup(),r=find(d.floor!,'LOCKED');expect(canOccupyPosition(d.map,r.gate!.x+0.5,r.gate!.y+0.5)).toBe(false);
  const gained=resolveRoom(d.floor!,player(),d.map,find(d.floor!,'EVENT').id,'scavenge');
  const open=resolveRoom(gained.floor,gained.player,d.map,r.id,'key');expect(open.floor.keys).toBe(0);expect(open.floor.rooms.find(x=>x.id===r.id)?.resolved).toBe(false);expect(isClosedTile(open.map[r.gate!.y][r.gate!.x])).toBe(false);
  expect(resolveRoom(open.floor,open.player,open.map,r.id,'key').accepted).toBe(false);
  const claim=resolveRoom(open.floor,open.player,open.map,r.id,'gear');expect(claim.player.inventory).toHaveLength(1);expect(resolveRoom(claim.floor,claim.player,claim.map,r.id,'gear').accepted).toBe(false);
 });
 it('allows only one lock check, even on failure, while alternative costs remain available',()=>{
  const d=setup(),r=find(d.floor!,'LOCKED'),p=player();p.party.forEach(c=>c.stats.str=0);
  const first=resolveRoom(d.floor!,p,d.map,r.id,'force');expect(first.floor.rooms.find(x=>x.id===r.id)?.attempted).toBe(true);expect(resolveRoom(first.floor,first.player,first.map,r.id,'force').accepted).toBe(false);
  if(first.map[r.gate!.y][r.gate!.x]===TileType.LOCKED)expect(resolveRoom(first.floor,first.player,first.map,r.id,'pay').accepted).toBe(true);
 });
 it('conceals secrets from ordinary discovery and reveals without granting a duplicate reward',()=>{
  const d=setup(),f=d.floor!,r=find(f,'SECRET'),all=d.map.map(row=>row.map(()=>true));const seen=visitFloor(f,{x:1,y:1},all).floor;
  expect(find(seen,'SECRET').discovered).toBe(false);expect(resolveRoom(f,player(),d.map,r.id,'relic').accepted).toBe(false);
  const reveal=resolveRoom(f,player(),d.map,r.id,'reveal');expect(find(reveal.floor,'SECRET').discovered).toBe(true);expect(reveal.player.inventory).toHaveLength(0);
  const claim=resolveRoom(reveal.floor,reveal.player,reveal.map,r.id,'salvage');expect(claim.player.scrap).toBe(65);expect(claim.floor.keys).toBe(1);expect(resolveRoom(claim.floor,claim.player,claim.map,r.id,'salvage').accepted).toBe(false);
 });
 it('previews party check chances and reuses hazards once with a paid safe alternative',()=>{
  const d=setup(2),r=find(d.floor!,'TRAP'),p=player();expect(roomDecision(d.floor!,r,p,d.map).description).toContain('%');
  const safe=resolveRoom(d.floor!,p,d.map,r.id,'bypass');expect(safe.player.scrap).toBe(57);expect(safe.hazard).toBeUndefined();
  const risky=resolveRoom(d.floor!,p,d.map,r.id,'disarm');expect(risky.hazard?.results).toHaveLength(2);expect(resolveRoom(risky.floor,risky.player,d.map,r.id,'disarm').accepted).toBe(false);
  expect(resolveRoom(d.floor!,p,d.map,r.id,'disarm').hazard?.results).toEqual(risky.hazard?.results);
 });
 it('creates elite synergy, pays on victory once, and gives no reward on flee',()=>{
  const d=setup(),r=find(d.floor!,'ELITE'),p=player();const start=resolveRoom(d.floor!,p,d.map,r.id,'fight');expect(start.encounter).toHaveLength(2);expect(new Set(start.encounter!.map(e=>e.definitionId)).size).toBe(2);
  const flee=finishFloorEncounter(start.floor,p,false);expect(flee.player.inventory).toHaveLength(0);expect(find(flee.floor,'ELITE').resolved).toBe(false);
  const finish=finishFloorEncounter(start.floor,p,true);expect(finish.player.inventory).toHaveLength(1);expect(finish.player.scrap).toBe(65);const twice=finishFloorEncounter(finish.floor,finish.player,true);expect(twice.player).toEqual(finish.player);
 });
 it('consumes next-encounter preparations once and marks the guardian cleared separately from descent',()=>{
  const d=setup(),r=find(d.floor!,'REST');const prep=resolveRoom(d.floor!,player(),d.map,r.id,'prepare');
  const begin=consumeFloorPreparation(prep.floor,prep.player);expect(begin.floor.pendingEffects).toHaveLength(0);expect(begin.player.party[0].statusEffects[0].type).toBe('STRENGTH');expect(begin.player.party[0].statusEffects[0].duration).toBe(3);
  expect(find(finishFloorEncounter(begin.floor,begin.player,true,true).floor,'BOSS').resolved).toBe(true);
 });
 it('prioritizes E-room interaction without reaching through solid walls',()=>{
  const d=setup(),r=find(d.floor!,'TREASURE');expect(roomInteraction(d.floor!,d.map,{x:r.anchor.x+0.5,y:r.anchor.y+0.5,angle:0})?.id).toBe(r.id);
  const f={...d.floor!,rooms:[{...r,anchor:{x:3,y:1}}]};const map=[[1,1,1,1,1],[1,0,1,0,1],[1,1,1,1,1]];expect(roomInteraction(f,map,{x:1.5,y:1.5,angle:0})).toBeUndefined();
 });
 it('round-trips claimed rooms, keys, discovery and pending preparations through the actual save serializer',()=>{
  const store=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)});
  const d=setup(),r=find(d.floor!,'TREASURE');const claim=resolveRoom(d.floor!,player(),d.map,r.id,'gear');
  expect(saveGame({player:claim.player,map:claim.map,decorations:d.decorations,explored:[],clearedTiles:[],dungeonLevel:3,logs:[],date:1,floor:claim.floor})).toBe(true);
  expect(loadGame()?.floor).toEqual(claim.floor);expect(resolveRoom(loadGame()!.floor!,loadGame()!.player,loadGame()!.map,r.id,'gear').accepted).toBe(false);
  const invalid={...claim.floor,keys:-1};expect(isValidFloorState(invalid,d.map)).toBe(false);
 });
});


describe('Dungeon save and resource boundaries',()=>{
 it('namespaces room rewards by floor level, even when the seed is reused',()=>{const a=setup(1),b=setup(3);expect(find(a.floor!,'TREASURE').id).not.toBe(find(b.floor!,'TREASURE').id);});
 it('rejects malformed shrine/hazard data and refuses a mid-encounter save',()=>{
  const d=setup(2);expect(isValidFloorState({...d.floor!,rooms:d.floor!.rooms.map(r=>r.type==='TRAP'?{...r,hazardId:'missing'}:r)},d.map)).toBe(false);
  expect(saveGame({player:player(),map:d.map,decorations:d.decorations,explored:[],clearedTiles:[],dungeonLevel:2,logs:[],date:1,floor:{...d.floor!,pendingEncounterId:find(d.floor!,'COMBAT').id}})).toBe(false);
 });
 it('cannot claim a room with no living party and cannot interact through a closed ordinary door',()=>{
  const d=setup(),p=player(),r=find(d.floor!,'TREASURE');p.party.forEach(c=>c.stats.hp=0);expect(resolveRoom(d.floor!,p,d.map,r.id,'supplies').accepted).toBe(false);
  const f={...d.floor!,rooms:[{...r,anchor:{x:3,y:1}}]},map=[[1,1,1,1,1],[1,0,2,0,1],[1,1,1,1,1]];expect(roomInteraction(f,map,{x:1.5,y:1.5,angle:0})).toBeUndefined();
 });
});


describe('Floor commit consistency',()=>{
 it('reconciles opened gates on load even if a save captured the previous React map snapshot',()=>{
  const store=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)});
  const d=setup(),r=find(d.floor!,'LOCKED');const open=resolveRoom(d.floor!,player(),d.map,r.id,'pay');
  expect(open.floor.rooms.find(x=>x.id===r.id)?.unlocked).toBe(true);
  expect(resolveRoom(open.floor,open.player,d.map,r.id,'pay').accepted).toBe(false);
  saveGame({player:open.player,map:d.map,decorations:d.decorations,explored:[],clearedTiles:[],dungeonLevel:3,logs:[],date:1,floor:open.floor});
  expect(loadGame()?.map[r.gate!.y][r.gate!.x]).toBe(TileType.EMPTY);expect(loadGame()?.player.scrap).toBe(35);
 });
 it('does not downgrade an existing stronger preparation when another room offers the same status',()=>{
  const d=setup(),p=player();const prep=resolveRoom(d.floor!,p,d.map,find(d.floor!,'REST').id,'prepare');
  const event=resolveRoom(prep.floor,prep.player,d.map,find(prep.floor,'EVENT').id,'respect');expect(event.floor.pendingEffects).toEqual([{type:'STRENGTH',value:3,duration:3}]);
 });
});
