import React, { useRef, useEffect, useState } from 'react';
import { Agent, Entity, Vehicle, ParticleEffect, LaserBeam, Mission } from '../types/syndicate';
import { SyndicateCanvasEngine, CameraState } from '../engine/SyndicateCanvasEngine';
import { RotateCcw, RotateCw, ZoomIn, ZoomOut, Compass, Navigation } from 'lucide-react';
import { syndicateAudio } from '../engine/SyndicateAudio';

interface Props {
  agents: Agent[];
  entities: Entity[];
  vehicles: Vehicle[];
  particles: ParticleEffect[];
  lasers: LaserBeam[];
  activeMission: Mission | null;
  onMoveOrder: (targetX: number, targetY: number, agentIds: string[]) => void;
  onAttackOrder: (targetEntityId: string) => void;
  onSelectAgentsBox: (box: { startX: number; startY: number; endX: number; endY: number }) => void;
  selectedAgentIds: string[];
  orbitalBeam: { x: number; y: number; radius: number; life: number } | null;
}

export const IsometricViewport: React.FC<Props> = ({
  agents,
  entities,
  vehicles,
  particles,
  lasers,
  activeMission,
  onMoveOrder,
  onAttackOrder,
  onSelectAgentsBox,
  selectedAgentIds,
  orbitalBeam
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SyndicateCanvasEngine | null>(null);

  const [camera, setCameraState] = useState<CameraState>({ x: 600, y: 600, zoom: 1.0, rotation: 0 });
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [targetMarker, setTargetMarker] = useState<{ x: number; y: number; time: number } | null>(null);

  // Initialize Canvas Engine & Resize Listener
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
    canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;

    engineRef.current = new SyndicateCanvasEngine(canvas);

    const handleResize = () => {
      if (canvas && canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard controls for Camera (WASD, Q/E rotation)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!engineRef.current) return;
      const speed = 40;

      if (e.key === 'q' || e.key === 'Q') {
        rotateCamera(-90);
      } else if (e.key === 'e' || e.key === 'E') {
        rotateCamera(90);
      } else if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        setCameraState(prev => {
          const next = { ...prev, y: prev.y - speed };
          engineRef.current?.setCamera(next);
          return next;
        });
      } else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
        setCameraState(prev => {
          const next = { ...prev, y: prev.y + speed };
          engineRef.current?.setCamera(next);
          return next;
        });
      } else if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        setCameraState(prev => {
          const next = { ...prev, x: prev.x - speed };
          engineRef.current?.setCamera(next);
          return next;
        });
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        setCameraState(prev => {
          const next = { ...prev, x: prev.x + speed };
          engineRef.current?.setCamera(next);
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Main Render Loop
  useEffect(() => {
    let animId: number;

    const loop = () => {
      if (engineRef.current) {
        // Update Target Marker Countdown
        if (targetMarker && targetMarker.time > 0) {
          setTargetMarker(prev => prev ? { ...prev, time: prev.time - 0.05 } : null);
        }

        engineRef.current.render(
          agents,
          entities,
          vehicles,
          particles,
          lasers,
          selectionBox,
          targetMarker,
          orbitalBeam
        );
      }
      animId = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animId);
  }, [agents, entities, vehicles, particles, lasers, selectionBox, targetMarker, orbitalBeam]);

  const rotateCamera = (deltaDegrees: number) => {
    if (!engineRef.current) return;
    setCameraState(prev => {
      const newRot = (prev.rotation + deltaDegrees + 360) % 360;
      const next = { ...prev, rotation: newRot };
      engineRef.current?.setCamera(next);
      syndicateAudio.playSound('CLICK');
      return next;
    });
  };

  const zoomCamera = (deltaZoom: number) => {
    if (!engineRef.current) return;
    setCameraState(prev => {
      const newZoom = Math.min(1.8, Math.max(0.6, prev.zoom + deltaZoom));
      const next = { ...prev, zoom: newZoom };
      engineRef.current?.setCamera(next);
      syndicateAudio.playSound('CLICK');
      return next;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      // Left Click: Drag Selection Box
      setIsSelecting(true);
      setSelectionBox({ startX: e.clientX, startY: e.clientY, endX: e.clientX, endY: e.clientY });
    } else if (e.button === 2) {
      // Right Click: Move / Attack Order
      e.preventDefault();
      if (!engineRef.current) return;

      const worldPos = engineRef.current.screenToWorld(e.clientX, e.clientY);
      setTargetMarker({ x: worldPos.x, y: worldPos.y, time: 1.0 });

      // Check if clicking an entity/enemy
      const clickedEntity = entities.find(ent => {
        const dx = ent.x - worldPos.x;
        const dy = ent.y - worldPos.y;
        return Math.sqrt(dx * dx + dy * dy) < 40;
      });

      if (clickedEntity && clickedEntity.type === 'ENEMY_AGENT') {
        onAttackOrder(clickedEntity.id);
        syndicateAudio.playSound('PISTOL');
      } else {
        onMoveOrder(worldPos.x, worldPos.y, selectedAgentIds);
        syndicateAudio.playSound('CLICK');
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isSelecting && selectionBox) {
      setSelectionBox(prev => prev ? { ...prev, endX: e.clientX, endY: e.clientY } : null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.button === 0 && isSelecting && selectionBox) {
      setIsSelecting(false);
      onSelectAgentsBox(selectionBox);
      setSelectionBox(null);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
        className="h-full w-full cursor-crosshair block"
      />

      {/* Floating Tactical Camera Controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center space-x-1.5 cyber-panel rounded p-1.5">
        <button
          onClick={() => rotateCamera(-90)}
          className="cyber-button p-1.5 rounded"
          title="Rotate Camera Left (Q)"
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        <div className="px-2 text-xs font-mono font-bold text-cyan-400">
          {camera.rotation}°
        </div>

        <button
          onClick={() => rotateCamera(90)}
          className="cyber-button p-1.5 rounded"
          title="Rotate Camera Right (E)"
        >
          <RotateCw className="h-4 w-4" />
        </button>

        <div className="h-4 w-[1px] bg-cyan-900 my-auto mx-1" />

        <button
          onClick={() => zoomCamera(0.2)}
          className="cyber-button p-1.5 rounded"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </button>

        <button
          onClick={() => zoomCamera(-0.2)}
          className="cyber-button p-1.5 rounded"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
