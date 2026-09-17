/**
 * Cell arithmetic for the canonical grid.
 *
 * No React, no SVG, no camera. Everything here operates on integer cells and
 * is safe to unit test headlessly.
 */

import type {
  CellSize,
  Entity,
  GridCell,
  Rotation,
} from '../types/floorplan';
import type { Point, Rect } from '../types/geometry';

export const cellKey = (c: GridCell): string => `${c.x},${c.y}`;

/** Sorted by row then column so equal cell sets always serialize identically. */
export function sortCells(cells: GridCell[]): GridCell[] {
  return [...cells].sort((a, b) => a.y - b.y || a.x - b.x);
}

export function dedupeCells(cells: GridCell[]): GridCell[] {
  const seen = new Set<string>();
  const out: GridCell[] = [];
  for (const c of cells) {
    const k = cellKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

/** The full w×h block of relative cells. */
export function rectCells(size: CellSize): GridCell[] {
  const out: GridCell[] = [];
  for (let y = 0; y < size.h; y++) {
    for (let x = 0; x < size.w; x++) out.push({ x, y });
  }
  return out;
}

/** True when the cells exactly fill their bounding box, so they can be stored as a plain rect. */
export function isSolidRect(cells: GridCell[], size: CellSize): boolean {
  return cells.length === size.w * size.h;
}

/** Occupied cells relative to the entity origin. Expands the implicit rectangle. */
export function relativeCells(entity: Entity): GridCell[] {
  return entity.cells ?? rectCells(entity.size);
}

/** Occupied cells in absolute canonical coordinates. */
export function absoluteCells(entity: Entity): GridCell[] {
  const { x, y } = entity.origin;
  return relativeCells(entity).map((c) => ({ x: c.x + x, y: c.y + y }));
}

/**
 * Shift a cell set so its minimum corner sits at (0,0), returning the offset
 * that was removed along with the tight bounding size.
 */
export function normalizeCells(cells: GridCell[]): {
  origin: GridCell;
  size: CellSize;
  cells: GridCell[];
} {
  if (cells.length === 0) {
    return { origin: { x: 0, y: 0 }, size: { w: 0, h: 0 }, cells: [] };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of cells) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x);
    maxY = Math.max(maxY, c.y);
  }
  const shifted = sortCells(
    dedupeCells(cells).map((c) => ({ x: c.x - minX, y: c.y - minY })),
  );
  return {
    origin: { x: minX, y: minY },
    size: { w: maxX - minX + 1, h: maxY - minY + 1 },
    cells: shifted,
  };
}

/** Build an entity-ready footprint from an absolute cell selection. */
export function footprintFromCells(cells: GridCell[]): {
  origin: GridCell;
  size: CellSize;
  cells?: GridCell[];
} | null {
  if (cells.length === 0) return null;
  const norm = normalizeCells(cells);
  return {
    origin: norm.origin,
    size: norm.size,
    // Drop the explicit list when the shape is a plain rectangle.
    cells: isSolidRect(norm.cells, norm.size) ? undefined : norm.cells,
  };
}

/**
 * Rotate relative cells clockwise inside their bounding box.
 *
 * A cell at (x,y) in a w×h box lands at (y, w-1-x) in an h×w box, so the result
 * is another exact cell set. Rotation is applied to the geometry rather than
 * carried as a transform, which keeps the stored footprint always true and
 * sidesteps the pivot ambiguity entirely.
 */
export function rotateCellsCW(cells: GridCell[], size: CellSize): {
  cells: GridCell[];
  size: CellSize;
} {
  const rotated = cells.map((c) => ({ x: c.y, y: size.w - 1 - c.x }));
  return { cells: sortCells(rotated), size: { w: size.h, h: size.w } };
}

export function rotateCellsBy(
  cells: GridCell[],
  size: CellSize,
  quarterTurns: number,
): { cells: GridCell[]; size: CellSize } {
  let result = { cells: sortCells(cells), size };
  const turns = ((quarterTurns % 4) + 4) % 4;
  for (let i = 0; i < turns; i++) {
    result = rotateCellsCW(result.cells, result.size);
  }
  return result;
}

export function addRotation(current: Rotation, quarterTurns: number): Rotation {
  const steps = ((current / 90 + quarterTurns) % 4 + 4) % 4;
  return (steps * 90) as Rotation;
}

/**
 * Rotate an entity in place. The bounding box is re-centred so the shape
 * pivots about its own middle rather than drifting toward its origin corner.
 */
export function rotateEntity(entity: Entity, quarterTurns: number): Entity {
  const turns = ((quarterTurns % 4) + 4) % 4;
  if (turns === 0) return entity;

  const rotated = rotateCellsBy(relativeCells(entity), entity.size, turns);
  const centerX = entity.origin.x + entity.size.w / 2;
  const centerY = entity.origin.y + entity.size.h / 2;
  const origin: GridCell = {
    x: Math.round(centerX - rotated.size.w / 2),
    y: Math.round(centerY - rotated.size.h / 2),
  };

  return {
    ...entity,
    origin,
    size: rotated.size,
    cells: isSolidRect(rotated.cells, rotated.size) ? undefined : rotated.cells,
    rotation: addRotation(entity.rotation, turns),
  };
}

export function translateEntity(entity: Entity, dx: number, dy: number): Entity {
  if (dx === 0 && dy === 0) return entity;
  return {
    ...entity,
    origin: { x: entity.origin.x + dx, y: entity.origin.y + dy },
  };
}

/**
 * Resize to a new integer cell box.
 *
 * Irregular footprints are re-sampled proportionally so an L stays an L rather
 * than silently becoming a rectangle; empty results fall back to a solid block.
 */
export function resizeEntity(
  entity: Entity,
  origin: GridCell,
  size: CellSize,
): Entity {
  const w = Math.max(1, Math.round(size.w));
  const h = Math.max(1, Math.round(size.h));
  const nextSize: CellSize = { w, h };

  if (!entity.cells) {
    return { ...entity, origin, size: nextSize, cells: undefined };
  }

  const sx = w / Math.max(1, entity.size.w);
  const sy = h / Math.max(1, entity.size.h);
  const scaled = dedupeCells(
    entity.cells.flatMap((c) => {
      const x0 = Math.floor(c.x * sx);
      const x1 = Math.max(x0 + 1, Math.ceil((c.x + 1) * sx));
      const y0 = Math.floor(c.y * sy);
      const y1 = Math.max(y0 + 1, Math.ceil((c.y + 1) * sy));
      const out: GridCell[] = [];
      for (let y = y0; y < Math.min(y1, h); y++) {
        for (let x = x0; x < Math.min(x1, w); x++) out.push({ x, y });
      }
      return out;
    }),
  );

  if (scaled.length === 0) {
    return { ...entity, origin, size: nextSize, cells: undefined };
  }

  return {
    ...entity,
    origin,
    size: nextSize,
    cells: isSolidRect(scaled, nextSize) ? undefined : sortCells(scaled),
  };
}

export function cloneEntity(entity: Entity, id: string): Entity {
  return {
    ...entity,
    id,
    origin: { ...entity.origin },
    size: { ...entity.size },
    cells: entity.cells?.map((c) => ({ ...c })),
  };
}

/* ---------------------------------------------------------------------- *
 * Cell <-> world conversion. `a` is the canonical cell size in world units.
 * ---------------------------------------------------------------------- */

/** Lower-left world corner of a cell. */
export function cellToWorld(cell: GridCell, a: number): Point {
  return { x: cell.x * a, y: cell.y * a };
}

/** World rectangle covered by a cell. */
export function cellToWorldRect(cell: GridCell, a: number): Rect {
  return { x: cell.x * a, y: cell.y * a, width: a, height: a };
}

/** The cell containing a world point. */
export function worldToCell(point: Point, a: number): GridCell {
  return { x: Math.floor(point.x / a), y: Math.floor(point.y / a) };
}

/** Nearest grid vertex to a world point, in vertex indices. */
export function worldToVertex(point: Point, a: number): GridCell {
  return { x: Math.round(point.x / a), y: Math.round(point.y / a) };
}

export function vertexToWorld(vertex: GridCell, a: number): Point {
  return { x: vertex.x * a, y: vertex.y * a };
}

/** World-space bounding box of an entity. */
export function entityWorldBounds(entity: Entity, a: number): Rect {
  return {
    x: entity.origin.x * a,
    y: entity.origin.y * a,
    width: entity.size.w * a,
    height: entity.size.h * a,
  };
}

/** One world rectangle per occupied cell, for rendering irregular footprints. */
export function entityWorldRects(entity: Entity, a: number): Rect[] {
  return absoluteCells(entity).map((c) => cellToWorldRect(c, a));
}

/** Every cell inside an inclusive rectangular cell range. */
export function cellRange(from: GridCell, to: GridCell): GridCell[] {
  const minX = Math.min(from.x, to.x);
  const maxX = Math.max(from.x, to.x);
  const minY = Math.min(from.y, to.y);
  const maxY = Math.max(from.y, to.y);
  const out: GridCell[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) out.push({ x, y });
  }
  return out;
}
