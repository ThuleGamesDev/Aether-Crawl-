import type { MovementInput } from '../services/firstPerson';

export interface InputFrame {
  movement: MovementInput;
  lookX: number;
  lookY: number;
  sprint: boolean;
  primaryPressed: boolean;
  secondaryPressed: boolean;
  secondaryDown: boolean;
  secondaryReleased: boolean;
  skillPressed: boolean;
  skillSlot: number | null;
  dodgePressed: boolean;
  interactPressed: boolean;
  inventoryPressed: boolean;
  mapPressed: boolean;
  pausePressed: boolean;
}

type TouchRole = 'move' | 'look';

export class InputSystem {
  private readonly keys = new Set<string>();
  private readonly pressed = new Set<string>();
  private readonly touchRoles = new Map<number, TouchRole>();
  private movementTouch: { x: number; y: number; originX: number; originY: number } | null = null;
  private lookX = 0;
  private lookY = 0;
  private readonly canvas: HTMLCanvasElement;
  private readonly mouseSensitivity: () => number;

  constructor(canvas: HTMLCanvasElement, mouseSensitivity: () => number = () => 0.0025) {
    this.canvas = canvas;
    this.mouseSensitivity = mouseSensitivity;
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clearHeld);
  }

  private readonly onMouseDown = (event: MouseEvent) => {
    if (event.button === 0 && document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock?.();
      return;
    }
    if (event.button === 0) this.pressed.add('primary');
    if (event.button === 2) { this.keys.add('MouseSecondary'); this.pressed.add('secondary'); }
  };

  private readonly onMouseUp = (event: MouseEvent) => {
    if (event.button === 2 && this.keys.delete('MouseSecondary')) this.pressed.add('secondaryReleased');
  };

  private readonly onMouseMove = (event: MouseEvent) => {
    if (document.pointerLockElement !== this.canvas) return;
    this.lookX += event.movementX;
    this.lookY += event.movementY;
  };

  private readonly onContextMenu = (event: Event) => event.preventDefault();

  private readonly onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    event.preventDefault();
    this.canvas.setPointerCapture?.(event.pointerId);
    const bounds = this.canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
    const role: TouchRole = x < bounds.width * 0.44 ? 'move' : 'look';
    this.touchRoles.set(event.pointerId, role);
    if (role === 'move') this.movementTouch = { x, y, originX: x, originY: y };
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    const role = this.touchRoles.get(event.pointerId);
    if (!role) return;
    event.preventDefault();
    const bounds = this.canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
    if (role === 'move' && this.movementTouch) {
      this.movementTouch.x = x;
      this.movementTouch.y = y;
    } else if (role === 'look') {
      this.lookX += event.movementX || x - (this.lastTouchLookX ?? x);
      this.lookY += event.movementY || y - (this.lastTouchLookY ?? y);
      this.lastTouchLookX = x;
      this.lastTouchLookY = y;
    }
  };

  private lastTouchLookX: number | undefined;
  private lastTouchLookY: number | undefined;

  private readonly onPointerUp = (event: PointerEvent) => {
    if (this.touchRoles.get(event.pointerId) === 'move') this.movementTouch = null;
    this.touchRoles.delete(event.pointerId);
    this.lastTouchLookX = undefined;
    this.lastTouchLookY = undefined;
  };

  private readonly onKeyDown = (event: KeyboardEvent) => {
    const key = event.code;
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) event.preventDefault();
    if (!this.keys.has(key)) {
      this.keys.add(key);
      const action: Record<string, string> = {
        KeyE: 'interact', KeyI: 'inventory', Tab: 'map', Escape: 'pause', Space: 'dodge',
        Digit1: 'skill1', Digit2: 'skill2', Digit3: 'skill3', Digit4: 'skill4',
      };
      if (action[key]) this.pressed.add(action[key]);
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent) => { this.keys.delete(event.code); };

  private readonly clearHeld = () => {
    this.keys.clear();
    this.pressed.clear();
    this.movementTouch = null;
    this.touchRoles.clear();
    this.lookX = 0;
    this.lookY = 0;
    this.lastTouchLookX = undefined;
    this.lastTouchLookY = undefined;
  };

  readFrame(): InputFrame {
    let forward = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'));
    let strafe = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
    if (this.movementTouch) {
      const dx = this.movementTouch.x - this.movementTouch.originX;
      const dy = this.movementTouch.y - this.movementTouch.originY;
      const scale = Math.max(35, Math.min(90, this.canvas.clientWidth * 0.14));
      strafe = Math.max(-1, Math.min(1, dx / scale));
      forward = Math.max(-1, Math.min(1, -dy / scale));
    }
    const magnitude = Math.hypot(forward, strafe);
    if (magnitude > 1) { forward /= magnitude; strafe /= magnitude; }
    const frame: InputFrame = {
      movement: {
        forward,
        strafe,
        turn: Number(this.keys.has('ArrowRight')) - Number(this.keys.has('ArrowLeft')),
      },
      lookX: this.lookX * this.mouseSensitivity(),
      lookY: this.lookY * this.mouseSensitivity(),
      sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      primaryPressed: this.pressed.has('primary'),
      secondaryPressed: this.pressed.has('secondary'),
      secondaryDown: this.keys.has('MouseSecondary'),
      secondaryReleased: this.pressed.has('secondaryReleased'),
      skillPressed: [1, 2, 3, 4].some(slot => this.pressed.has('skill' + slot)),
      skillSlot: [1, 2, 3, 4].find(slot => this.pressed.has('skill' + slot)) ?? null,
      dodgePressed: this.pressed.has('dodge'),
      interactPressed: this.pressed.has('interact'),
      inventoryPressed: this.pressed.has('inventory'),
      mapPressed: this.pressed.has('map'),
      pausePressed: this.pressed.has('pause'),
    };
    this.pressed.clear();
    this.lookX = 0;
    this.lookY = 0;
    return frame;
  }

  triggerPrimary(): void { this.pressed.add('primary'); }
  triggerSkill(slot = 1): void { if (slot >= 1 && slot <= 4) this.pressed.add('skill' + slot); }
  triggerDodge(): void { this.pressed.add('dodge'); }
  triggerInteract(): void { this.pressed.add('interact'); }
  triggerInventory(): void { this.pressed.add('inventory'); }
  triggerMap(): void { this.pressed.add('map'); }
  triggerPause(): void { this.pressed.add('pause'); }

  beginSecondary(): void { this.keys.add('MouseSecondary'); this.pressed.add('secondary'); }
  endSecondary(): void { if (this.keys.delete('MouseSecondary')) this.pressed.add('secondaryReleased'); }

  lockPointer(): void { this.canvas.requestPointerLock?.(); }

  dispose(): void {
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clearHeld);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
    this.clearHeld();
  }
}
