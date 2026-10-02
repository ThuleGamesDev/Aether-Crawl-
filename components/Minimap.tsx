import React, { useEffect, useRef } from 'react';
import { PlayerTransform, TileType } from '../types';
import { MAP_SIZE } from '../constants';

interface MinimapProps {
  map: number[][];
  explored: boolean[][];
  transformRef: React.RefObject<PlayerTransform>;
  size?: number;
  className?: string;
}

const Minimap: React.FC<MinimapProps> = ({
  map,
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
      const tileSize = canvas.width / MAP_SIZE;

      for (let y = 0; y < Math.min(MAP_SIZE, map.length); y += 1) {
        for (let x = 0; x < Math.min(MAP_SIZE, map[y]?.length ?? 0); x += 1) {
          if (!explored[y]?.[x]) continue;
          const tile = map[y][x];
          if (tile === TileType.WALL) ctx.fillStyle = '#74716b';
          else if (tile === TileType.DOOR) ctx.fillStyle = '#b97840';
          else if (tile === TileType.EXIT) ctx.fillStyle = '#f1c85d';
          else ctx.fillStyle = '#3a4147';
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(x * tileSize, y * tileSize, Math.max(1, size / 120), tileSize);
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, Math.max(1, size / 120));
        }
      }

      const transform = transformRef.current;
      if (!transform) return;
      const px = transform.x * tileSize;
      const py = transform.y * tileSize;
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
  }, [map, explored, transformRef, size]);

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
