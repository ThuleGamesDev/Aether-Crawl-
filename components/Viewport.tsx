import React, { useEffect, useRef } from 'react';
import { biomeVisuals, enemyVisuals, getDecorationAsset, shieldVisual, vfxVisuals, weaponVisuals } from '../data/assetRegistry';
import { getWeaponVisualType } from '../data/weaponVisuals';
import { getImageAsset } from '../services/assetLoader';
import { BiomeId, Enemy, GamePhase, Player, PlayerTransform, TileType, VFXEvent } from '../types';
import { MAP_SIZE, VIEW_DISTANCE } from '../constants';

interface ViewportProps {
  map: number[][];
  decorations: number[][];
  transformRef: React.RefObject<PlayerTransform>;
  biomeId: BiomeId;
  enemies: Enemy[];
  selectedEnemyId: string | null;
  onSelectEnemy: (id: string) => void;
  phase: GamePhase;
  vfx: VFXEvent | null;
  player: Player;
  activeCharIndex: number;
  isMoving: boolean;
  fallbackLookActive: boolean;
  onRequestPointerLock: (canvas: HTMLCanvasElement) => void;
  onFallbackLook: (deltaX: number) => void;
  onFallbackLookEnd: () => void;
}

type SpritePoint = { x: number; y: number; type: number; distance: number };

const Viewport: React.FC<ViewportProps> = ({
  map, decorations, transformRef, biomeId,
  enemies, selectedEnemyId, onSelectEnemy, phase, vfx, player, activeCharIndex,
  isMoving, fallbackLookActive, onRequestPointerLock, onFallbackLook, onFallbackLookEnd,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const frameCountRef = useRef(0);
  const missingAssetReportedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const mobileScale = window.matchMedia?.('(max-width: 767px)').matches ? 0.88 : 0.96;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.25);
      const scale = Math.min(mobileScale * pixelRatio, 1440 / bounds.width, 900 / bounds.height);
      const width = Math.max(320, Math.round(bounds.width * scale));
      const height = Math.max(240, Math.round(bounds.height * scale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        const resizedContext = canvas.getContext('2d');
        if (resizedContext) resizedContext.imageSmoothingEnabled = false;
      }
    };

    resize();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);
    window.addEventListener('resize', resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase === 'EXPLORE' && event.pointerType === 'mouse' && event.button === 0 && canvasRef.current) {
      onRequestPointerLock(canvasRef.current);
    }
  };

  const handlePointerUp = () => {
    if (fallbackLookActive) onFallbackLookEnd();
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (phase === 'EXPLORE' && fallbackLookActive && !document.pointerLockElement) {
      onFallbackLook(event.movementX);
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (phase !== 'COMBAT') return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const targets = enemies.filter(enemy => enemy.hp > 0);
    if (!targets.length) return;
    const index = Math.floor((event.clientX - rect.left) / (rect.width / targets.length));
    if (targets[index]) onSelectEnemy(targets[index].id);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.imageSmoothingEnabled = false;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      if (!width || !height) {
        frameRef.current = requestAnimationFrame(render);
        return;
      }
      frameCountRef.current += 1;
      const frame = frameCountRef.current;
      const biome = biomeVisuals[biomeId];
      const wallImage = getImageAsset(biome.wall);
      const floorImage = getImageAsset(biome.floor);
      const ceilingImage = getImageAsset(biome.ceiling);
      const doorImage = getImageAsset(biome.door);
      const exitImage = getImageAsset(biome.exit);

      if (!wallImage || !floorImage || !ceilingImage || !doorImage || !exitImage) {
        if (!missingAssetReportedRef.current) {
          console.error(`Viewport cannot render biome "${biomeId}": a registered environment asset is missing.`);
          missingAssetReportedRef.current = true;
        }
        context.fillStyle = '#320032';
        context.fillRect(0, 0, width, height);
        context.fillStyle = '#ff8cff';
        context.font = '12px monospace';
        context.fillText(`MISSING ASSET: ${biomeId}`, 20, 28);
        frameRef.current = requestAnimationFrame(render);
        return;
      }
      missingAssetReportedRef.current = false;

      const transform = transformRef.current ?? { x: 1.5, y: 1.5, angle: 0 };
      const positionX = transform.x;
      const positionY = transform.y;
      const directionX = Math.cos(transform.angle);
      const directionY = Math.sin(transform.angle);
      const planeX = -directionY * 0.66;
      const planeY = directionX * 0.66;

      context.fillStyle = '#050505';
      context.fillRect(0, 0, width, height);
      if (!map.length || !map[0]) {
        frameRef.current = requestAnimationFrame(render);
        return;
      }

      drawTexturedPlanes(context, width, height, ceilingImage, floorImage, biome.ambientColor);
      const zBuffer = drawRaycastWalls({
        context, width, height, map, positionX, positionY,
        directionX, directionY, planeX, planeY,
        wallImage, doorImage, exitImage,
      });

      drawDecorations({
        context, width, height, map, decorations, biomeId,
        positionX, positionY, directionX, directionY, planeX, planeY, zBuffer,
      });

      const targets = enemies.filter(enemy => enemy.hp > 0);
      const targetPositions = drawEnemySprites({
        context, width, height, targets, selectedEnemyId, frame,
      });

      drawPlayerHands({ context, width, height, frame, player, activeCharIndex, moving: isMoving });
      drawVfx({ context, width, height, vfx, targetPositions });
      frameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameRef.current);
  }, [map, decorations, transformRef, biomeId, enemies, selectedEnemyId, phase, vfx, player, activeCharIndex, isMoving]);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      aria-label="First-person dungeon view"
      data-aether-viewport
      className="absolute inset-0 block h-full w-full cursor-crosshair bg-black"
      style={{ imageRendering: 'pixelated' }}
    />
  );
};

export default Viewport;

function drawTexturedPlanes(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  ceiling: HTMLImageElement,
  floor: HTMLImageElement,
  ambientColor: string,
) {
  context.drawImage(ceiling, 0, 0, width, height / 2);
  context.drawImage(floor, 0, height / 2, width, height / 2);

  const ceilingShade = context.createLinearGradient(0, 0, 0, height / 2);
  ceilingShade.addColorStop(0, 'rgba(0,0,0,0.82)');
  ceilingShade.addColorStop(1, 'rgba(0,0,0,0.18)');
  context.fillStyle = ceilingShade;
  context.fillRect(0, 0, width, height / 2);

  const floorShade = context.createLinearGradient(0, height / 2, 0, height);
  floorShade.addColorStop(0, 'rgba(0,0,0,0.1)');
  floorShade.addColorStop(1, 'rgba(0,0,0,0.68)');
  context.fillStyle = floorShade;
  context.fillRect(0, height / 2, width, height / 2);

  context.fillStyle = `${ambientColor}14`;
  context.fillRect(0, 0, width, height);
}

function drawRaycastWalls(args: {
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  map: number[][];
  positionX: number;
  positionY: number;
  directionX: number;
  directionY: number;
  planeX: number;
  planeY: number;
  wallImage: HTMLImageElement;
  doorImage: HTMLImageElement;
  exitImage: HTMLImageElement;
}): Float32Array {
  const { context, width, height, map, positionX, positionY, directionX, directionY, planeX, planeY, wallImage, doorImage, exitImage } = args;
  const zBuffer = new Float32Array(width).fill(Infinity);

  for (let screenX = 0; screenX < width; screenX += 4) {
    const cameraX = 2 * screenX / width - 1;
    const rayDirectionX = directionX + planeX * cameraX;
    const rayDirectionY = directionY + planeY * cameraX;
    let mapX = Math.floor(positionX);
    let mapY = Math.floor(positionY);
    const deltaX = Math.abs(1 / rayDirectionX);
    const deltaY = Math.abs(1 / rayDirectionY);
    let stepX: number;
    let stepY: number;
    let sideDistanceX: number;
    let sideDistanceY: number;

    if (rayDirectionX < 0) {
      stepX = -1;
      sideDistanceX = (positionX - mapX) * deltaX;
    } else {
      stepX = 1;
      sideDistanceX = (mapX + 1 - positionX) * deltaX;
    }
    if (rayDirectionY < 0) {
      stepY = -1;
      sideDistanceY = (positionY - mapY) * deltaY;
    } else {
      stepY = 1;
      sideDistanceY = (mapY + 1 - positionY) * deltaY;
    }

    let hit = false;
    let side = 0;
    let tileType = TileType.EMPTY;
    for (let distance = 0; distance < VIEW_DISTANCE * 2 && !hit; distance += 1) {
      if (sideDistanceX < sideDistanceY) {
        sideDistanceX += deltaX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistanceY += deltaY;
        mapY += stepY;
        side = 1;
      }
      if (mapX < 0 || mapX >= MAP_SIZE || mapY < 0 || mapY >= MAP_SIZE) {
        hit = true;
      } else if (map[mapY]?.[mapX] !== TileType.EMPTY) {
        hit = true;
        tileType = map[mapY][mapX];
      }
    }
    if (!hit) continue;

    const wallDistance = side === 0
      ? (mapX - positionX + (1 - stepX) / 2) / rayDirectionX
      : (mapY - positionY + (1 - stepY) / 2) / rayDirectionY;
    for (let offset = 0; offset < 4 && screenX + offset < width; offset += 1) zBuffer[screenX + offset] = wallDistance;

    const lineHeight = Math.floor(height / Math.max(0.05, wallDistance));
    const drawStart = -lineHeight / 2 + height / 2;
    const texture = tileType === TileType.DOOR ? doorImage : tileType === TileType.EXIT ? exitImage : wallImage;
    const wallCoordinate = side === 0
      ? positionY + wallDistance * rayDirectionY
      : positionX + wallDistance * rayDirectionX;
    const wallFraction = wallCoordinate - Math.floor(wallCoordinate);
    let textureX = Math.floor(wallFraction * texture.width);
    if ((side === 0 && rayDirectionX > 0) || (side === 1 && rayDirectionY < 0)) textureX = texture.width - textureX - 1;

    const darkness = Math.max(0.25, 1 - Math.min(0.82, wallDistance / VIEW_DISTANCE));
    context.save();
    context.filter = `brightness(${darkness * (side === 1 ? 0.78 : 1)})`;
    context.drawImage(texture, textureX, 0, 1, texture.height, screenX, drawStart, 4, lineHeight);
    context.restore();

    const fogAlpha = Math.min(0.76, wallDistance / (VIEW_DISTANCE * 1.5));
    context.fillStyle = `rgba(0,0,0,${fogAlpha})`;
    context.fillRect(screenX, drawStart, 4, lineHeight);
  }

  return zBuffer;
}

function drawDecorations(args: {
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  map: number[][];
  decorations: number[][];
  biomeId: BiomeId;
  positionX: number;
  positionY: number;
  directionX: number;
  directionY: number;
  planeX: number;
  planeY: number;
  zBuffer: Float32Array;
}) {
  const { context, width, height, decorations, biomeId, positionX, positionY, directionX, directionY, planeX, planeY, zBuffer } = args;
  const visible: SpritePoint[] = [];
  for (let y = 0; y < MAP_SIZE; y += 1) {
    for (let x = 0; x < MAP_SIZE; x += 1) {
      const type = decorations[y]?.[x] ?? 0;
      if (type <= 0) continue;
      const dx = x + 0.5 - positionX;
      const dy = y + 0.5 - positionY;
      const distance = dx * dx + dy * dy;
      if (distance < VIEW_DISTANCE * VIEW_DISTANCE * 1.5) visible.push({ x: x + 0.5, y: y + 0.5, type, distance });
    }
  }
  visible.sort((a, b) => b.distance - a.distance);

  const determinant = planeX * directionY - directionX * planeY;
  if (!determinant) return;
  const inverseDeterminant = 1 / determinant;

  for (const sprite of visible) {
    const assetPath = getDecorationAsset(biomeId, sprite.type);
    const image = assetPath ? getImageAsset(assetPath) : null;
    if (!image) continue;
    const spriteX = sprite.x - positionX;
    const spriteY = sprite.y - positionY;
    const transformX = inverseDeterminant * (directionY * spriteX - directionX * spriteY);
    const transformY = inverseDeterminant * (-planeY * spriteX + planeX * spriteY);
    if (transformY <= 0.05) continue;

    const screenX = Math.floor((width / 2) * (1 + transformX / transformY));
    const scale = sprite.type === 1 ? 0.52 : 0.68;
    const spriteHeight = Math.abs(Math.floor(height / transformY * scale));
    const spriteWidth = spriteHeight * (image.width / image.height);
    const spriteLeft = Math.floor(screenX - spriteWidth / 2);
    const groundY = sprite.type === 1 ? height * 0.56 : height * 0.91;
    const spriteTop = Math.floor(groundY - spriteHeight);
    const centerColumn = Math.max(0, Math.min(width - 1, screenX));
    if (transformY >= zBuffer[centerColumn]) continue;

    context.save();
    context.filter = `brightness(${Math.max(0.22, 1 - transformY / (VIEW_DISTANCE * 1.4))})`;
    context.drawImage(image, spriteLeft, spriteTop, spriteWidth, spriteHeight);
    context.restore();
  }
}

function drawEnemySprites(args: {
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  targets: Enemy[];
  selectedEnemyId: string | null;
  frame: number;
}): Map<string, { x: number; y: number; size: number }> {
  const { context, width, height, targets, selectedEnemyId, frame } = args;
  const positions = new Map<string, { x: number; y: number; size: number }>();
  targets.forEach((enemy, index) => {
    const visual = enemyVisuals[enemy.visualId];
    if (!visual) {
      console.error(`Enemy "${enemy.id}" references unregistered visual "${enemy.visualId}".`);
      return;
    }
    const image = getImageAsset(visual.sprite);
    if (!image) return;
    const slotWidth = width / (targets.length + 1);
    const requestedSize = height * 0.78 * visual.scale;
    const size = Math.min(requestedSize, slotWidth * 1.82);
    const centerX = slotWidth * (index + 1);
    const groundY = height * (targets.length === 1 ? 0.95 : 0.91);
    const bob = Math.sin((frame + index * 100) * 0.05) * 3;
    const breath = Math.sin((frame + index * 50) * 0.03) * 0.012 + 1;
    const drawWidth = size * breath;
    const drawHeight = size * breath;
    const drawX = centerX - drawWidth / 2;
    const drawY = groundY - drawHeight + bob + (visual.offsetY ?? 0);
    positions.set(enemy.id, { x: centerX, y: drawY + drawHeight * 0.45, size });

    if (selectedEnemyId === enemy.id) {
      context.save();
      context.shadowColor = '#ff342c';
      context.shadowBlur = 24;
      context.fillStyle = '#ff342c';
      context.beginPath();
      context.moveTo(centerX, drawY - 9);
      context.lineTo(centerX - 13, drawY - 28);
      context.lineTo(centerX + 13, drawY - 28);
      context.closePath();
      context.fill();
      context.restore();
    }

    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    const health = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
    const barWidth = size * 0.58;
    const barX = centerX - barWidth / 2;
    const barY = drawY - 8;
    context.fillStyle = '#1b1513';
    context.fillRect(barX, barY, barWidth, 7);
    context.fillStyle = health > 0.5 ? '#74b64a' : health > 0.2 ? '#d6a83a' : '#ba3b37';
    context.fillRect(barX, barY, barWidth * health, 7);

    enemy.statusEffects?.forEach((effect, effectIndex) => {
      context.font = '20px monospace';
      context.fillStyle = '#fff5dc';
      context.fillText(effect.icon, barX + effectIndex * 22, barY - 4);
    });

    if (enemy.intent) {
      const intent = enemy.intent;
      const text = intent.minDamage !== undefined && intent.maxDamage !== undefined
        ? `${intent.icon} ${intent.minDamage}–${intent.maxDamage}`
        : `${intent.icon} ${intent.shortLabel}`;
      const badgeWidth = Math.min(slotWidth * 0.94, 150);
      const fontSize = Math.max(18, Math.min(22, badgeWidth / 8));
      context.save();
      context.font = `bold ${fontSize}px monospace`;
      const measuredWidth = context.measureText(text).width;
      const pillWidth = Math.min(badgeWidth, Math.max(48, measuredWidth + 12));
      const pillHeight = fontSize + 8;
      const pillX = centerX - pillWidth / 2;
      const pillY = Math.max(2, barY - pillHeight - 5);
      context.fillStyle = intent.type === 'HEAVY_ATTACK' ? 'rgba(120, 20, 18, 0.94)'
        : intent.type === 'DEFEND' || intent.type === 'BUFF' || intent.type === 'HEAL' ? 'rgba(18, 60, 82, 0.94)'
        : intent.type === 'PREPARE' || intent.type === 'SUMMON' ? 'rgba(69, 35, 91, 0.94)'
        : 'rgba(28, 24, 20, 0.94)';
      context.fillRect(pillX, pillY, pillWidth, pillHeight);
      context.strokeStyle = intent.type === 'HEAVY_ATTACK' ? '#ff7b5a' : '#d3b46f';
      context.lineWidth = 1;
      context.strokeRect(pillX, pillY, pillWidth, pillHeight);
      context.fillStyle = '#fff5dc';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, centerX, pillY + pillHeight / 2, pillWidth - 6);
      context.restore();
    }
  });
  return positions;
}

function drawPlayerHands(args: {
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  frame: number;
  player: Player;
  activeCharIndex: number;
  moving: boolean;
}) {
  const { context, width, height, frame, player, activeCharIndex, moving } = args;
  const character = player.party[activeCharIndex];
  if (!character) return;
  const weaponPath = weaponVisuals[getWeaponVisualType(character.equipment.weapon)];
  const weaponImage = getImageAsset(weaponPath);
  const offhandImage = character.equipment.offhand?.type === 'SHIELD'
    ? getImageAsset(shieldVisual)
    : getImageAsset(weaponVisuals.unarmed);
  if (!weaponImage || !offhandImage) return;

  const scale = Math.min(1, Math.max(0.55, Math.min(width / 1280, height / 900)));
  const stepBob = moving ? Math.sin(frame * 0.16) * 4 * scale : 0;
  const idleBob = moving ? Math.sin(frame * 0.07) * 2 * scale : 0;
  const bobX = moving ? Math.cos(frame * 0.07) * 2 * scale : 0;
  context.drawImage(offhandImage, -34 * scale + bobX, height - 158 * scale + idleBob + stepBob, 146 * scale, 158 * scale);
  context.drawImage(weaponImage, width - 148 * scale - bobX, height - 172 * scale + idleBob + stepBob, 164 * scale, 172 * scale);
}

function drawVfx(args: {
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  vfx: VFXEvent | null;
  targetPositions: Map<string, { x: number; y: number; size: number }>;
}) {
  const { context, width, height, vfx, targetPositions } = args;
  if (!vfx) return;
  const elapsed = Date.now() - vfx.id;
  const duration = 560;
  if (elapsed < 0 || elapsed >= duration) return;
  const path = vfxVisuals[vfx.type];
  const image = path ? getImageAsset(path) : null;
  if (!image) return;

  const target = vfx.targetId ? targetPositions.get(vfx.targetId) : undefined;
  const size = target ? Math.min(height * 0.6, target.size * 0.8) : height * 0.54;
  const centerX = target?.x ?? width / 2;
  const centerY = target?.y ?? height * 0.48;
  context.save();
  context.globalAlpha = 1 - elapsed / duration;
  context.drawImage(image, centerX - size / 2, centerY - size / 2, size, size);
  context.restore();
}

export default Viewport;
