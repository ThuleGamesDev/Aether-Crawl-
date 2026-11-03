import React, { useEffect, useRef } from 'react';
import { FPSGameRuntime } from '../engine/FPSGameRuntime';
import { GameLoop } from '../engine/GameLoop';
import { InputSystem } from '../engine/InputSystem';
import { SceneRenderer, type RenderQuality } from '../engine/SceneRenderer';
import type { FPSGameSnapshot } from '../engine/FPSGameRuntime';
import { audioService } from '../services/audioService';
import type { VFXMode } from '../presentation/vfxDefinitions';

interface FPSViewportProps {
  runtime: FPSGameRuntime;
  mouseSensitivity: number;
  vfxMode: VFXMode;
  renderQuality: RenderQuality;
  onSnapshot: (snapshot: FPSGameSnapshot) => void;
  onInputReady: (input: InputSystem | null) => void;
  onFailure: (message: string) => void;
}

const FPSViewport: React.FC<FPSViewportProps> = ({ runtime, mouseSensitivity, vfxMode, renderQuality, onSnapshot, onInputReady, onFailure }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<SceneRenderer | null>(null);
  const sensitivityRef = useRef(mouseSensitivity);
  const vfxModeRef = useRef(vfxMode);
  const renderQualityRef = useRef(renderQuality);
  const callbacksRef = useRef({ onSnapshot, onInputReady, onFailure });
  sensitivityRef.current = mouseSensitivity;
  vfxModeRef.current = vfxMode;
  renderQualityRef.current = renderQuality;
  callbacksRef.current = { onSnapshot, onInputReady, onFailure };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: SceneRenderer | null = null;
    let input: InputSystem | null = null;
    let loop: GameLoop | null = null;
    try {
      renderer = new SceneRenderer(canvas, runtime.world, renderQualityRef.current);
      rendererRef.current = renderer;
      renderer.setVfxMode(vfxModeRef.current);
      input = new InputSystem(canvas, () => sensitivityRef.current);
      callbacksRef.current.onInputReady(input);
      let sinceSnapshot = 0;
      let lastRenderTime = 0;
      loop = new GameLoop(renderer.renderer, delta => {
        if (!input) return;
        runtime.update(delta, input.readFrame());
        sinceSnapshot += delta;
        if (sinceSnapshot >= 0.1) {
          callbacksRef.current.onSnapshot(runtime.getSnapshot());
          sinceSnapshot = 0;
        }
      }, (interpolation, elapsedSeconds) => {
        if (!renderer) return;
        const deltaSeconds = lastRenderTime > 0 ? Math.min(0.05, Math.max(0, elapsedSeconds - lastRenderTime)) : 1 / 60;
        lastRenderTime = elapsedSeconds;
        const state = runtime.getRenderState();
        for (const event of state.events) if (event.sound) audioService.playCombatCue(event.sound, event.position);
        renderer.renderFrame({ ...state, deltaSeconds, elapsedSeconds: elapsedSeconds + interpolation / 60 });
        if (import.meta.env.DEV) canvas.dataset.r6f1RenderDiagnostics = JSON.stringify(renderer.getDiagnostics());
      });
      loop.start();
      callbacksRef.current.onSnapshot(runtime.getSnapshot());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The WebGL renderer could not be created.';
      callbacksRef.current.onFailure(message);
      loop?.stop();
      input?.dispose();
      rendererRef.current = null;
      renderer?.dispose();
    }
    return () => {
      callbacksRef.current.onInputReady(null);
      loop?.stop();
      input?.dispose();
      if (rendererRef.current === renderer) rendererRef.current = null;
      renderer?.dispose();
    };
  }, [runtime]);

  useEffect(() => {
    rendererRef.current?.setVfxMode(vfxMode);
  }, [vfxMode]);

  useEffect(() => {
    rendererRef.current?.setRenderQuality(renderQuality);
  }, [renderQuality]);

  return <canvas ref={canvasRef} className="fps-world-canvas" aria-label="Maze of the Minotaur first-person labyrinth" data-maze-fps-viewport />;
};

export default FPSViewport;
