import * as THREE from 'three';
import type { BiomeId, WeaponVisualType } from '../types';
import type { PixelEffectId } from './vfxDefinitions';

interface Palette { wall: string; wallLight: string; floor: string; floorLight: string; accent: string; }

const palettes: Record<BiomeId, Palette> = {
  dungeon: { wall: '#4c463e', wallLight: '#857967', floor: '#242322', floorLight: '#49433a', accent: '#b4874f' },
  moss: { wall: '#3d4a40', wallLight: '#78826c', floor: '#1d2622', floorLight: '#38453b', accent: '#77946c' },
  catacombs: { wall: '#4b4944', wallLight: '#858073', floor: '#202020', floorLight: '#48443d', accent: '#ad7651' },
  obsidian: { wall: '#30292a', wallLight: '#695855', floor: '#181617', floorLight: '#352a29', accent: '#a34f40' },
  frost: { wall: '#3e4d4b', wallLight: '#7c9490', floor: '#1a2423', floorLight: '#35413d', accent: '#739491' },
  gilded: { wall: '#393132', wallLight: '#756151', floor: '#191718', floorLight: '#3a302e', accent: '#bd794a' },
};

export function createPixelTexture(kind: 'wall' | 'floor' | 'ceiling' | 'door' | 'exit' | 'loot' | 'enemy', biome: BiomeId, visualId = ''): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable for pixel texture preparation.');
  context.imageSmoothingEnabled = false;
  const colors = palettes[biome];
  if (kind === 'wall') drawWall(context, colors);
  else if (kind === 'floor') drawFloor(context, colors);
  else if (kind === 'ceiling') drawCeiling(context, colors);
  else if (kind === 'door') drawDoor(context, colors);
  else if (kind === 'exit') drawExit(context, colors);
  else if (kind === 'loot') drawLoot(context, colors);
  else drawEnemy(context, visualId, colors);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

export function createWeaponTexture(weaponType: WeaponVisualType, classId: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable for weapon sprite preparation.');
  context.imageSmoothingEnabled = false;
  const sleeve = classId === 'SORCERER' ? '#3e6764' : classId === 'NECROMANCER' ? '#60333a' : classId === 'PALADIN' || classId === 'CLERIC' ? '#9b7644' : '#733c32';
  context.fillStyle = '#151418';
  context.fillRect(38, 47, 16, 17);
  context.fillStyle = sleeve;
  context.fillRect(34, 42, 18, 20);
  context.fillStyle = '#b78262';
  context.fillRect(38, 36, 13, 12);
  if (weaponType === 'staff' || weaponType === 'mace') {
    context.fillStyle = '#68472c'; context.fillRect(48, 5, 5, 49);
    context.fillStyle = classId === 'NECROMANCER' ? '#a94e52' : classId === 'SORCERER' ? '#83aaa0' : '#c39858'; context.fillRect(43, 2, 15, 9);
    context.fillStyle = '#e1d4a6'; context.fillRect(47, 1, 7, 3);
  } else if (weaponType === 'axe') {
    context.fillStyle = '#614329'; context.fillRect(45, 16, 5, 38);
    context.fillStyle = '#b4874f'; context.fillRect(37, 10, 9, 13); context.fillRect(48, 10, 9, 13);
    context.fillStyle = '#e2c48a'; context.fillRect(38, 10, 7, 4); context.fillRect(49, 10, 7, 4);
  } else if (weaponType === 'spear') {
    context.fillStyle = '#765333'; context.fillRect(48, 15, 4, 42);
    context.fillStyle = '#c8c2aa'; context.fillRect(46, 6, 8, 14); context.fillRect(43, 18, 14, 3);
    context.fillStyle = '#e1d6b9'; context.fillRect(48, 7, 3, 9);
  } else if (weaponType === 'bow') {
    context.fillStyle = '#8a562d'; context.fillRect(44, 9, 5, 40); context.fillRect(39, 12, 5, 7); context.fillRect(39, 39, 5, 7);
    context.fillStyle = '#d9d1bd'; context.fillRect(49, 13, 2, 32);
  } else {
    context.fillStyle = '#6c5038'; context.fillRect(47, 35, 5, 18);
    context.fillStyle = weaponType === 'dagger' ? '#c4c5bd' : '#d5d7d2';
    context.fillRect(46, 9, 7, 28); context.fillRect(41, 35, 17, 4);
    context.fillStyle = '#f1f1df'; context.fillRect(48, 10, 3, 21);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/** Small hand-shaped pixel bursts used by the real-time combat layer. Created once per effect and cached. */
export function createCombatEffectTexture(effectId: PixelEffectId): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable for combat effect preparation.');
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, 32, 32);
  const blockLine = (x0: number, y0: number, x1: number, y1: number, color: string, size = 2) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    context.fillStyle = color;
    for (let i = 0; i <= steps; i += 1) {
      const x = Math.round(x0 + (x1 - x0) * i / Math.max(1, steps));
      const y = Math.round(y0 + (y1 - y0) * i / Math.max(1, steps));
      context.fillRect(x, y, size, size);
    }
  };
  const pixelRing = (cx: number, cy: number, radius: number, color: string, thickness = 2) => {
    const steps = Math.max(16, Math.round(radius * 7));
    context.fillStyle = color;
    for (let i = 0; i < steps; i += 1) {
      const angle = i / steps * Math.PI * 2;
      context.fillRect(Math.round(cx + Math.cos(angle) * radius), Math.round(cy + Math.sin(angle) * radius), thickness, thickness);
    }
  };
  if (effectId === 'bronze_slash') {
    blockLine(7, 24, 20, 9, '#9b482f', 5); blockLine(9, 22, 22, 7, '#e7a553', 3); blockLine(11, 20, 23, 6, '#fff0bf', 1);
  } else if (effectId === 'spear_thrust' || effectId === 'dory_thrust') {
    context.fillStyle = '#f2dfad'; context.fillRect(5, 15, 21, 2); context.fillRect(9, 13, 15, 1);
    context.fillStyle = '#bd8750'; context.fillRect(4, 16, 17, 1); context.fillStyle = '#fff0c2'; context.fillRect(24, 14, 4, 4); context.fillRect(28, 15, 2, 2);
  } else if (effectId === 'shield_impact' || effectId === 'aspis_impact') {
    pixelRing(16, 16, 6, '#f6d17d', 3); pixelRing(16, 16, 12, '#a66e42', 2);
    blockLine(4, 14, 9, 11, '#fff1bc', 2); blockLine(22, 20, 27, 17, '#fff1bc', 2);
  } else if (effectId === 'blood_hit') {
    context.fillStyle = '#371d25'; context.fillRect(14, 10, 5, 13); context.fillStyle = '#b44747'; context.fillRect(11, 12, 11, 8);
    context.fillStyle = '#ee8b63'; context.fillRect(13, 14, 6, 4); context.fillRect(4, 8, 3, 3); context.fillRect(25, 7, 2, 3); context.fillRect(8, 25, 3, 2); context.fillRect(23, 25, 4, 3);
  } else if (effectId === 'poison_splash' || effectId === 'arachne_venom' || effectId === 'serpent_venom' || effectId === 'venom_droplets') {
    context.fillStyle = '#506a36'; context.fillRect(12, 11, 8, 10); context.fillStyle = '#9db84f'; context.fillRect(8, 14, 16, 6); context.fillRect(14, 7, 4, 18);
    context.fillStyle = '#d3dc7c'; context.fillRect(6, 9, 3, 3); context.fillRect(24, 12, 3, 3); context.fillRect(9, 23, 3, 3); context.fillRect(22, 23, 2, 2);
  } else if (effectId === 'web_impact' || effectId === 'web_snare' || effectId === 'web_threads') {
    for (let spoke = 0; spoke < 8; spoke += 1) {
      const angle = spoke * Math.PI / 4;
      blockLine(16, 16, Math.round(16 + Math.cos(angle) * 13), Math.round(16 + Math.sin(angle) * 13), '#dae0be', 1);
    }
    pixelRing(16, 16, 6, '#a9b896', 1); pixelRing(16, 16, 11, '#c8d2b7', 1);
  } else if (effectId === 'fire_burst' || effectId === 'promethean_flame' || effectId === 'flame_core' || effectId === 'fire_embers') {
    context.fillStyle = '#7a282d'; context.fillRect(8, 17, 16, 10); context.fillStyle = '#df5633'; context.fillRect(10, 11, 12, 14); context.fillRect(6, 17, 5, 7); context.fillRect(21, 16, 5, 8);
    context.fillStyle = '#ffb64d'; context.fillRect(13, 6, 6, 17); context.fillRect(8, 12, 4, 8); context.fillStyle = '#fff1a8'; context.fillRect(14, 10, 4, 10);
  } else if (effectId === 'stone_shockwave' || effectId === 'stone_chips' || effectId === 'stone_dust') {
    pixelRing(16, 18, 6, '#d9b07a', 2); pixelRing(16, 18, 12, '#a26a4b', 2); pixelRing(16, 18, 15, '#e2c18d', 1);
    context.fillStyle = '#f4d29c'; context.fillRect(14, 4, 4, 3); context.fillRect(4, 16, 3, 3); context.fillRect(25, 16, 3, 3);
  } else if (effectId === 'chthonic_bolt') {
    blockLine(16, 3, 11, 11, '#4e273e', 6); blockLine(11, 11, 19, 15, '#87405e', 5); blockLine(19, 15, 12, 24, '#c56d80', 4); blockLine(12, 24, 15, 30, '#f2bd8d', 2);
  } else if (effectId === 'oracle_spark') {
    blockLine(16, 2, 10, 12, '#559eac', 5); blockLine(10, 12, 18, 15, '#8edce0', 4); blockLine(18, 15, 11, 27, '#d1f3df', 3);
    context.fillStyle = '#fff0c2'; context.fillRect(22, 7, 4, 4);
  } else if (effectId === 'metal_sparks') {
    blockLine(16, 16, 16, 2, '#fff0c2', 2); blockLine(16, 16, 28, 6, '#e7b961', 2);
    blockLine(16, 16, 30, 16, '#fff0c2', 2); blockLine(16, 16, 25, 27, '#e7b961', 2);
  } else if (effectId === 'water_splash' || effectId === 'cistern_splash') {
    pixelRing(16, 20, 8, '#79c4c9', 2); context.fillStyle = '#bde9e2'; context.fillRect(8, 9, 3, 4); context.fillRect(22, 5, 3, 4); context.fillRect(15, 2, 2, 4);
  } else if (effectId === 'guardian_sigil' || effectId === 'warden_delayed_sigil' || effectId === 'serpent_cone') {
    pixelRing(16, 16, 13, '#de685d', 2); pixelRing(16, 16, 8, '#f1bc73', 1);
    blockLine(16, 4, 16, 28, '#e96d60', 2); blockLine(4, 16, 28, 16, '#e96d60', 2);
  } else if (effectId === 'boss_death_burst' || effectId === 'guardian_death') {
    pixelRing(16, 16, 7, '#e3a052', 3); pixelRing(16, 16, 13, '#913b42', 2); context.fillStyle = '#171417'; context.fillRect(11, 10, 10, 12);
    context.fillStyle = '#d5be91'; context.fillRect(13, 12, 2, 2); context.fillRect(18, 12, 2, 2); context.fillRect(14, 18, 4, 2);
    blockLine(16, 0, 16, 6, '#f4c16d', 2); blockLine(2, 16, 7, 16, '#f4c16d', 2); blockLine(25, 16, 30, 16, '#f4c16d', 2);
  } else {
    pixelRing(16, 16, 10, '#d4ad68', 2); blockLine(8, 20, 22, 8, '#fff0b4', 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function createEnemyTexture(visualId: string, biome: BiomeId): THREE.CanvasTexture {
  return createPixelTexture('enemy', biome, visualId);
}

function drawWall(context: CanvasRenderingContext2D, colors: Palette): void {
  context.fillStyle = colors.wall; context.fillRect(0, 0, 32, 32);
  for (let row = 0; row < 4; row += 1) {
    const y = row * 8;
    const offset = row % 2 ? -4 : 0;
    for (let col = 0; col < 5; col += 1) {
      const x = col * 8 + offset;
      context.fillStyle = row % 2 ? colors.wallLight : '#4b3f37';
      context.fillRect(x + 1, y + 1, 7, 6);
      context.fillStyle = colors.wall;
      context.fillRect(x + 7, y, 1, 8);
      if ((row + col) % 3 === 0) { context.fillStyle = colors.accent; context.fillRect(x + 2, y + 5, 2, 1); }
    }
  }
  context.fillStyle = '#171719'; context.fillRect(0, 0, 32, 1); context.fillRect(0, 31, 32, 1);
}

function drawFloor(context: CanvasRenderingContext2D, colors: Palette): void {
  context.fillStyle = colors.floor; context.fillRect(0, 0, 32, 32);
  context.fillStyle = colors.floorLight;
  for (let i = 0; i < 18; i += 1) {
    const x = (i * 13 + 5) % 31, y = (i * 19 + 3) % 31;
    context.fillRect(x, y, i % 3 === 0 ? 3 : 2, 1);
  }
  context.fillStyle = '#171719'; context.fillRect(0, 0, 32, 1); context.fillRect(0, 31, 32, 1);
}

function drawCeiling(context: CanvasRenderingContext2D, colors: Palette): void {
  context.fillStyle = '#17171b'; context.fillRect(0, 0, 32, 32);
  context.fillStyle = colors.wall; context.fillRect(2, 3, 28, 4); context.fillRect(4, 15, 24, 2); context.fillRect(2, 26, 28, 4);
}

function drawDoor(context: CanvasRenderingContext2D, colors: Palette): void {
  context.fillStyle = '#211916'; context.fillRect(0, 0, 32, 32);
  context.fillStyle = '#65482e'; context.fillRect(3, 1, 26, 31);
  context.fillStyle = '#9a7547'; context.fillRect(5, 2, 3, 28); context.fillRect(24, 2, 3, 28);
  context.fillStyle = '#3a291d'; for (let y = 5; y < 31; y += 6) context.fillRect(8, y, 16, 2);
  context.fillStyle = colors.accent; context.fillRect(22, 17, 2, 4);
}

function drawExit(context: CanvasRenderingContext2D, colors: Palette): void {
  context.fillStyle = '#10171a'; context.fillRect(0, 0, 32, 32);
  context.fillStyle = colors.accent; context.fillRect(3, 2, 3, 27); context.fillRect(26, 2, 3, 27); context.fillRect(6, 2, 20, 3);
  context.fillStyle = '#183842'; context.fillRect(8, 7, 16, 21);
  context.fillStyle = '#68d5d2'; context.fillRect(13, 8, 6, 19); context.fillRect(10, 12, 12, 11);
}

function drawLoot(context: CanvasRenderingContext2D, colors: Palette): void {
  context.clearRect(0, 0, 32, 32);
  context.fillStyle = '#000000'; context.fillRect(8, 8, 17, 17);
  context.fillStyle = colors.accent; context.fillRect(8, 7, 15, 15); context.fillRect(13, 3, 7, 23);
  context.fillStyle = '#fff1b0'; context.fillRect(13, 9, 6, 5); context.fillRect(6, 13, 20, 4);
}

function drawEnemy(context: CanvasRenderingContext2D, visualId: string, colors: Palette): void {
  context.clearRect(0, 0, 32, 32);
  if (visualId === 'giant_rat') {
    context.fillStyle = '#161419'; context.fillRect(7, 17, 19, 9); context.fillRect(20, 13, 8, 9); context.fillRect(22, 10, 4, 4);
    context.fillStyle = '#78483f'; context.fillRect(10, 17, 13, 7); context.fillRect(22, 14, 6, 6);
    context.fillStyle = '#b47a69'; context.fillRect(24, 11, 3, 3); context.fillRect(27, 17, 3, 2);
    context.fillStyle = '#edc460'; context.fillRect(25, 14, 2, 2);
    context.fillStyle = '#8b584b'; context.fillRect(2, 18, 7, 2); context.fillRect(0, 16, 3, 2); context.fillRect(6, 24, 3, 4); context.fillRect(19, 24, 3, 4);
  } else if (visualId === 'skeleton_warrior' || visualId === 'skeleton') {
    context.fillStyle = '#17171a'; context.fillRect(12, 4, 9, 8); context.fillRect(11, 13, 11, 10); context.fillRect(10, 23, 4, 8); context.fillRect(19, 23, 4, 8);
    context.fillStyle = '#d7cdb5'; context.fillRect(13, 4, 7, 6); context.fillRect(13, 12, 7, 8);
    context.fillStyle = '#fff0c5'; context.fillRect(14, 5, 4, 2); context.fillRect(13, 13, 7, 2); context.fillRect(13, 17, 7, 1);
    context.fillStyle = '#b8ad98'; context.fillRect(6, 13, 5, 3); context.fillRect(5, 16, 2, 8); context.fillRect(21, 13, 5, 3); context.fillRect(25, 16, 2, 8);
    context.fillStyle = '#564b47'; context.fillRect(26, 8, 2, 18); context.fillRect(23, 8, 8, 3);
    context.fillStyle = colors.accent; context.fillRect(14, 7, 2, 2); context.fillRect(18, 7, 2, 2);
  } else {
    context.fillStyle = '#17171a'; context.fillRect(10, 4, 12, 26); context.fillRect(5, 13, 22, 14);
    context.fillStyle = '#51465d'; context.fillRect(12, 5, 8, 23); context.fillRect(7, 14, 18, 11);
    context.fillStyle = colors.accent; context.fillRect(14, 8, 3, 3); context.fillRect(17, 8, 3, 3);
  }
}
