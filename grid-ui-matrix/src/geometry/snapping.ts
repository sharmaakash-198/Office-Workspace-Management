/**
 * Snap a value to the nearest multiple of gridSize.
 * Example: snapToGrid(23, 5) → 25
 */
export function snapToGrid(value: number, gridSize: number): number {
  if (gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

/** Snap a Point to the nearest grid intersection. */
export function snapPointToGrid(
  x: number,
  y: number,
  gridSize: number,
): { x: number; y: number } {
  return {
    x: snapToGrid(x, gridSize),
    y: snapToGrid(y, gridSize),
  };
}

/** Snap width/height down to at least one grid cell. */
export function snapSize(value: number, gridSize: number): number {
  if (gridSize <= 0) return value;
  return Math.max(gridSize, Math.round(value / gridSize) * gridSize);
}
