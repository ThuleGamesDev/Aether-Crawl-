import React, { useEffect, useRef } from 'react';
import { Position, Direction, TileType } from '../types';
import { MAP_SIZE } from '../constants';

interface MinimapProps {
  map: number[][];
  explored: boolean[][];
  playerPos: Position;
  playerDir: Direction;
}

const Minimap: React.FC<MinimapProps> = ({ map, explored, playerPos, playerDir }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = 'rgba(15, 15, 15, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Border
    ctx.strokeStyle = '#4a4a4a';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    if (!map.length || !explored.length) return;

    const tileSize = canvas.width / MAP_SIZE;

    // Draw Map
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        if (!explored[y][x]) continue;

        const tile = map[y][x];
        const px = x * tileSize;
        const py = y * tileSize;

        if (tile === TileType.WALL) {
          ctx.fillStyle = '#666';
        } else if (tile === TileType.DOOR) {
          ctx.fillStyle = '#8B4513';
        } else if (tile === TileType.EXIT) {
          ctx.fillStyle = '#FFD700';
        } else {
          ctx.fillStyle = '#2a2a2a'; // Floor
        }
        
        ctx.fillRect(px, py, tileSize, tileSize);
        // Grid lines for pixel art feel
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(px, py, 1, tileSize);
        ctx.fillRect(px, py, tileSize, 1);
      }
    }

    // Draw Player Arrow
    const px = playerPos.x * tileSize + tileSize / 2;
    const py = playerPos.y * tileSize + tileSize / 2;
    
    ctx.translate(px, py);
    
    let angle = 0;
    if (playerDir === 'S') angle = Math.PI;
    if (playerDir === 'W') angle = -Math.PI / 2;
    if (playerDir === 'E') angle = Math.PI / 2;
    
    ctx.rotate(angle);
    
    // Arrow shape
    ctx.fillStyle = '#00FF00';
    ctx.beginPath();
    ctx.moveTo(0, -tileSize * 0.4);
    ctx.lineTo(tileSize * 0.3, tileSize * 0.3);
    ctx.lineTo(-tileSize * 0.3, tileSize * 0.3);
    ctx.closePath();
    ctx.fill();

  }, [map, explored, playerPos, playerDir]);

  return (
    <canvas 
      ref={canvasRef} 
      width={120} 
      height={120} 
      className="rounded border border-gray-600 shadow-xl"
    />
  );
};

export default Minimap;