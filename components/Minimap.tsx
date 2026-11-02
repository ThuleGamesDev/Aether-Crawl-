import React, { useEffect, useRef } from 'react';
import { PlayerTransform, TileType, FloorState } from '../types';
import { roomPresentation } from '../data/dungeonRooms';
import { fitMinimapLayout, worldToMinimapPoint } from '../services/minimapLayout';

interface MinimapProps {
  floor?: FloorState | null;
  map: number[][];
  explored: boolean[][];
  transformRef: React.RefObject<PlayerTransform>;
  size?: number;
  className?: string;
}

const Minimap: React.FC<MinimapProps> = ({
  map,
  floor,
  explored,
  transformRef,
  size = 120,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const draw = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(9, 11, 15, 0.88)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(214, 177, 103, 0.65)';
      ctx.lineWidth = Math.max(1, size / 120);
      ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);

      if (!map.length || !explored.length) return;
      const mapWidth = Math.max(0, ...map.map(row => row.length));
      const mapHeight = map.length;
      if (!mapWidth || !mapHeight) return;
      const layout = fitMinimapLayout(canvas.width, canvas.height, mapWidth, mapHeight);
      const { tileSize, offsetX, offsetY } = layout;

      for (let y = 0; y < mapHeight; y += 1) {
        for (let x = 0; x < (map[y]?.length ?? 0); x += 1) {
          if (!explored[y]?.[x]) continue;
          const secret = floor?.rooms.find(r => r.type === 'SECRET' && !r.discovered && r.cells.some(p => p.x === x && p.y === y));
          if (secret && (secret.gate?.x !== x || secret.gate.y !== y)) continue;
          const tile = secret ? TileType.WALL : map[y][x];
          if (tile === TileType.WALL) ctx.fillStyle = '#74716b';
          else if (tile === TileType.LOCKED) ctx.fillStyle = '#795e43';
          else if (tile === TileType.DOOR) ctx.fillStyle = '#b97840';
          else if (tile === TileType.EXIT) ctx.fillStyle = '#f1c85d';
          else ctx.fillStyle = floor?.visitedCells.includes(`${x},${y}`) ? '#586d79' : '#30373e';
          const cellX = offsetX + x * tileSize;
          const cellY = offsetY + y * tileSize;
          ctx.fillRect(cellX, cellY, tileSize, tileSize);
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(cellX, cellY, Math.max(1, size / 120), tileSize);
          ctx.fillRect(cellX, cellY, tileSize, Math.max(1, size / 120));
        }
      }

      for (const room of floor?.rooms ?? []) {
        if (!room.discovered || room.type === 'NORMAL' || !explored[room.anchor.y]?.[room.anchor.x] && !(room.gate && explored[room.gate.y]?.[room.gate.x])) continue;
        const marker = room.gate && (map[room.gate.y][room.gate.x] === TileType.LOCKED) ? room.gate : room.anchor;
        const labels: Record<string,string> = { REST:'R', SHRINE:'S', BOSS:'B', BOSS_ANTECHAMBER:'Ω', SECRET:'?', ELITE:'!', COMBAT:'×', TREASURE:'◆', LOCKED:'L', TRAP:'⚠', EVENT:'▤' };
        const markerPoint = worldToMinimapPoint(marker.x + 0.5, marker.y + 0.5, layout);
        ctx.fillStyle = room.resolved ? '#71818b' : roomPresentation[room.type].color; ctx.font = `bold ${Math.max(4, tileSize * 0.75)}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(labels[room.type] ?? '·', markerPoint.x, markerPoint.y);
      }
      const transform = transformRef.current;
      if (!transform) return;
      const playerPoint = worldToMinimapPoint(transform.x, transform.y, layout);
      const px = playerPoint.x;
      const py = playerPoint.y;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(transform.angle + Math.PI / 2);
      ctx.fillStyle = '#f4cf75';
      ctx.shadowColor = '#f4cf75';
      ctx.shadowBlur = Math.max(2, size / 30);
      ctx.beginPath();
      ctx.moveTo(0, -tileSize * 0.42);
      ctx.lineTo(tileSize * 0.3, tileSize * 0.28);
      ctx.lineTo(0, tileSize * 0.12);
      ctx.lineTo(-tileSize * 0.3, tileSize * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    let frame = 0;
    let lastDraw = 0;
    const tick = (time: number) => {
      if (time - lastDraw >= 100 || lastDraw === 0) {
        draw();
        lastDraw = time;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [map, explored, floor, transformRef, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      aria-label="Dungeon minimap"
      className={`block rounded border border-amber-100/20 shadow-xl ${className}`}
      style={{ width: size, height: size }}
    />
  );
};

export default Minimap;
