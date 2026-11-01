import * as THREE from 'three';
import type { BiomeId, WeaponVisualType } from '../types';

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
