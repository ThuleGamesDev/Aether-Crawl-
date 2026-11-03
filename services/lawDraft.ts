import type { ActiveMazeLaw, MazeLawDraft, MazeLawId, MazeLawProgress } from '../types';
import { getMazeLaw, INITIAL_MAZE_LAW_POOL, MAZE_LAW_CATEGORIES, MAZE_LAW_POOL_VERSION, MAZE_LAWS } from '../data/mazeLaws';

export function createEmptyMazeLawProgress(): MazeLawProgress {
  return { version: 1, activeLaws: [], choiceHistory: [] };
}

export function createLawDraft(seed: number, guardianId: string, floorLevel: number, poolIds: readonly MazeLawId[] = INITIAL_MAZE_LAW_POOL, poolVersion = MAZE_LAW_POOL_VERSION): MazeLawDraft {
  if (!Number.isInteger(seed) || !Number.isInteger(floorLevel) || floorLevel < 1 || !Number.isInteger(poolVersion) || poolVersion < 1 || poolVersion > 255 || !guardianId) throw new Error('The Loom of Fate requires a valid Guardian floor and unlock pool.');
  const pool = [...new Set(poolIds)].filter(id => getMazeLaw(id)).sort();
  const draftSeed = hash32(`${seed >>> 0}|${guardianId}|${floorLevel}|${poolVersion}`);
  const lawIds = MAZE_LAW_CATEGORIES.map((category, index) => {
    const categoryPool = pool.filter(id => getMazeLaw(id)?.category === category);
    if (!categoryPool.length) throw new Error('The Loom of Fate requires at least one unlocked law in every category.');
    return categoryPool[hash32(`${draftSeed}|${category}|${index}`) % categoryPool.length];
  }) as MazeLawDraft['lawIds'];
  return { version: 1, offerId: `loom_${floorLevel}_${guardianId}_${poolVersion}_${draftSeed.toString(16)}`, guardianId, floorLevel, poolVersion, lawIds, open: false };
}

export function openLawDraft(progress: MazeLawProgress, seed: number, guardianId: string, floorLevel: number): MazeLawProgress {
  if (progress.draft?.guardianId === guardianId && progress.draft.floorLevel === floorLevel) {
    return { ...progress, draft: { ...progress.draft, open: !progress.draft.selectedLawId } };
  }
  return { ...progress, draft: { ...createLawDraft(seed, guardianId, floorLevel), open: true } };
}

export function selectMazeLaw(progress: MazeLawProgress, lawId: MazeLawId, replacementId?: MazeLawId): MazeLawProgress | null {
  const draft = progress.draft;
  if (!draft || draft.selectedLawId || !draft.lawIds.includes(lawId)) return null;
  const definition = getMazeLaw(lawId);
  if (!definition) return null;
  const existing = progress.activeLaws.find(law => law.lawId === lawId);
  const needsReplacement = !existing && progress.activeLaws.length >= 3;
  if (needsReplacement && (!replacementId || !progress.activeLaws.some(law => law.lawId === replacementId))) return null;
  if (!needsReplacement && replacementId) return null;
  const retained = needsReplacement ? progress.activeLaws.filter(law => law.lawId !== replacementId) : [...progress.activeLaws];
  if (retained.some(law => definition.incompatibilities.includes(law.lawId) || getMazeLaw(law.lawId)?.incompatibilities.includes(lawId))) return null;
  const nextOrder = progress.activeLaws.reduce((max, law) => Math.max(max, law.acquiredOrder), 0) + (existing ? 0 : 1);
  const selected: ActiveMazeLaw = existing
    ? existing
    : { lawId, selectedAtFloor: draft.floorLevel, acquiredOrder: nextOrder, firstManifestedFloor: null, lastManifestedFloor: null, manifestationCount: 0 };
  const activeLaws = [...retained.filter(law => law.lawId !== lawId), selected].sort((a, b) => a.acquiredOrder - b.acquiredOrder);
  if (activeLaws.length > 3 || new Set(activeLaws.map(law => law.lawId)).size !== activeLaws.length) return null;
  const choiceHistory = [...progress.choiceHistory, { offerId: draft.offerId, lawId, ...(needsReplacement ? { replacedLawId: replacementId } : {}), floorLevel: draft.floorLevel }].slice(-32);
  return { ...progress, activeLaws, choiceHistory, draft: { ...draft, selectedLawId: lawId, replacedLawId: needsReplacement ? replacementId : undefined, pendingLawId: undefined, open: false } };
}

export function getOldestActiveLaw(progress: MazeLawProgress): ActiveMazeLaw | undefined {
  return [...progress.activeLaws].sort((a, b) => a.acquiredOrder - b.acquiredOrder)[0];
}

function hash32(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return hash >>> 0;
}
