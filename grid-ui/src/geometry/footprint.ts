import type { CellRef, GridCell, Point, Rect } from '../types/geometry';
import { cellToWorldRect, FINEST_PER_A } from './grid';

/**
 * Build relative finest-grid (a/16) cells from a selection at any named grid level.
 * `a` is the named unit (level 0).
 */
export function cellsToRelativeFinest(
  cells: CellRef[],
  a: number,
): { origin: GridCell; widthCells: number; heightCells: number; cells: GridCell[] } | null {
  if (cells.length === 0) return null;

  const f = a / FINEST_PER_A;
  const finest: GridCell[] = [];
  const seen = new Set<string>();

  for (const c of cells) {
    const world = cellToWorldRect(c, a);
    const col0 = Math.round(world.x / f);
    const row0 = Math.round(world.y / f);
    const w = Math.max(1, Math.round(world.width / f));
    const h = Math.max(1, Math.round(world.height / f));
    for (let r = 0; r < h; r++) {
      for (let col = 0; col < w; col++) {
        const key = `${col0 + col},${row0 + r}`;
        if (seen.has(key)) continue;
        seen.add(key);
        finest.push({ col: col0 + col, row: row0 + r });
      }
    }
  }

  if (finest.length === 0) return null;

  let minCol = Infinity;
  let minRow = Infinity;
  let maxCol = -Infinity;
  let maxRow = -Infinity;
  for (const c of finest) {
    minCol = Math.min(minCol, c.col);
    minRow = Math.min(minRow, c.row);
    maxCol = Math.max(maxCol, c.col);
    maxRow = Math.max(maxRow, c.row);
  }

  const relative = finest.map((c) => ({
    col: c.col - minCol,
    row: c.row - minRow,
  }));

  return {
    origin: { col: minCol, row: minRow },
    widthCells: maxCol - minCol + 1,
    heightCells: maxRow - minRow + 1,
    cells: relative,
  };
}

/** Trace outer boundary; returns vertices in finest-cell local coords. */
export function outlineGridCells(cells: GridCell[]): Point[] {
  if (cells.length === 0) return [];

  const set = new Set(cells.map((c) => `${c.col},${c.row}`));
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
    if (!set.has(`${col},${row - 1}`)) addEdge(bl, br);
    if (!set.has(`${col + 1},${row}`)) addEdge(br, tr);
    if (!set.has(`${col},${row + 1}`)) addEdge(tr, tl);
    if (!set.has(`${col - 1},${row}`)) addEdge(tl, bl);
  }

  if (edgeCount.size === 0) return [];

  const adj = new Map<string, V[]>();
  const vk = (v: V) => `${v.x},${v.y}`;
  for (const { a, b } of edgeCount.values()) {
    if (!adj.has(vk(a))) adj.set(vk(a), []);
    if (!adj.has(vk(b))) adj.set(vk(b), []);
    adj.get(vk(a))!.push(b);
    adj.get(vk(b))!.push(a);
  }

  let start: V | null = null;
  for (const key of adj.keys()) {
    const [x, y] = key.split(',').map(Number);
    const v = { x, y };
    if (!start || v.y < start.y || (v.y === start.y && v.x < start.x)) start = v;
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

  return ring.map((v) => ({ x: v.x, y: v.y }));
}

export function cellsToSvgPath(cells: GridCell[]): string {
  const outline = outlineGridCells(cells);
  if (outline.length < 2) {
    if (cells.length === 1) {
      const { col, row } = cells[0];
      return `M${col},${row} L${col + 1},${row} L${col + 1},${row + 1} L${col},${row + 1} Z`;
    }
    return '';
  }
  const [first, ...rest] = outline;
  let d = `M${first.x},${first.y}`;
  for (const p of rest) d += ` L${p.x},${p.y}`;
  d += ' Z';
  return d;
}

export function cellsToWorldOutline(
  origin: GridCell,
  cells: GridCell[],
  a: number,
): Point[] {
  const f = a / FINEST_PER_A;
  return outlineGridCells(cells).map((p) => ({
    x: (origin.col + p.x) * f,
    y: (origin.row + p.y) * f,
  }));
}

export function absoluteCells(origin: GridCell, cells: GridCell[]): GridCell[] {
  return cells.map((c) => ({
    col: origin.col + c.col,
    row: origin.row + c.row,
  }));
}

export function pointInRelativeCells(
  point: Point,
  origin: GridCell,
  cells: GridCell[],
  a: number,
): boolean {
  const f = a / FINEST_PER_A;
  const col = Math.floor(point.x / f) - origin.col;
  const row = Math.floor(point.y / f) - origin.row;
  return cells.some((c) => c.col === col && c.row === row);
}

export function relativeCellsWorldRects(
  origin: GridCell,
  cells: GridCell[],
  a: number,
): Rect[] {
  const f = a / FINEST_PER_A;
  return cells.map((c) => ({
    x: (origin.col + c.col) * f,
    y: (origin.row + c.row) * f,
    width: f,
    height: f,
  }));
}

/** Legacy helper for tests: footprint from CellRefs using named `a`. */
export function cellsToFootprint(
  cells: CellRef[],
  a: number,
): { origin: Point; width: number; height: number; footprint: Rect[] } | null {
  if (cells.length === 0) return null;
  const worldRects = cells.map((c) => cellToWorldRect(c, a));
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
  return {
    origin: { x: minX, y: minY },
    width: maxX - minX,
    height: maxY - minY,
    footprint: worldRects.map((r) => ({
      x: r.x - minX,
      y: r.y - minY,
      width: r.width,
      height: r.height,
    })),
  };
}

export function footprintToOutline(
  originX: number,
  originY: number,
  footprint: Rect[],
): Point[] {
  if (footprint.length === 0) return [];
  const cellSize = footprint[0].width;
  const uniform = footprint.every(
    (f) => Math.abs(f.width - cellSize) < 1e-9 && Math.abs(f.height - cellSize) < 1e-9,
  );
  if (!uniform) {
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
  return outlineGridCells(colsRows).map((p) => ({
    x: originX + p.x * cellSize,
    y: originY + p.y * cellSize,
  }));
}

export function pointInFootprint(
  point: Point,
  originX: number,
  originY: number,
  footprint: Rect[],
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
