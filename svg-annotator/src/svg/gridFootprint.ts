import type { Asset, Bounds, Mode } from '../types/geometry.js';
import { validateGeometry } from '../geometry/validator.js';
import { resolveGeometry, coverFullGrid } from '../geometry/resolveGeometry.js';
import { fillPolygon, traceOccupied } from '../raster/trace.js';
import { extractSvgPolygons } from './polygons.js';

/** Build a grid footprint from SVG vector fills (works in Node and the browser). */
export function svgGridAsset(source: string, svg: string, mode: Mode = 'auto', gridSize = 64): Asset {
  const id = source.replace(/\\/g, '/').replace(/\.svg$/i, '').replace(/[^\w/-]+/g, '-');
  const label = source.split('/').pop()?.replace(/\.svg$/i, '') ?? id;
  try {
    const canvas = extractSvgPolygons(svg);
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
      return { id, source, label, metadata: { automatic: true, status: 'REVIEW_REQUIRED', reason: 'No visible positive-area geometry' } };
    }
    const longSide = Math.max(canvas.width, canvas.height);
    const cell = longSide / gridSize;
    const columns = Math.max(1, Math.ceil(canvas.width / cell));
    const rows = Math.max(1, Math.ceil(canvas.height / cell));
    const occupied = Array.from({ length: rows }, () => Array(columns).fill(false));
    for (const polygon of canvas.polygons) fillPolygon(occupied, polygon, canvas.originX, canvas.originY, cell);
    let trace = traceOccupied(occupied, mode !== 'orthogonal');
    if (!trace) {
      // Paths sometimes live outside the declared viewBox; fall back to the canvas rectangle.
      trace = {
        simplified: [[0, 0], [columns, 0], [columns, rows], [0, rows]],
        minX: 0, minY: 0, maxX: columns, maxY: rows,
        occupiedCount: columns * rows,
      };
    }
    const resolved = resolveGeometry(mode, trace);
    const geometry = mode === 'orthogonal' ? resolved.geometry : coverFullGrid(resolved.geometry, columns, rows);
    const status = resolved.status;
    const bounds: Bounds = {
      minX: canvas.originX + trace.minX * cell,
      minY: canvas.originY + trace.minY * cell,
      maxX: canvas.originX + trace.maxX * cell,
      maxY: canvas.originY + trace.maxY * cell,
      width: (trace.maxX - trace.minX) * cell,
      height: (trace.maxY - trace.minY) * cell,
    };
    const reason = validateGeometry(geometry, gridSize);
    return {
      id, source, label,
      geometry: reason ? undefined : geometry,
      metadata: {
        automatic: true,
        status: reason ? 'REVIEW_REQUIRED' : status,
        reason,
        bounds,
        unitGrid: { cellsPerLongSide: gridSize, cellSizePx: cell, columns, rows },
      },
    };
  } catch (error) {
    return { id, source, label, metadata: { automatic: true, status: 'FAILED', reason: error instanceof Error ? error.message : String(error) } };
  }
}
