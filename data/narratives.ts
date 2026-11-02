import { getBiomeIdForLevel } from './assetRegistry';

const ambientNarratives: Record<string, string[]> = {
  dungeon: [
    'A red thread is knotted around a cracked limestone block.',
    'Somewhere beneath the palace, bronze scrapes slowly over stone.',
    'A painted bull watches from a flaking fragment of fresco.',
  ],
  moss: [
    'Serpent patterns vanish beneath slick green growth.',
    'A coppery vapor curls from a drain cut into the offering floor.',
    'The damp stone smells of crushed leaves and old incense.',
  ],
  catacombs: [
    'The blocks here are larger than the rooms that contain them.',
    'A mason’s plumb line sways though no wind reaches this depth.',
    'An unfinished column bears a single watching eye.',
  ],
  frost: [
    'The cistern water reflects a torch that is not behind you.',
    'A submerged stair disappears beneath glass-dark water.',
    'Droplets fall at different times from the ceiling and its reflection.',
  ],
  gilded: [
    'Red votive wax has run down a black stone altar.',
    'A funerary seal has been split from the inside.',
    'The air grows warm as the chthonic carvings deepen.',
  ],
  obsidian: [
    'A bull relief has been struck hard enough to break the surrounding wall.',
    'A pair of bronze horns lies beneath a veil of dust.',
    'The stones tremble once, far below, then fall silent.',
  ],
};

const featureNarratives = {
  door: 'Bronze hinges complain beyond the sealed passage.',
  light: 'The oil-flame leans toward a painted maze on the wall.',
  quiet: 'The Labyrinth falls still. Your own breathing fills the passage.',
};

export const getExplorationNarrative = (level: number, nearDoor: boolean, nearLight: boolean, step: number): string => {
  if (nearDoor) return featureNarratives.door;
  if (nearLight) return featureNarratives.light;
  if (step % 4 === 0) return featureNarratives.quiet;
  const lines = ambientNarratives[getBiomeIdForLevel(level)];
  return lines[step % lines.length];
};
