/**
 * Conversion between occupied cells and grid-vertex polygons.
 *
 * Cells are the editing representation; rings are the wire format handed to the
 * renderer. Both use integer coordinates but they are NOT the same space:
 * cell (i,j) is the unit square spanning vertices (i,j) to (i+1,j+1). An
 * entity that is 3 cells wide therefore produces vertices with x in 0..3.
 *
 * The conversion is lossless in both directions, so rings can be the only
 * geometry in the serialized file without risking divergence from the cells.
 */

import type { GridCell } from '../types/floorplan';

export type RingRole = 'outer' | 'hole';

export type Ring = {
  role: RingRole;
  /** Closed ring in grid-vertex indices; first vertex is not repeated at the end. */
  vertices: GridCell[];
};

const key = (x: number, y: number) => `${x},${y}`;

/**
 * Signed area ×2 of a ring. Positive means counter-clockwise in a Y-up plane,
 * which we use to distinguish outer boundaries from holes.
 */
export function ringSignedArea2(vertices: GridCell[]): number {
  let sum = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum;
}

/** Drop vertices that sit in the middle of a straight run. */
function simplifyCollinear(vertices: GridCell[]): GridCell[] {
  if (vertices.length < 3) return vertices;
  const out: GridCell[] = [];
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const prev = vertices[(i - 1 + n) % n];
    const curr = vertices[i];
    const next = vertices[(i + 1) % n];
    const cross =
      (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x);
    if (cross !== 0) out.push(curr);
  }
  return out.length >= 3 ? out : vertices;
}

/**
 * Rotate a ring so it starts at its lexicographically smallest vertex. Without
 * this the same shape could serialize to different vertex orders depending on
 * which cell the trace happened to start from.
 */
function canonicalizeStart(vertices: GridCell[]): GridCell[] {
  if (vertices.length === 0) return vertices;
  let best = 0;
  for (let i = 1; i < vertices.length; i++) {
    const v = vertices[i];
    const b = vertices[best];
    if (v.y < b.y || (v.y === b.y && v.x < b.x)) best = i;
  }
  return [...vertices.slice(best), ...vertices.slice(0, best)];
}

/**
 * Trace the boundary of a set of occupied cells into grid-vertex rings.
 *
 * Emits one ring per connected boundary: outer boundaries wind counter-clockwise,
 * holes wind clockwise. Disconnected cell groups yield multiple outer rings.
 */
export function cellsToRings(cells: GridCell[]): Ring[] {
  if (cells.length === 0) return [];

  const occupied = new Set(cells.map((c) => key(c.x, c.y)));

  // Directed boundary edges with the interior on the left. Walking these
  // consistently is what gives outer rings CCW and holes CW winding.
  const outgoing = new Map<string, GridCell[]>();
  const addEdge = (from: GridCell, to: GridCell) => {
    const k = key(from.x, from.y);
    const list = outgoing.get(k);
    if (list) list.push(to);
    else outgoing.set(k, [to]);
  };

  for (const c of cells) {
    const { x, y } = c;
    if (!occupied.has(key(x, y - 1))) addEdge({ x, y }, { x: x + 1, y });
    if (!occupied.has(key(x + 1, y))) addEdge({ x: x + 1, y }, { x: x + 1, y: y + 1 });
    if (!occupied.has(key(x, y + 1))) addEdge({ x: x + 1, y: y + 1 }, { x, y: y + 1 });
    if (!occupied.has(key(x - 1, y))) addEdge({ x, y: y + 1 }, { x, y });
  }

  const rings: Ring[] = [];

  while (outgoing.size > 0) {
    const startKey = outgoing.keys().next().value as string;
    const [sx, sy] = startKey.split(',').map(Number);
    const start: GridCell = { x: sx, y: sy };

    const vertices: GridCell[] = [];
    let current = start;
    let incoming: GridCell | null = null;

    for (;;) {
      const k = key(current.x, current.y);
      const options = outgoing.get(k);
      if (!options || options.length === 0) break;

      let index = 0;
      if (options.length > 1 && incoming) {
        // A pinch point where two parts of the shape touch at one vertex.
        // Take the sharpest left turn so the ring hugs the interior instead of
        // cutting across into the other lobe.
        const inDir = { x: current.x - incoming.x, y: current.y - incoming.y };
        let bestScore = -Infinity;
        options.forEach((opt, i) => {
          const outDir = { x: opt.x - current.x, y: opt.y - current.y };
          const cross = inDir.x * outDir.y - inDir.y * outDir.x;
          const dot = inDir.x * outDir.x + inDir.y * outDir.y;
          // Rank: left turn > straight > right turn > reversal.
          const score = cross > 0 ? 3 : cross === 0 && dot > 0 ? 2 : cross < 0 ? 1 : 0;
          if (score > bestScore) {
            bestScore = score;
            index = i;
          }
        });
      }

      const next = options[index];
      options.splice(index, 1);
      if (options.length === 0) outgoing.delete(k);

      vertices.push(current);
      incoming = current;
      current = next;

      if (current.x === start.x && current.y === start.y) break;
    }

    if (vertices.length >= 4) {
      const simplified = canonicalizeStart(simplifyCollinear(vertices));
      rings.push({
        role: ringSignedArea2(simplified) > 0 ? 'outer' : 'hole',
        vertices: simplified,
      });
    }
  }

  // Deterministic order: outers before holes, then by position.
  rings.sort((a, b) => {
    if (a.role !== b.role) return a.role === 'outer' ? -1 : 1;
    const av = a.vertices[0];
    const bv = b.vertices[0];
    return av.y - bv.y || av.x - bv.x;
  });

  return rings;
}

/** True when the point is inside the ring, using the even-odd rule. */
function pointInRing(px: number, py: number, vertices: GridCell[]): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x;
    const yi = vertices[i].y;
    const xj = vertices[j].x;
    const yj = vertices[j].y;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Rebuild the occupied cell set from rings. Inverse of `cellsToRings`. */
export function ringsToCells(rings: Ring[]): GridCell[] {
  if (rings.length === 0) return [];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const v of ring.vertices) {
      minX = Math.min(minX, v.x);
      minY = Math.min(minY, v.y);
      maxX = Math.max(maxX, v.x);
      maxY = Math.max(maxY, v.y);
    }
  }

  const outers = rings.filter((r) => r.role === 'outer');
  const holes = rings.filter((r) => r.role === 'hole');

  const cells: GridCell[] = [];
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      // Sample the cell centre so the even-odd test never lands on an edge.
      const cx = x + 0.5;
      const cy = y + 0.5;
      const inOuter = outers.some((r) => pointInRing(cx, cy, r.vertices));
      if (!inOuter) continue;
      const inHole = holes.some((r) => pointInRing(cx, cy, r.vertices));
      if (inHole) continue;
      cells.push({ x, y });
    }
  }
  return cells;
}

/** Bounding box of a ring set, in grid-vertex indices. */
export function ringsBounds(rings: Ring[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null {
  if (rings.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const v of ring.vertices) {
      minX = Math.min(minX, v.x);
      minY = Math.min(minY, v.y);
      maxX = Math.max(maxX, v.x);
      maxY = Math.max(maxY, v.y);
    }
  }
  return { minX, minY, maxX, maxY };
}
