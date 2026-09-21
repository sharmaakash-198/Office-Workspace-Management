import type { Geometry, Mode, Point, Status } from '../types/geometry.js';

export interface TraceResult {
  /** Closed orthogonal contour in integer grid units, collinear vertices removed. */
  simplified: Point[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  occupiedCount: number;
}

/** Near-solid bbox → use the full occupied grid rectangle. */
export const FILL_RECT = 0.88;

/** True L (6) or U (8) footprints only — everything else uses full grid coverage. */
function isLOrUShape(simplified: Point[], fillRatio: number): boolean {
  if (fillRatio >= FILL_RECT || fillRatio < 0.4) return false;
  if (simplified.length === 6) return true;
  if (simplified.length === 8 && fillRatio <= 0.78) return true;
  return false;
}

/** Expand rectangles to the full square-grid canvas; leave L/U polygons unchanged. */
export function coverFullGrid(geometry: Geometry, columns: number, rows: number): Geometry {
  if (geometry.type !== 'rectangle') return geometry;
  return { type: 'rectangle', x: 0, y: 0, width: columns, height: rows };
}

export function resolveGeometry(mode: Mode, trace: TraceResult): { geometry: Geometry; status: Status } {
  const { simplified, minX, minY, maxX, maxY, occupiedCount } = trace;
  const width = maxX - minX;
  const height = maxY - minY;
  const rectangle: Geometry = { type: 'rectangle', x: minX, y: minY, width, height };
  const bboxCells = Math.max(1, width * height);
  const fillRatio = occupiedCount / bboxCells;
  const polygon: Geometry = { type: 'orthogonal-polygon', points: simplified };

  if (mode === 'rectangle') return { geometry: rectangle, status: 'AUTO_BOUNDS' };
  if (mode === 'orthogonal') return { geometry: polygon, status: 'AUTO_ORTHOGONAL' };

  // auto: full grid coverage via rectangle, except clear L/U footprints.
  if (isLOrUShape(simplified, fillRatio)) {
    return { geometry: polygon, status: 'AUTO_ORTHOGONAL' };
  }
  return { geometry: rectangle, status: 'AUTO_BOUNDS' };
}
