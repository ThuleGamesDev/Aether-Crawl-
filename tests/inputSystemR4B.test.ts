import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputSystem } from '../engine/InputSystem';

class EventSurface {
  private readonly listeners = new Map<string, Set<(event: any) => void>>();
  addEventListener(type: string, listener: (event: any) => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, listener: (event: any) => void) { this.listeners.get(type)?.delete(listener); }
  emit(type: string, event: Record<string, any> = {}) { for (const listener of this.listeners.get(type) ?? []) listener(event); }
}

function setup(pointerLock = false) {
  const browserWindow = new EventSurface();
  const browserDocument = Object.assign(new EventSurface(), {
    pointerLockElement: null as HTMLCanvasElement | null,
    exitPointerLock() { this.pointerLockElement = null; },
  });
  const canvas = Object.assign(new EventSurface(), {
    clientWidth: 200,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }),
    setPointerCapture: () => undefined,
    ...(pointerLock ? { requestPointerLock: () => undefined } : {}),
  });
  vi.stubGlobal('window', browserWindow);
  vi.stubGlobal('document', browserDocument);
  const input = new InputSystem(canvas as unknown as HTMLCanvasElement, () => 0.0025);
  return { input, canvas, browserWindow, browserDocument };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('FPS-R4B mouse and overlay input handling', () => {
  it('supports drag-to-look and click attack when Pointer Lock is unavailable', () => {
    const { input, canvas, browserWindow } = setup(false);
    canvas.emit('mousedown', { button: 0, clientX: 10, clientY: 20 });
    browserWindow.emit('mousemove', { clientX: 20, clientY: 24, movementX: 0, movementY: 0 });
    const dragged = input.readFrame();
    expect(dragged.lookX).toBeCloseTo(0.025);
    expect(dragged.lookY).toBeCloseTo(0.01);
    browserWindow.emit('mouseup', { button: 0 });
    expect(input.readFrame().primaryPressed).toBe(false);

    canvas.emit('mousedown', { button: 0, clientX: 10, clientY: 20 });
    browserWindow.emit('mouseup', { button: 0 });
    expect(input.readFrame().primaryPressed).toBe(true);
    input.dispose();
  });

  it('clears held movement on overlay handoff and ignores key repeat after the clear', () => {
    const { input, browserWindow } = setup();
    browserWindow.emit('keydown', { code: 'KeyW', repeat: false, preventDefault: () => undefined });
    expect(input.readFrame().movement.forward).toBe(1);
    browserWindow.emit('keydown', { code: 'KeyI', repeat: false, preventDefault: () => undefined });
    expect(input.readFrame().inventoryPressed).toBe(true);
    input.clearActiveInputs();
    browserWindow.emit('keydown', { code: 'KeyI', repeat: true, preventDefault: () => undefined });
    browserWindow.emit('mouseup', { button: 0 });
    const afterClose = input.readFrame();
    expect(afterClose.inventoryPressed).toBe(false);
    expect(afterClose.movement.forward).toBe(0);
    expect(afterClose.primaryPressed).toBe(false);
    input.dispose();
  });

  it('cancels a touch movement pointer without retaining the last joystick direction', () => {
    const { input, canvas } = setup();
    canvas.emit('pointerdown', { pointerType: 'touch', pointerId: 7, clientX: 20, clientY: 50, preventDefault: () => undefined });
    canvas.emit('pointermove', { pointerId: 7, clientX: 55, clientY: 50, preventDefault: () => undefined });
    expect(input.readFrame().movement.strafe).toBeGreaterThan(0.9);
    canvas.emit('pointercancel', { pointerId: 7 });
    expect(input.readFrame().movement).toMatchObject({ forward: 0, strafe: 0 });
    input.dispose();
  });
});
