import type { CellRef, FloorConfig, Point, Rect, SubdivisionMode } from '../types/geometry';
import { floorWorldHeight, floorWorldWidth } from '../types/geometry';
import type { Viewport } from '../types/viewport';
import { screenToWorld } from './coordinates';

/** Default 4x mode: one cell → 16 finer cells per step. */
export const DEFAULT_SUBDIVISION: SubdivisionMode = 4;

/** Max level for subdivision 4: a×16 → a×4 → a. */
export const MAX_LEVEL_4 = 2;

/** Max level for subdivision 2: a×16 → a×8 → a×4 → a×2 → a. */
export const MAX_LEVEL_2 = 4;

/** @deprecated use getMaxLevel(subdivision) */
export const MAX_LEVEL = MAX_LEVEL_4;

/** @deprecated use subdivision from floor document */
export const SUBDIVISION = 4;

const MIN_CELL_PX = 24;

export function getMaxLevel(subdivision: SubdivisionMode = DEFAULT_SUBDIVISION): number {
  return subdivision === 2 ? MAX_LEVEL_2 : MAX_LEVEL_4;
}

/**
 * Coarsest (Level 0) cell size derived from finest cell `a`.
 * Level 0 = a × subdivision^maxLevel, Level MAX = a.
 */
export function getBaseUnit(
  a: number,
  subdivision: SubdivisionMode = DEFAULT_SUBDIVISION,
  maxLevel: number = getMaxLevel(subdivision),
): number {
  return a * subdivision ** maxLevel;
}

export function getLevelCellSize(
  level: number,
  baseUnit: number,
  subdivision: SubdivisionMode = DEFAULT_SUBDIVISION,
): number {
  return baseUnit / subdivision ** level;
}

export function getFinestCellSize(floor: FloorConfig): number {
  return floor.a;
}

export function getFloorBaseUnit(
  floor: FloorConfig,
  subdivision: SubdivisionMode = DEFAULT_SUBDIVISION,
): number {
  return getBaseUnit(floor.a, subdivision);
}

export function getGridLevel(
  zoom: number,
  baseUnit: number,
  maxLevel: number = MAX_LEVEL_4,
  subdivision: SubdivisionMode = DEFAULT_SUBDIVISION,
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
  const start = Math.max(0, Math.floor(worldMin / cellSize) * cellSize);
  const end = Math.ceil(worldMax / cellSize) * cellSize;
  const positions: number[] = [];
  const maxLines = 400;
  const count = Math.floor((end - start) / cellSize) + 1;
  if (count > maxLines) {
    const step = Math.ceil(count / maxLines) * cellSize;
    for (let pos = start; pos <= end + step / 2; pos += step) {
      if (pos >= 0) positions.push(pos);
    }
    return positions;
  }
  for (let pos = start; pos <= end + cellSize / 2; pos += cellSize) {
    if (pos >= 0) positions.push(pos);
  }
  return positions;
}

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
  subdivision: SubdivisionMode = DEFAULT_SUBDIVISION,
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
  subdivision: SubdivisionMode = DEFAULT_SUBDIVISION,
): Rect {
  const cellSize = getLevelCellSize(cell.level, baseUnit, subdivision);
  return {
    x: cell.col * cellSize,
    y: cell.row * cellSize,
    width: cellSize,
    height: cellSize,
  };
}

/** Finest-grid cell from world point. */
export function worldToFinestCell(
  point: Point,
  a: number,
): { col: number; row: number } {
  return {
    col: Math.floor(point.x / a),
    row: Math.floor(point.y / a),
  };
}

export function finestCellToWorldRect(
  col: number,
  row: number,
  a: number,
): Rect {
  return { x: col * a, y: row * a, width: a, height: a };
}

export function cellKey(cell: CellRef): string {
  return `${cell.level}:${cell.col}:${cell.row}`;
}

export function isSameCell(a: CellRef | null, b: CellRef | null): boolean {
  if (!a || !b) return a === b;
  return a.level === b.level && a.col === b.col && a.row === b.row;
}

export function cellsInWorldRect(
  rect: Rect,
  level: number,
  baseUnit: number,
  subdivision: SubdivisionMode = DEFAULT_SUBDIVISION,
): CellRef[] {
  const cellSize = getLevelCellSize(level, baseUnit, subdivision);
  const minCol = Math.max(0, Math.floor(rect.x / cellSize));
  const maxCol = Math.floor((rect.x + rect.width - 1e-9) / cellSize);
  const minRow = Math.max(0, Math.floor(rect.y / cellSize));
  const maxRow = Math.floor((rect.y + rect.height - 1e-9) / cellSize);
  const cells: CellRef[] = [];
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      cells.push({ level, col, row });
    }
  }
  return cells;
}

export function worldRectFromPoints(a: Point, b: Point): Rect {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Floor clip bounds in world units. */
export function floorWorldRect(floor: FloorConfig): Rect {
  return {
    x: 0,
    y: 0,
    width: floorWorldWidth(floor),
    height: floorWorldHeight(floor),
  };
}
