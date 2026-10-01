import { getBiomeIdForLevel } from './assetRegistry';

const ambientNarratives: Record<string, string[]> = {
  dungeon: [
    'Cold dust drifts through the torchlight, disturbed by something deeper in the stone.',
    'A distant chain scrapes once across the darkness, then falls still.',
    'The old stones hold the chill of a place long abandoned.',
  ],
  moss: [
    'Water ticks from the ceiling while roots tighten around the ancient masonry.',
    'A sour green glow pulses beneath the moss and fades into the earth.',
    'The air is wet and close, heavy with soil and crushed leaves.',
  ],
  catacombs: [
    'The hollow silence gives every footstep the weight of a funeral bell.',
    'A cold draft slips between the skull niches and stirs a strip of faded cloth.',
    'The bones in the wall seem older than the kingdom that buried them.',
  ],
  obsidian: [
    'Violet light crawls along the black stone like a crack in the night.',
    'Heat gathers beneath the floor, but the air tastes of ash and iron.',
    'The sharp walls catch your torchlight and return it in broken colors.',
  ],
  frost: [
    'Ice groans somewhere beyond the wall, deep and slow as a waking giant.',
    'Your breath clouds in the blue light, then vanishes against the frozen stone.',
    'A thin layer of frost trembles beneath your steps.',
  ],
  gilded: [
    'Gold leaf flakes from the imperial carvings like old autumn leaves.',
    'A distant bell rings once through the marble halls, though no hand is near it.',
    'The bright ornamentation cannot hide the silence beneath it.',
  ],
};

const featureNarratives = {
  door: 'Beyond the sealed door, a slow scrape answers from the other side.',
  light: 'The flame bends toward the passage ahead, though the air is still.',
  quiet: 'For a moment, the dungeon is silent enough to hear your own heartbeat.',
};

export const getExplorationNarrative = (level: number, nearDoor: boolean, nearLight: boolean, step: number): string => {
  if (nearDoor) return featureNarratives.door;
  if (nearLight) return featureNarratives.light;
  if (step % 4 === 0) return featureNarratives.quiet;
  const lines = ambientNarratives[getBiomeIdForLevel(level)];
  return lines[step % lines.length];
};
