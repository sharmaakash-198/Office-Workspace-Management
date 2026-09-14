import type { CellRef, FloorConfig, Point, Rect } from '../types/geometry';
import type { Viewport } from '../types/viewport';
import { screenToWorld } from './coordinates';

/** Each grid level subdivides the previous level ×4 per axis (16 sub-cells). */
export const SUBDIVISION = 4;

/** Bounded to 3 levels: 0 (coarsest) .. MAX_LEVEL (finest = `a`). */
export const MAX_LEVEL = 2;

/** Minimum on-screen pixel size a cell must have before we reveal the next finer level. */
const MIN_CELL_PX = 24;

/**
 * Coarsest (Level 0) cell size derived from finest cell `a`.
 * Level 0 = a × 4^MAX_LEVEL, Level MAX = a.
 */
export function getBaseUnit(a: number, maxLevel: number = MAX_LEVEL): number {
  return a * SUBDIVISION ** maxLevel;
}

/** World-unit size of a cell at the given level. Level MAX = a. */
export function getLevelCellSize(
  level: number,
  baseUnit: number,
  subdivision: number = SUBDIVISION,
): number {
  return baseUnit / subdivision ** level;
}

/** Finest cell size from floor config. */
export function getFinestCellSize(floor: FloorConfig): number {
  return floor.a;
}

export function getFloorBaseUnit(floor: FloorConfig): number {
  return getBaseUnit(floor.a);
}

/**
 * Finest grid level visible at this zoom, bounded to [0, maxLevel].
 * Pass `baseUnit` (= a × 4^MAX_LEVEL).
 */
export function getGridLevel(
  zoom: number,
  baseUnit: number,
  maxLevel: number = MAX_LEVEL,
  subdivision: number = SUBDIVISION,
): number {
  let level = 0;
  while (level < maxLevel) {
    const nextCellPx = getLevelCellSize(level + 1, baseUnit, subdivision) * zoom;
    if (nextCellPx < MIN_CELL_PX) break;
    level++;
  }
  return level;
}

export function getVisibleLinePositions(
  worldMin: number,
  worldMax: number,
  cellSize: number,
): number[] {
  const start = Math.floor(worldMin / cellSize) * cellSize;
  const end = Math.ceil(worldMax / cellSize) * cellSize;
  const positions: number[] = [];
  // Cap line count for performance on huge zooms-out of infinite paper.
  const maxLines = 400;
  const count = Math.floor((end - start) / cellSize) + 1;
  if (count > maxLines) {
    const step = Math.ceil(count / maxLines) * cellSize;
    for (let pos = start; pos <= end + step / 2; pos += step) {
      positions.push(pos);
    }
    return positions;
  }
  for (let pos = start; pos <= end + cellSize / 2; pos += cellSize) {
    positions.push(pos);
  }
  return positions;
}

/** World-space bounding box currently visible inside the viewport. */
export function getVisibleWorldBounds(
  viewport: Viewport,
  svgWidth: number,
  svgHeight: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const topLeft = screenToWorld({ x: 0, y: 0 }, viewport);
  const bottomRight = screenToWorld({ x: svgWidth, y: svgHeight }, viewport);
  return {
    minX: topLeft.x,
    maxX: bottomRight.x,
    minY: bottomRight.y,
    maxY: topLeft.y,
  };
}

export function worldToCell(
  point: Point,
  level: number,
  baseUnit: number,
  subdivision: number = SUBDIVISION,
): CellRef {
  const cellSize = getLevelCellSize(level, baseUnit, subdivision);
  return {
    level,
    col: Math.floor(point.x / cellSize),
    row: Math.floor(point.y / cellSize),
  };
}

export function cellToWorldRect(
  cell: CellRef,
  baseUnit: number,
  subdivision: number = SUBDIVISION,
): Rect {
  const cellSize = getLevelCellSize(cell.level, baseUnit, subdivision);
  return {
    x: cell.col * cellSize,
    y: cell.row * cellSize,
    width: cellSize,
    height: cellSize,
  };
}

export function cellKey(cell: CellRef): string {
  return `${cell.level}:${cell.col}:${cell.row}`;
}

export function isSameCell(a: CellRef | null, b: CellRef | null): boolean {
  if (!a || !b) return a === b;
  return a.level === b.level && a.col === b.col && a.row === b.row;
}

/** Cells at `level` whose rectangles intersect the world-space AABB. */
export function cellsInWorldRect(
  rect: Rect,
  level: number,
  baseUnit: number,
): CellRef[] {
  const cellSize = getLevelCellSize(level, baseUnit);
  const minCol = Math.floor(rect.x / cellSize);
  const maxCol = Math.floor((rect.x + rect.width - 1e-9) / cellSize);
  const minRow = Math.floor(rect.y / cellSize);
  const maxRow = Math.floor((rect.y + rect.height - 1e-9) / cellSize);
  const cells: CellRef[] = [];
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      cells.push({ level, col, row });
    }
  }
  return cells;
}

/** Normalize a screen marquee into a world-space axis-aligned rect. */
export function worldRectFromPoints(a: Point, b: Point): Rect {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
