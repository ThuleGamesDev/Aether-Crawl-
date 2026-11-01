import type * as THREE from 'three';

export type FixedUpdate = (deltaSeconds: number) => void;
export type FrameRender = (interpolation: number, elapsedSeconds: number) => void;

export class GameLoop {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly fixedUpdate: FixedUpdate;
  private readonly renderFrame: FrameRender;
  private readonly fixedStep: number;
  private accumulator = 0;
  private lastTimestamp: number | null = null;
  private elapsedSeconds = 0;
  private running = false;

  constructor(renderer: THREE.WebGLRenderer, fixedUpdate: FixedUpdate, renderFrame: FrameRender, fixedStep = 1 / 60) {
    this.renderer = renderer;
    this.fixedUpdate = fixedUpdate;
    this.renderFrame = renderFrame;
    this.fixedStep = fixedStep;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = null;
    this.accumulator = 0;
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.renderer.setAnimationLoop(this.onFrame);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.renderer.setAnimationLoop(null);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.lastTimestamp = null;
    this.accumulator = 0;
  }

  private readonly onVisibilityChange = () => {
    this.lastTimestamp = null;
    this.accumulator = 0;
  };

  private readonly onFrame = (timestamp: number) => {
    if (!this.running) return;
    if (document.visibilityState !== 'visible') {
      this.lastTimestamp = null;
      this.accumulator = 0;
      return;
    }
    const time = timestamp / 1000;
    if (this.lastTimestamp === null) this.lastTimestamp = time;
    const delta = Math.max(0, Math.min(0.1, time - this.lastTimestamp));
    this.lastTimestamp = time;
    this.accumulator = Math.min(this.accumulator + delta, this.fixedStep * 6);
    let steps = 0;
    while (this.accumulator >= this.fixedStep && steps < 6) {
      this.fixedUpdate(this.fixedStep);
      this.accumulator -= this.fixedStep;
      this.elapsedSeconds += this.fixedStep;
      steps += 1;
    }
    this.renderFrame(this.accumulator / this.fixedStep, this.elapsedSeconds);
  };
}
