import type { BiomeId, DungeonRoomType, DungeonRoom } from '../types';
export const roomPresentation: Record<DungeonRoomType, { icon: string; title: string; verb: string; color: string }> = {
 NORMAL: { icon: '·', title: 'Limestone Passage', verb: 'Inspect', color: '#a39a87' },
 COMBAT: { icon: '⚔', title: 'Guarded Gallery', verb: 'Challenge', color: '#c99a5b' },
 ELITE: { icon: '☠', title: 'Votive Chamber', verb: 'Challenge', color: '#bd6254' },
 TREASURE: { icon: '◆', title: 'Forgotten Chamber', verb: 'Open', color: '#ddbd6c' },
 SHRINE: { icon: '✦', title: 'Oracle’s Shrine', verb: 'Pray', color: '#c79b92' },
 TRAP: { icon: '⚠', title: 'Labyrinth Trap', verb: 'Inspect', color: '#bd9a67' },
 SECRET: { icon: '?', title: 'Hidden Stonework', verb: 'Inspect', color: '#b4b4a2' },
 REST: { icon: '♨', title: 'Pilgrim’s Rest', verb: 'Rest', color: '#b08a69' },
 LOCKED: { icon: '🔒', title: 'Sealed Treasury', verb: 'Unlock', color: '#c9a465' },
 EVENT: { icon: '▤', title: 'Broken Labyrinth Tablet', verb: 'Search', color: '#b3a28b' },
 BOSS_ANTECHAMBER: { icon: 'Ω', title: 'Guardian’s Gate', verb: 'Inspect', color: '#c58b66' },
 BOSS: { icon: '☠', title: 'Floor Guardian', verb: 'Challenge', color: '#d36b50' },
};
export const biomeStory: Record<BiomeId, string> = {
 dungeon: 'The Palace Foundations hold the first marks of a maze built beneath the old Cretan court.',
 moss: 'Serpent carvings wind through damp offering halls. Bitter vapor gathers where the stone sweats.',
 catacombs: 'Cyclopean blocks sit too tightly for any human hand. The old builders left no names.',
 frost: 'Black water mirrors the ceiling of the forgotten cisterns. A second figure moves in each reflection.',
 gilded: 'Oxblood offerings stain the steps into the chthonic sanctuaries below the palace.',
 obsidian: 'Monumental bull reliefs face inward. The silence suggests something immense still walks here.',
};

export function roomTitle(room: DungeonRoom): string {
  if (room.type === 'SECRET' && room.discovered) return 'Forgotten Chamber';
  if (room.type === 'SHRINE') return room.shrine === 'blood' ? 'Altar of Ares' : room.shrine === 'fortune' ? 'Offering to Tyche' : 'Oracle’s Shrine';
  return roomPresentation[room.type].title;
}
