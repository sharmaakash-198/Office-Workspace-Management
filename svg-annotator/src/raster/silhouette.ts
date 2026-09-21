import type { Asset, Bounds, Mode } from '../types/geometry.js';
import { validateGeometry } from '../geometry/validator.js';
import { resolveGeometry, coverFullGrid } from '../geometry/resolveGeometry.js';
import { traceOccupied } from './trace.js';

/** Creates a deterministic, grid-simplified orthogonal contour from image pixels. */
export function imageAsset(source: string, pixels: ImageData, mode: Mode = 'auto', options: { threshold?: number; gridSize?: number } = {}): Asset {
  const id = source.replace(/\\/g, '/').replace(/\.[^/.]+$/, '').replace(/[^\w/-]+/g, '-');
  const label = source.split('/').pop()?.replace(/\.[^/.]+$/, '') ?? id;
  const { width, height, data } = pixels;
  const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]].map(([x, y]) => {
    const offset = (y * width + x) * 4;
    return [data[offset], data[offset + 1], data[offset + 2]];
  });
  const background = corners.reduce((sum, rgb) => sum.map((n, i) => n + rgb[i] / corners.length), [0, 0, 0]);
  const cellsPerLongSide = Math.max(8, options.gridSize ?? 64);
  const longSide = Math.max(width, height);
  const cellSizePx = longSide / cellsPerLongSide;
  const gridWidth = Math.max(1, Math.ceil(width / cellSizePx));
  const gridHeight = Math.max(1, Math.ceil(height / cellSizePx));
  const threshold = options.threshold ?? 30;
  const occupied = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(false));
  for (let gy = 0; gy < gridHeight; gy++) for (let gx = 0; gx < gridWidth; gx++) {
    const x0 = Math.floor(gx * cellSizePx);
    const x1 = Math.min(width, Math.max(x0 + 1, Math.ceil((gx + 1) * cellSizePx)));
    const y0 = Math.floor(gy * cellSizePx);
    const y1 = Math.min(height, Math.max(y0 + 1, Math.ceil((gy + 1) * cellSizePx)));
    let foreground = 0, total = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      const distance = Math.hypot(data[i] - background[0], data[i + 1] - background[1], data[i + 2] - background[2]);
      if (data[i + 3] > 20 && (data[i + 3] < 250 || distance > threshold)) foreground++;
      total++;
    }
    occupied[gy][gx] = foreground / total >= 0.12;
  }
  const trace = traceOccupied(occupied, mode !== 'orthogonal');
  if (!trace) return { id, source, label, metadata: { automatic: true, status: 'REVIEW_REQUIRED', reason: 'No foreground object detected' } };
  const bounds: Bounds = {
    minX: trace.minX * cellSizePx,
    minY: trace.minY * cellSizePx,
    maxX: Math.min(width, trace.maxX * cellSizePx),
    maxY: Math.min(height, trace.maxY * cellSizePx),
    width: Math.min(width, trace.maxX * cellSizePx) - trace.minX * cellSizePx,
    height: Math.min(height, trace.maxY * cellSizePx) - trace.minY * cellSizePx,
  };
  const resolved = resolveGeometry(mode, trace);
  const geometry = mode === 'orthogonal' ? resolved.geometry : coverFullGrid(resolved.geometry, gridWidth, gridHeight);
  const status = resolved.status;
  const reason = validateGeometry(geometry, cellsPerLongSide);
  return {
    id, source, label,
    geometry: reason ? undefined : geometry,
    metadata: {
      automatic: true,
      status: reason ? 'REVIEW_REQUIRED' : status,
      reason,
      bounds,
      unitGrid: { cellsPerLongSide, cellSizePx, columns: gridWidth, rows: gridHeight },
    },
  };
}
