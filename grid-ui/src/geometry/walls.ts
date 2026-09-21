/**
 * Wall geometry.
 *
 * Walls are polylines whose vertices are grid-vertex indices, not cell indices:
 * vertex (i,j) sits exactly on the grid line intersection at world (i·a, j·a).
 * Thickness is carried in cells and rendered centred on the line.
 */

import type { GridCell, Wall } from '../types/floorplan';
import type { Point, Rect } from '../types/geometry';
import { vertexToWorld } from './cells';

export type WallSegment = {
  from: GridCell;
  to: GridCell;
};

export function wallSegments(wall: Wall): WallSegment[] {
  const out: WallSegment[] = [];
  for (let i = 0; i < wall.points.length - 1; i++) {
    out.push({ from: wall.points[i], to: wall.points[i + 1] });
  }
  return out;
}

export function wallWorldPoints(wall: Wall, a: number): Point[] {
  return wall.points.map((p) => vertexToWorld(p, a));
}

/** Total wall length in world units. */
export function wallLength(wall: Wall, a: number): number {
  let total = 0;
  for (const seg of wallSegments(wall)) {
    total += Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y) * a;
  }
  return total;
}

export function wallWorldBounds(wall: Wall, a: number): Rect | null {
  if (wall.points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of wall.points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const half = (wall.thickness * a) / 2;
  return {
    x: minX * a - half,
    y: minY * a - half,
    width: (maxX - minX) * a + half * 2,
    height: (maxY - minY) * a + half * 2,
  };
}

function distanceToSegment(p: Point, v: Point, w: Point): number {
  const lengthSq = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
  if (lengthSq === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

/** True when a world point lies within the wall's drawn band. */
export function hitTestWall(
  wall: Wall,
  world: Point,
  a: number,
  extraTolerance = 0,
): boolean {
  const half = (wall.thickness * a) / 2 + extraTolerance;
  for (const seg of wallSegments(wall)) {
    const v = vertexToWorld(seg.from, a);
    const w = vertexToWorld(seg.to, a);
    if (distanceToSegment(world, v, w) <= half) return true;
  }
  return false;
}

export function findWallAt(
  walls: Wall[],
  world: Point,
  a: number,
  extraTolerance = 0,
): Wall | null {
  for (let i = walls.length - 1; i >= 0; i--) {
    if (hitTestWall(walls[i], world, a, extraTolerance)) return walls[i];
  }
  return null;
}

export function translateWall(wall: Wall, dx: number, dy: number): Wall {
  if (dx === 0 && dy === 0) return wall;
  return {
    ...wall,
    points: wall.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
  };
}

export function cloneWall(wall: Wall, id: string): Wall {
  return { ...wall, id, points: wall.points.map((p) => ({ ...p })) };
}

/**
 * Constrain a polyline vertex to horizontal or vertical relative to the
 * previous one. V1 keeps walls axis-aligned so they always follow grid lines.
 */
export function constrainToAxis(from: GridCell, to: GridCell): GridCell {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  return dx >= dy ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
}

/** Drop repeated and collinear vertices so a drawn wall stays minimal. */
export function simplifyWallPoints(points: GridCell[]): GridCell[] {
  const deduped: GridCell[] = [];
  for (const p of points) {
    const last = deduped[deduped.length - 1];
    if (last && last.x === p.x && last.y === p.y) continue;
    deduped.push(p);
  }
  if (deduped.length < 3) return deduped;

  const out: GridCell[] = [deduped[0]];
  for (let i = 1; i < deduped.length - 1; i++) {
    const prev = out[out.length - 1];
    const curr = deduped[i];
    const next = deduped[i + 1];
    const cross =
      (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x);
    if (cross !== 0) out.push(curr);
  }
  out.push(deduped[deduped.length - 1]);
  return out;
}

/**
 * Cells the wall band covers, for occupancy-matrix export.
 *
 * Walls sit on grid lines, so a wall of thickness `t` claims the `t` cells
 * straddling the line it runs along.
 */
export function wallCells(wall: Wall): GridCell[] {
  const seen = new Set<string>();
  const out: GridCell[] = [];
  const push = (x: number, y: number) => {
    const k = `${x},${y}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ x, y });
  };

  const spread = Math.max(1, Math.round(wall.thickness));
  const before = Math.floor(spread / 2);

  for (const seg of wallSegments(wall)) {
    const horizontal = seg.from.y === seg.to.y;
    if (horizontal) {
      const x0 = Math.min(seg.from.x, seg.to.x);
      const x1 = Math.max(seg.from.x, seg.to.x);
      for (let x = x0; x < x1; x++) {
        for (let k = 0; k < spread; k++) push(x, seg.from.y - before + k);
      }
    } else if (seg.from.x === seg.to.x) {
      const y0 = Math.min(seg.from.y, seg.to.y);
      const y1 = Math.max(seg.from.y, seg.to.y);
      for (let y = y0; y < y1; y++) {
        for (let k = 0; k < spread; k++) push(seg.from.x - before + k, y);
      }
    } else {
      // Diagonal fallback: walk the longer axis and sample.
      const steps = Math.max(
        Math.abs(seg.to.x - seg.from.x),
        Math.abs(seg.to.y - seg.from.y),
      );
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        push(
          Math.floor(seg.from.x + (seg.to.x - seg.from.x) * t),
          Math.floor(seg.from.y + (seg.to.y - seg.from.y) * t),
        );
      }
    }
  }
  return out;
}
