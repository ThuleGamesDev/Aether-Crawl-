import type { PlayerTransform } from '../types';

interface TexturePixels { pixels: Uint8ClampedArray; size: number }
interface PlaneSurface { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; image: ImageData }
const textures = new WeakMap<HTMLImageElement, TexturePixels>();
const surfaces = new WeakMap<CanvasRenderingContext2D, PlaneSurface>();

function texturePixels(image: HTMLImageElement): TexturePixels {
  const cached = textures.get(image); if (cached) return cached;
  const size = 256, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, 0, 0, size, size);
  const texture = { pixels: context.getImageData(0, 0, size, size).data, size };
  textures.set(image, texture); return texture;
}

/** World-aligned horizontal floor/ceiling rays; never stretch a floor image over the screen. */
export function planeRow(width: number, height: number, row: number, transform: PlayerTransform, fov = 0.6) {
  const distance = height * 0.5 / Math.max(1, Math.abs(row - height * 0.5));
  const dx = Math.cos(transform.angle), dy = Math.sin(transform.angle);
  const px = -dy * fov, py = dx * fov;
  return { distance, x: transform.x + distance * (dx - px), y: transform.y + distance * (dy - py), stepX: distance * 2 * px / width, stepY: distance * 2 * py / width };
}

export function drawPerspectivePlanes(context: CanvasRenderingContext2D, width: number, height: number,
  ceiling: HTMLImageElement, floor: HTMLImageElement, transform: PlayerTransform): void {
  const scale = Math.min(0.5, 480 / width, 360 / height);
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(2, Math.round(height * scale));
  let surface = surfaces.get(context);
  if (!surface || surface.canvas.width !== w || surface.canvas.height !== h) {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    surface = { canvas, context: ctx, image: ctx.createImageData(w, h) }; surfaces.set(context, surface);
  }
  const ground = texturePixels(floor), roof = texturePixels(ceiling), pixels = surface.image.data;
  for (let row = 0; row < h; row++) {
    const ceilingRow = row < h / 2, texture = ceilingRow ? roof : ground;
    const ray = planeRow(w, h, row, transform);
    const light = (ceilingRow ? 0.38 : 0.9) / (1 + ray.distance * 0.28);
    let x = ray.x, y = ray.y;
    for (let column = 0; column < w; column++) {
      const tx = Math.floor((x - Math.floor(x)) * texture.size), ty = Math.floor((y - Math.floor(y)) * texture.size);
      const source = (ty * texture.size + tx) * 4, target = (row * w + column) * 4;
      pixels[target] = texture.pixels[source] * light;
      pixels[target + 1] = texture.pixels[source + 1] * light * 0.94;
      pixels[target + 2] = texture.pixels[source + 2] * light * 0.84;
      pixels[target + 3] = 255;
      x += ray.stepX; y += ray.stepY;
    }
  }
  surface.context.putImageData(surface.image, 0, 0);
  context.drawImage(surface.canvas, 0, 0, width, height);
}

export function drawDungeonAtmosphere(context: CanvasRenderingContext2D, width: number, height: number, time: number): void {
  context.save();
  const glow = context.createRadialGradient(width * 0.2, height * 0.44, 0, width * 0.2, height * 0.44, Math.max(width, height) * 0.8);
  glow.addColorStop(0, `rgba(198,106,30,${0.12 + Math.sin(time / 370) * 0.012})`); glow.addColorStop(1, 'rgba(65,81,72,0.025)');
  context.fillStyle = glow; context.fillRect(0, 0, width, height);
  const vignette = context.createRadialGradient(width * 0.5, height * 0.48, Math.min(width, height) * 0.2, width * 0.5, height * 0.48, Math.max(width, height) * 0.68);
  vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,6,6,0.7)');
  context.fillStyle = vignette; context.fillRect(0, 0, width, height); context.restore();
}
