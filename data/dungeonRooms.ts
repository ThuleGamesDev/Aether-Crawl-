import type { BiomeId, DungeonRoomType, DungeonRoom } from '../types';
export const roomPresentation: Record<DungeonRoomType, { icon: string; title: string; verb: string; color: string }> = {
 NORMAL:{icon:'·',title:'Passage',verb:'Inspect',color:'#8e939c'}, COMBAT:{icon:'⚔',title:'Guarded passage',verb:'Challenge',color:'#db995d'}, ELITE:{icon:'☠',title:'Elite pact',verb:'Challenge',color:'#e97762'}, TREASURE:{icon:'◆',title:'Expedition cache',verb:'Open',color:'#f3c65e'}, SHRINE:{icon:'✦',title:'Aether shrine',verb:'Pray',color:'#c79beb'}, TRAP:{icon:'⚠',title:'Hazardous salvage',verb:'Inspect',color:'#ceaa67'}, SECRET:{icon:'?',title:'Suspicious stonework',verb:'Inspect',color:'#a8b5bd'}, REST:{icon:'♨',title:'Sheltered camp',verb:'Rest',color:'#85c3b4'}, LOCKED:{icon:'🔒',title:'Sealed side vault',verb:'Unlock',color:'#d0ae78'}, EVENT:{icon:'▤',title:'Lost expedition',verb:'Search',color:'#bcb0a0'}, BOSS_ANTECHAMBER:{icon:'Ω',title:'Guardian threshold',verb:'Inspect',color:'#c19974'}, BOSS:{icon:'☠',title:'Guardian',verb:'Challenge',color:'#db7863'},
};
export const biomeStory: Record<BiomeId, string> = {
 dungeon:'A broken camp marks the route of an expedition that never returned. A warning points to seams where cold air leaks through stone.',
 moss:'Roots have swallowed the abandoned camp. Spores hang above an altar grown into the stone.',
 catacombs:'Bone charms surround a forgotten offering. A scratched warning names the cost of borrowing strength from the dead.',
 frost:'A frozen explorer grips a route note. Ice cracks around a shelter that still keeps the wind at bay.',
 gilded:'A dead courier guards the imperial vault ledger. Its gilded seals promise riches at a price.',
 obsidian:'A fractured rune repeats the final words of a lost expedition. The void answers in cold whispers.',
};

export function roomTitle(room: DungeonRoom): string {
  if (room.type === 'SECRET' && room.discovered) return 'Hidden chamber';
  if (room.type === 'SHRINE') return room.shrine === 'blood' ? 'Blood shrine' : room.shrine === 'fortune' ? 'Fortune shrine' : 'Aether shrine';
  return roomPresentation[room.type].title;
}
