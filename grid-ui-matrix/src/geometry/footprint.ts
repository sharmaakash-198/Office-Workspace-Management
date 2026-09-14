import type { CellRef, Point, Rect } from '../types/geometry';
import { cellToWorldRect } from './grid';

/** Axis-aligned rect relative to an entity origin (world meters). */
export type FootprintRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Build relative footprint rects for a cell selection so the marked polygon
 * keeps the exact selected shape (L, T, disconnected, etc.).
 */
export function cellsToFootprint(
  cells: CellRef[],
  baseUnit: number,
): { origin: Point; width: number; height: number; footprint: FootprintRect[] } | null {
  if (cells.length === 0) return null;

  const worldRects = cells.map((c) => cellToWorldRect(c, baseUnit));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of worldRects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }

  const footprint: FootprintRect[] = worldRects.map((r) => ({
    x: r.x - minX,
    y: r.y - minY,
    width: r.width,
    height: r.height,
  }));

  return {
    origin: { x: minX, y: minY },
    width: maxX - minX,
    height: maxY - minY,
    footprint,
  };
}

/** Absolute world rects for a footprint entity. */
export function footprintWorldRects(
  originX: number,
  originY: number,
  footprint: FootprintRect[],
): Rect[] {
  return footprint.map((f) => ({
    x: originX + f.x,
    y: originY + f.y,
    width: f.width,
    height: f.height,
  }));
}

/** Outer outline of footprint (for SVG polygon preview when connected). */
export function footprintToOutline(
  originX: number,
  originY: number,
  footprint: FootprintRect[],
): Point[] {
  // Prefer exact union outline from grid-aligned footprint cells when possible.
  if (footprint.length === 0) return [];

  const cellSize = footprint[0].width;
  const uniform = footprint.every(
    (f) => Math.abs(f.width - cellSize) < 1e-9 && Math.abs(f.height - cellSize) < 1e-9,
  );

  if (!uniform) {
    // Fallback: AABB
    let maxX = 0;
    let maxY = 0;
    for (const f of footprint) {
      maxX = Math.max(maxX, f.x + f.width);
      maxY = Math.max(maxY, f.y + f.height);
    }
    return [
      { x: originX, y: originY },
      { x: originX + maxX, y: originY },
      { x: originX + maxX, y: originY + maxY },
      { x: originX, y: originY + maxY },
    ];
  }

  const colsRows = footprint.map((f) => ({
    col: Math.round(f.x / cellSize),
    row: Math.round(f.y / cellSize),
  }));
  const outline = outlineGridCells(colsRows, cellSize);
  return outline.map((p) => ({ x: originX + p.x, y: originY + p.y }));
}

/**
 * Trace the outer boundary of a set of unit grid cells (polyomino).
 * Returns vertices in local coordinates (cellSize units).
 */
export function outlineGridCells(
  cells: Array<{ col: number; row: number }>,
  cellSize: number,
): Point[] {
  if (cells.length === 0) return [];

  const set = new Set(cells.map((c) => `${c.col},${c.row}`));
  // Undirected boundary edges between grid corners
  type V = { x: number; y: number };
  const edgeCount = new Map<string, { a: V; b: V }>();

  const undirectedKey = (a: V, b: V) => {
    if (a.x < b.x || (a.x === b.x && a.y < b.y)) return `${a.x},${a.y}|${b.x},${b.y}`;
    return `${b.x},${b.y}|${a.x},${a.y}`;
  };

  const addEdge = (a: V, b: V) => {
    const key = undirectedKey(a, b);
    if (edgeCount.has(key)) edgeCount.delete(key);
    else edgeCount.set(key, { a, b });
  };

  for (const { col, row } of cells) {
    const bl = { x: col, y: row };
    const br = { x: col + 1, y: row };
    const tr = { x: col + 1, y: row + 1 };
    const tl = { x: col, y: row + 1 };
    if (!set.has(`${col},${row - 1}`)) addEdge(bl, br); // bottom
    if (!set.has(`${col + 1},${row}`)) addEdge(br, tr); // right
    if (!set.has(`${col},${row + 1}`)) addEdge(tr, tl); // top
    if (!set.has(`${col - 1},${row}`)) addEdge(tl, bl); // left
  }

  if (edgeCount.size === 0) return [];

  // Adjacency for walking
  const adj = new Map<string, V[]>();
  const vk = (v: V) => `${v.x},${v.y}`;
  for (const { a, b } of edgeCount.values()) {
    if (!adj.has(vk(a))) adj.set(vk(a), []);
    if (!adj.has(vk(b))) adj.set(vk(b), []);
    adj.get(vk(a))!.push(b);
    adj.get(vk(b))!.push(a);
  }

  // Start at bottom-left-most vertex
  let start: V | null = null;
  for (const key of adj.keys()) {
    const [x, y] = key.split(',').map(Number);
    const v = { x, y };
    if (
      !start ||
      v.y < start.y ||
      (v.y === start.y && v.x < start.x)
    ) {
      start = v;
    }
  }
  if (!start) return [];

  const used = new Set<string>();
  const ring: V[] = [start];
  let prev: V | null = null;
  let curr = start;

  for (let guard = 0; guard < edgeCount.size + 2; guard++) {
    const neighbors = adj.get(vk(curr)) ?? [];
    let next: V | null = null;
    for (const n of neighbors) {
      const ek = undirectedKey(curr, n);
      if (used.has(ek)) continue;
      if (prev && n.x === prev.x && n.y === prev.y && neighbors.length > 1) continue;
      next = n;
      break;
    }
    // If skipped prev and nothing else, allow prev as last resort only when alone
    if (!next) {
      for (const n of neighbors) {
        const ek = undirectedKey(curr, n);
        if (!used.has(ek)) {
          next = n;
          break;
        }
      }
    }
    if (!next) break;
    used.add(undirectedKey(curr, next));
    if (next.x === start.x && next.y === start.y) break;
    ring.push(next);
    prev = curr;
    curr = next;
  }

  return ring.map((v) => ({ x: v.x * cellSize, y: v.y * cellSize }));
}

/** Point inside any footprint rect (world space). */
export function pointInFootprint(
  point: Point,
  originX: number,
  originY: number,
  footprint: FootprintRect[],
): boolean {
  for (const f of footprint) {
    const x = originX + f.x;
    const y = originY + f.y;
    if (
      point.x >= x &&
      point.x <= x + f.width &&
      point.y >= y &&
      point.y <= y + f.height
    ) {
      return true;
    }
  }
  return false;
}
