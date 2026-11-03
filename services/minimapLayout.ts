export interface MinimapLayout {
  tileSize: number;
  offsetX: number;
  offsetY: number;
}

/** Fits a grid of any dimensions inside the square minimap canvas and centers unused space. */
export function fitMinimapLayout(canvasWidth: number, canvasHeight: number, mapWidth: number, mapHeight: number): MinimapLayout {
  if (![canvasWidth, canvasHeight, mapWidth, mapHeight].every(Number.isFinite) || canvasWidth <= 0 || canvasHeight <= 0 || mapWidth <= 0 || mapHeight <= 0) {
    return { tileSize: 0, offsetX: 0, offsetY: 0 };
  }
  const tileSize = Math.min(canvasWidth / mapWidth, canvasHeight / mapHeight);
  return {
    tileSize,
    offsetX: (canvasWidth - mapWidth * tileSize) / 2,
    offsetY: (canvasHeight - mapHeight * tileSize) / 2,
  };
}

/** Converts a world-space position, measured in grid cells, to a minimap canvas point. */
export function worldToMinimapPoint(x: number, y: number, layout: MinimapLayout): { x: number; y: number } {
  return { x: layout.offsetX + x * layout.tileSize, y: layout.offsetY + y * layout.tileSize };
}
