import React from 'react';
import type { AbilityDefinition } from '../combat/AbilityRegistry';

export type ActionGlyphKind =
  | 'sword' | 'hook' | 'axe' | 'spear' | 'bow' | 'staff' | 'daggers'
  | 'maul' | 'shield' | 'focus' | 'fist' | 'flame' | 'venom' | 'healing' | 'arcane';

const paths: Record<ActionGlyphKind, string[]> = {
  sword: ['M15 2l6 6-9 10-4-1-2-4z', 'M6 15l4 4-4 3-3-3z', 'M14 9l3 3'],
  hook: ['M17 3l4 4-7 10-5 2-3-3 4-3z', 'M5 16l4 4-4 3-3-3z', 'M14 9l3 3'],
  axe: ['M14 3l7 3-1 8-6 2-3-4 2-5z', 'M13 8L6 21', 'M5 17l4 3'],
  spear: ['M18 2l4 5-4 1-2-2L6 19', 'M4 18l3 3', 'M3 21l3-2'],
  bow: ['M8 3c-7 5-7 13 0 18', 'M8 3l10 9L8 21', 'M6 12h10'],
  staff: ['M8 21L16 4', 'M13 4l3-3 4 3-3 4z', 'M6 19l4 2'],
  daggers: ['M8 3l4 2-3 12-4 2 1-6z', 'M5 14l3 1-2 5-3 1z', 'M16 2l4 3-3 12-4 2 1-6z', 'M13 14l3 1-2 5-3 1z'],
  maul: ['M9 21l7-12', 'M13 3l7 2-1 5-7-2z', 'M6 19l4 2'],
  shield: ['M12 2l8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5z', 'M8 12l3 3 5-6'],
  focus: ['M12 2v20', 'M2 12h20', 'M5 5l14 14', 'M19 5L5 19', 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z'],
  fist: ['M5 13V8a2 2 0 0 1 4 0V5a2 2 0 0 1 4 0v3-2a2 2 0 0 1 4 0v3a2 2 0 0 1 4 0v6l-4 6H9z', 'M5 12l-2 2 3 5'],
  flame: ['M13 2c1 5-2 6-2 9 0 1 1 2 2 2 2-2 2-4 2-5 4 4 6 7 4 11-2 3-7 4-11 1-4-3-3-9 1-12 0 3 1 4 2 4 2-3 0-6 2-10z'],
  venom: ['M12 2v20', 'M4 6l16 12', 'M20 6L4 18', 'M8 3l4 2 4-2 2 5-6 4-6-4z', 'M9 16l3 2 3-2'],
  healing: ['M12 3v18', 'M3 12h18', 'M5 5l14 14', 'M19 5L5 19'],
  arcane: ['M12 2l2.4 6.2L21 11l-6.6 2.8L12 21l-2.4-7.2L3 11l6.6-2.8z', 'M18 2v5', 'M16 4.5h4'],
};

const familyGlyphs: Record<string, ActionGlyphKind> = {
  XIPHOS: 'sword', KOPIS: 'hook', LABRYS: 'axe', DORY: 'spear', BOW: 'bow',
  STAFF: 'staff', DAGGERS: 'daggers', MAUL: 'maul', SHIELD: 'shield',
  FOCUS: 'focus', UNARMED: 'fist',
};

export function actionGlyphForFamily(family: string): ActionGlyphKind {
  return familyGlyphs[family] ?? 'arcane';
}

export function actionGlyphForSkill(ability: Pick<AbilityDefinition, 'id' | 'kind' | 'element' | 'meleeStyle'>): ActionGlyphKind {
  const id = ability.id.toLowerCase();
  if (id.includes('heal') || id.includes('sanctuary') || id.includes('mend')) return 'healing';
  if (id.includes('poison') || id.includes('venom')) return 'venom';
  if (id.includes('fire') || id.includes('flame') || ability.element === 'FIRE') return 'flame';
  if (ability.meleeStyle === 'BASH') return 'maul';
  if (ability.kind === 'MELEE') return 'sword';
  if (ability.kind === 'PROJECTILE') return 'spear';
  if (ability.kind === 'AOE') return 'arcane';
  return 'focus';
}

const ActionGlyph: React.FC<{ kind: ActionGlyphKind; className?: string }> = ({ kind, className = '' }) => <svg
  className={'fps-action-glyph ' + className}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  strokeWidth="1.7"
  strokeLinecap="square"
  strokeLinejoin="miter"
  aria-hidden="true"
>
  {paths[kind].map((path, index) => <path key={index} d={path} />)}
</svg>;

export default ActionGlyph;
