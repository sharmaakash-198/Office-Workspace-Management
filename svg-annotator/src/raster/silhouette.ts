import type { Asset, Bounds, Geometry, Mode, Point } from '../types/geometry.js';
import { validateGeometry } from '../geometry/validator.js';

/** Creates a deterministic, grid-simplified orthogonal contour from image pixels. */
export function imageAsset(source: string, pixels: ImageData, mode: Mode = 'auto'): Asset {
  const id = source.replace(/\\/g, '/').replace(/\.[^/.]+$/, '').replace(/[^\w/-]+/g, '-');
  const label = source.split('/').pop()?.replace(/\.[^/.]+$/, '') ?? id;
  const { width, height, data } = pixels;
  const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]].map(([x, y]) => {
    const offset = (y * width + x) * 4; return [data[offset], data[offset + 1], data[offset + 2]];
  });
  const background = corners.reduce((sum, rgb) => sum.map((n, i) => n + rgb[i] / corners.length), [0, 0, 0]);
  const gridWidth = Math.min(96, width), gridHeight = Math.min(96, height);
  const occupied = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(false));
  for (let gy = 0; gy < gridHeight; gy++) for (let gx = 0; gx < gridWidth; gx++) {
    const x0 = Math.floor(gx * width / gridWidth), x1 = Math.max(x0 + 1, Math.floor((gx + 1) * width / gridWidth));
    const y0 = Math.floor(gy * height / gridHeight), y1 = Math.max(y0 + 1, Math.floor((gy + 1) * height / gridHeight));
    let foreground = 0, total = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * width + x) * 4; const distance = Math.hypot(data[i] - background[0], data[i + 1] - background[1], data[i + 2] - background[2]); if (data[i + 3] > 20 && (data[i + 3] < 250 || distance > 30)) foreground++; total++; }
    occupied[gy][gx] = foreground / total >= 0.12;
  }
  // Retain only the largest connected foreground component, avoiding stray marks/noise.
  let best: [number, number][] = [];
  const seen = new Set<string>();
  for (let y = 0; y < gridHeight; y++) for (let x = 0; x < gridWidth; x++) if (occupied[y][x] && !seen.has(`${x},${y}`)) {
    const component: [number, number][] = [], queue: [number, number][] = [[x, y]]; seen.add(`${x},${y}`);
    for (let cursor = 0; cursor < queue.length; cursor++) { const [cx, cy] = queue[cursor]; component.push([cx, cy]); for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) if (nx >= 0 && ny >= 0 && nx < gridWidth && ny < gridHeight && occupied[ny][nx] && !seen.has(`${nx},${ny}`)) { seen.add(`${nx},${ny}`); queue.push([nx, ny]); } }
    if (component.length > best.length) best = component;
  }
  if (!best.length) return { id, source, label, metadata: { automatic: true, status: 'REVIEW_REQUIRED', reason: 'No foreground object detected' } };
  const cells = new Set(best.map(([x, y]) => `${x},${y}`));
  const minX = Math.min(...best.map(p => p[0])), maxX = Math.max(...best.map(p => p[0])) + 1, minY = Math.min(...best.map(p => p[1])), maxY = Math.max(...best.map(p => p[1])) + 1;
  const bounds: Bounds = { minX: minX / gridWidth * width, minY: minY / gridHeight * height, maxX: maxX / gridWidth * width, maxY: maxY / gridHeight * height, width: (maxX - minX) / gridWidth * width, height: (maxY - minY) / gridHeight * height };
  const edges = new Map<string, [number, number]>(); const add = (a: [number, number], b: [number, number]) => edges.set(a.join(','), b);
  for (const [x, y] of best) { if (!cells.has(`${x},${y - 1}`)) add([x, y], [x + 1, y]); if (!cells.has(`${x + 1},${y}`)) add([x + 1, y], [x + 1, y + 1]); if (!cells.has(`${x},${y + 1}`)) add([x + 1, y + 1], [x, y + 1]); if (!cells.has(`${x - 1},${y}`)) add([x, y + 1], [x, y]); }
  const start = [...edges.keys()].map(key => key.split(',').map(Number) as [number, number]).sort((a, b) => a[1] - b[1] || a[0] - b[0])[0];
  const path: Point[] = []; let current = start;
  do { path.push([current[0] / gridWidth, current[1] / gridHeight]); const next = edges.get(current.join(',')); if (!next) break; current = next; } while (current[0] !== start[0] || current[1] !== start[1]);
  const simplified = path.filter((point, index, all) => { const prev = all[(index - 1 + all.length) % all.length], next = all[(index + 1) % all.length]; return !((prev[0] === point[0] && point[0] === next[0]) || (prev[1] === point[1] && point[1] === next[1])); });
  const geometry: Geometry = mode === 'rectangle' ? { type: 'rectangle', x: minX / gridWidth, y: minY / gridHeight, width: (maxX - minX) / gridWidth, height: (maxY - minY) / gridHeight } : { type: 'orthogonal-polygon', points: simplified };
  const reason = validateGeometry(geometry);
  return { id, source, label, geometry, metadata: { automatic: true, status: reason ? 'REVIEW_REQUIRED' : geometry.type === 'rectangle' ? 'AUTO_BOUNDS' : 'AUTO_ORTHOGONAL', reason, bounds } };
}
