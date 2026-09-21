import type { Point } from '../types/geometry.js';
import type { TraceResult } from '../geometry/resolveGeometry.js';

/**
 * Build a low-vertex orthogonal polygon by cutting empty rectangles from the
 * bounding box corners. Clean L → 6 verts, U → 8 verts, solid → 4 verts.
 */
export function minimalOrthogonalFromOccupied(_occupied: boolean[][], component: [number, number][]): TraceResult | undefined {
  if (!component.length) return undefined;
  const cells = new Set(component.map(([x, y]) => `${x},${y}`));
  const minX = Math.min(...component.map(p => p[0]));
  const maxX = Math.max(...component.map(p => p[0])) + 1;
  const minY = Math.min(...component.map(p => p[1]));
  const maxY = Math.max(...component.map(p => p[1])) + 1;
  const bbox = (maxX - minX) * (maxY - minY);
  const empty = (x: number, y: number) => x >= minX && y >= minY && x < maxX && y < maxY && !cells.has(`${x},${y}`);

  const cut = (x0: number, y0: number, xDir: 1 | -1, yDir: 1 | -1): { w: number; h: number } => {
    let bestW = 0, bestH = 0, bestArea = 0;
    const xLimit = xDir > 0 ? maxX - x0 : x0 - minX + 1;
    const yLimit = yDir > 0 ? maxY - y0 : y0 - minY + 1;
    for (let w = 1; w <= xLimit; w++) {
      let h = 0;
      outer: for (let hh = 1; hh <= yLimit; hh++) {
        for (let dx = 0; dx < w; dx++) {
          const x = xDir > 0 ? x0 + dx : x0 - dx;
          const y = yDir > 0 ? y0 + (hh - 1) : y0 - (hh - 1);
          if (!empty(x, y)) break outer;
        }
        h = hh;
      }
      if (h > 0 && w * h > bestArea) { bestArea = w * h; bestW = w; bestH = h; }
    }
    return { w: bestW, h: bestH };
  };

  const tl = cut(minX, minY, 1, 1);
  const tr = cut(maxX - 1, minY, -1, 1);
  const bl = cut(minX, maxY - 1, 1, -1);
  const br = cut(maxX - 1, maxY - 1, -1, -1);
  const minCut = Math.max(2, Math.floor(bbox * 0.05));
  const useTl = tl.w * tl.h >= minCut;
  const useTr = tr.w * tr.h >= minCut;
  const useBl = bl.w * bl.h >= minCut;
  const useBr = br.w * br.h >= minCut;

  const rect: TraceResult = {
    simplified: [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]],
    minX, minY, maxX, maxY, occupiedCount: component.length,
  };
  if (!useTl && !useTr && !useBl && !useBr) return rect;

  const points: Point[] = [];
  // Clockwise from top-left of the remaining shape.
  if (useTl) {
    points.push([minX + tl.w, minY], [minX + tl.w, minY + tl.h], [minX, minY + tl.h]);
  } else {
    points.push([minX, minY]);
  }
  if (useTr) {
    points.push([maxX - tr.w, minY], [maxX - tr.w, minY + tr.h], [maxX, minY + tr.h]);
  } else {
    points.push([maxX, minY]);
  }
  if (useBr) {
    points.push([maxX, maxY - br.h], [maxX - br.w, maxY - br.h], [maxX - br.w, maxY]);
  } else {
    points.push([maxX, maxY]);
  }
  if (useBl) {
    points.push([minX + bl.w, maxY], [minX + bl.w, maxY - bl.h], [minX, maxY - bl.h]);
  } else {
    points.push([minX, maxY]);
  }

  const simplified = points.filter((point, index, all) => {
    if (all.length <= 4) return true;
    const prev = all[(index - 1 + all.length) % all.length];
    const next = all[(index + 1) % all.length];
    return !((prev[0] === point[0] && point[0] === next[0]) || (prev[1] === point[1] && point[1] === next[1]));
  });

  for (let i = 0; i < simplified.length; i++) {
    const a = simplified[i], b = simplified[(i + 1) % simplified.length];
    if (a[0] !== b[0] && a[1] !== b[1]) return rect;
  }
  if (simplified.length < 4) return rect;
  return { simplified, minX, minY, maxX, maxY, occupiedCount: component.length };
}
