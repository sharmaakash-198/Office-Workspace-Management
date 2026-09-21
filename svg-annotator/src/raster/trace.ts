import type { Point } from '../types/geometry.js';
import type { TraceResult } from '../geometry/resolveGeometry.js';
import { minimalOrthogonalFromOccupied } from './minimalOrthogonal.js';

/** Keep the largest 4-connected foreground component. */
export function largestComponent(occupied: boolean[][]): [number, number][] {
  const rows = occupied.length, cols = occupied[0]?.length ?? 0;
  let best: [number, number][] = [];
  const seen = new Set<string>();
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (!occupied[y][x] || seen.has(`${x},${y}`)) continue;
    const component: [number, number][] = [];
    const queue: [number, number][] = [[x, y]];
    seen.add(`${x},${y}`);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const [cx, cy] = queue[cursor];
      component.push([cx, cy]);
      for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]] as [number, number][]) {
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || !occupied[ny][nx] || seen.has(`${nx},${ny}`)) continue;
        seen.add(`${nx},${ny}`);
        queue.push([nx, ny]);
      }
    }
    if (component.length > best.length) best = component;
  }
  return best;
}

/** Outer orthogonal boundary of occupied cells, with collinear vertices removed. */
export function traceOccupied(occupied: boolean[][], preferMinimal = true): TraceResult | undefined {
  const best = largestComponent(occupied);
  if (!best.length) return undefined;
  if (preferMinimal) {
    const minimal = minimalOrthogonalFromOccupied(occupied, best);
    if (minimal) return minimal;
  }
  const cells = new Set(best.map(([x, y]) => `${x},${y}`));
  const minX = Math.min(...best.map(p => p[0]));
  const maxX = Math.max(...best.map(p => p[0])) + 1;
  const minY = Math.min(...best.map(p => p[1]));
  const maxY = Math.max(...best.map(p => p[1])) + 1;
  const edges = new Map<string, [number, number]>();
  const add = (a: [number, number], b: [number, number]) => edges.set(a.join(','), b);
  for (const [x, y] of best) {
    if (!cells.has(`${x},${y - 1}`)) add([x, y], [x + 1, y]);
    if (!cells.has(`${x + 1},${y}`)) add([x + 1, y], [x + 1, y + 1]);
    if (!cells.has(`${x},${y + 1}`)) add([x + 1, y + 1], [x, y + 1]);
    if (!cells.has(`${x - 1},${y}`)) add([x, y + 1], [x, y]);
  }
  const start = [...edges.keys()].map(key => key.split(',').map(Number) as [number, number]).sort((a, b) => a[1] - b[1] || a[0] - b[0])[0];
  const path: Point[] = [];
  let current = start;
  do {
    path.push([current[0], current[1]]);
    const next = edges.get(current.join(','));
    if (!next) break;
    current = next;
  } while (current[0] !== start[0] || current[1] !== start[1]);
  const simplified = path.filter((point, index, all) => {
    const prev = all[(index - 1 + all.length) % all.length];
    const next = all[(index + 1) % all.length];
    return !((prev[0] === point[0] && point[0] === next[0]) || (prev[1] === point[1] && point[1] === next[1]));
  });
  return { simplified, minX, minY, maxX, maxY, occupiedCount: best.length };
}

/** Scanline-fill a closed polygon onto an occupancy grid. */
export function fillPolygon(occupied: boolean[][], polygon: Point[], originX: number, originY: number, cell: number): void {
  if (polygon.length < 3 || cell <= 0) return;
  const rows = occupied.length, cols = occupied[0]?.length ?? 0;
  const ys = polygon.map(p => p[1]);
  const minPy = Math.min(...ys), maxPy = Math.max(...ys);
  const y0 = Math.max(0, Math.floor((minPy - originY) / cell));
  const y1 = Math.min(rows - 1, Math.ceil((maxPy - originY) / cell));
  for (let gy = y0; gy <= y1; gy++) {
    const scanY = originY + (gy + 0.5) * cell;
    const crossings: number[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const [x1, y1a] = polygon[i];
      const [x2, y2] = polygon[(i + 1) % polygon.length];
      if ((y1a > scanY) === (y2 > scanY)) continue;
      if (y1a === y2) continue;
      const t = (scanY - y1a) / (y2 - y1a);
      crossings.push(x1 + t * (x2 - x1));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const left = Math.max(0, Math.floor((crossings[i] - originX) / cell));
      const right = Math.min(cols - 1, Math.floor((crossings[i + 1] - originX) / cell));
      for (let gx = left; gx <= right; gx++) occupied[gy][gx] = true;
    }
  }
}
