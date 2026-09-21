import type { Point } from '../types/geometry.js';

type Matrix = [number, number, number, number, number, number];
type Vec = [number, number];
const identity: Matrix = [1, 0, 0, 1, 0, 0];
const multiply = (a: Matrix, b: Matrix): Matrix => [
  a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
];
const apply = (m: Matrix, [x, y]: Vec): Vec => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const n = (v: string | undefined, d = 0) => Number.parseFloat(v ?? '') || d;
const attr = (s: string, k: string) => new RegExp(`\\b${k}\\s*=\\s*["']([^"']*)["']`, 'i').exec(s)?.[1];
const values = (text: string) => text.match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi)?.map(Number) ?? [];

function transform(s: string | undefined): Matrix {
  let m = identity;
  for (const x of (s ?? '').matchAll(/(translate|scale|rotate|matrix)\s*\(([^)]*)\)/gi)) {
    const v = x[2].match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) ?? [];
    let q: Matrix = identity;
    const kind = x[1].toLowerCase();
    if (kind === 'translate') q = [1, 0, 0, 1, v[0] ?? 0, v[1] ?? 0];
    if (kind === 'scale') q = [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0];
    if (kind === 'matrix' && v.length === 6) q = v as Matrix;
    if (kind === 'rotate') {
      const r = (v[0] ?? 0) * Math.PI / 180, c = Math.cos(r), z = Math.sin(r), cx = v[1] ?? 0, cy = v[2] ?? 0;
      q = multiply(multiply([1, 0, 0, 1, cx, cy], [c, z, -z, c, 0, 0]), [1, 0, 0, 1, -cx, -cy]);
    }
    m = multiply(m, q);
  }
  return m;
}

const cubic = (a: Vec, b: Vec, c: Vec, d: Vec, t: number): Vec => {
  const q = 1 - t;
  return [
    q ** 3 * a[0] + 3 * q ** 2 * t * b[0] + 3 * q * t ** 2 * c[0] + t ** 3 * d[0],
    q ** 3 * a[1] + 3 * q ** 2 * t * b[1] + 3 * q * t ** 2 * c[1] + t ** 3 * d[1],
  ];
};
const quadratic = (a: Vec, b: Vec, c: Vec, t: number): Vec => {
  const q = 1 - t;
  return [q * q * a[0] + 2 * q * t * b[0] + t * t * c[0], q * q * a[1] + 2 * q * t * b[1] + t * t * c[1]];
};

function pathPolygons(d: string): Point[][] {
  const tokens = [...d.matchAll(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi)].map(x => x[0]);
  let index = 0, command = '', current: Vec = [0, 0], start: Vec = [0, 0], lastControl: Vec | undefined;
  const polygons: Point[][] = [];
  let ring: Point[] = [];
  const remaining = () => index < tokens.length;
  const take = (): number | undefined => remaining() ? Number(tokens[index++]) : undefined;
  const point = (relative: boolean): Vec | undefined => {
    const x = take(), y = take();
    if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) return undefined;
    return relative ? [current[0] + x, current[1] + y] : [x, y];
  };
  const push = (p: Vec) => { if (ring.length < 4000) ring.push(p); current = p; };
  while (remaining()) {
    if (/^[a-z]$/i.test(tokens[index])) command = tokens[index++];
    if (!command) break;
    const lower = command.toLowerCase(), relative = command === lower;
    if (lower === 'z') {
      if (ring.length >= 3) polygons.push(ring);
      ring = [];
      current = start;
      lastControl = undefined;
      command = '';
      continue;
    }
    if (lower === 'm') {
      if (ring.length >= 3) polygons.push(ring);
      ring = [];
      const p = point(relative);
      if (!p) break;
      current = p; start = current; ring.push(current);
      command = relative ? 'l' : 'L';
      continue;
    }
    if (lower === 'l') {
      const p = point(relative);
      if (!p) break;
      push(p); lastControl = undefined; continue;
    }
    if (lower === 'h') {
      const x = take();
      if (x === undefined) break;
      push([relative ? current[0] + x : x, current[1]]); lastControl = undefined; continue;
    }
    if (lower === 'v') {
      const y = take();
      if (y === undefined) break;
      push([current[0], relative ? current[1] + y : y]); lastControl = undefined; continue;
    }
    if (lower === 'c') {
      const a = current, b = point(relative), c = point(relative), d2 = point(relative);
      if (!b || !c || !d2) break;
      for (let t = 0.2; t <= 1; t += 0.2) ring.push(cubic(a, b, c, d2, t));
      current = d2; lastControl = c; continue;
    }
    if (lower === 's') {
      const a = current, b: Vec = lastControl ? [2 * current[0] - lastControl[0], 2 * current[1] - lastControl[1]] : current;
      const c = point(relative), d2 = point(relative);
      if (!c || !d2) break;
      for (let t = 0.2; t <= 1; t += 0.2) ring.push(cubic(a, b, c, d2, t));
      current = d2; lastControl = c; continue;
    }
    if (lower === 'q') {
      const a = current, b = point(relative), c = point(relative);
      if (!b || !c) break;
      for (let t = 0.2; t <= 1; t += 0.2) ring.push(quadratic(a, b, c, t));
      current = c; lastControl = b; continue;
    }
    if (lower === 't') {
      const a = current, b: Vec = lastControl ? [2 * current[0] - lastControl[0], 2 * current[1] - lastControl[1]] : current;
      const c = point(relative);
      if (!c) break;
      for (let t = 0.2; t <= 1; t += 0.2) ring.push(quadratic(a, b, c, t));
      current = c; lastControl = b; continue;
    }
    if (lower === 'a') {
      for (let i = 0; i < 5; i++) if (take() === undefined) { command = ''; break; }
      if (!command) break;
      const end = point(relative);
      if (!end) break;
      push(end); lastControl = undefined; continue;
    }
    command = '';
  }
  if (ring.length >= 3) polygons.push(ring);
  return polygons;
}

function ellipsePolygon(cx: number, cy: number, rx: number, ry: number, steps = 32): Point[] {
  return Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as Point;
  });
}

export interface SvgCanvas {
  originX: number;
  originY: number;
  width: number;
  height: number;
  polygons: Point[][];
  hasCurves: boolean;
}

/** Extract filled polygons and canvas size from SVG markup (Node-safe, no DOM). */
export function extractSvgPolygons(svg: string): SvgCanvas | undefined {
  if (!/<svg\b/i.test(svg)) throw Error('Not an SVG');
  const root = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? '';
  const vb = attr(root, 'viewBox')?.trim().split(/[ ,]+/).map(Number);
  const originX = vb?.[0] ?? 0;
  const originY = vb?.[1] ?? 0;
  const width = (vb && vb[2] > 0 ? vb[2] : n(attr(root, 'width'), 100));
  const height = (vb && vb[3] > 0 ? vb[3] : n(attr(root, 'height'), 100));
  const polygons: Point[][] = [];
  // Prefer the largest filled shapes; skip tiny decorative strokes that explode path counts.
  const tag = /<(rect|polygon|polyline|circle|ellipse|path)\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  const candidates: { area: number; bboxArea: number; polygon: Point[]; curved: boolean }[] = [];
  while ((match = tag.exec(svg))) {
    const s = match[0];
    if (/display\s*=\s*["']none|visibility\s*=\s*["']hidden|fill\s*=\s*["']none/i.test(s)) continue;
    const name = match[1].toLowerCase();
    const t = transform(attr(s, 'transform'));
    const map = (pts: Point[]) => pts.map(p => apply(t, p));
    const add = (pts: Point[], curved = false) => {
      if (pts.length < 3) return;
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const bboxArea = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
      let area = 0;
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
        area += x1 * y2 - x2 * y1;
      }
      area = Math.abs(area) / 2;
      if (area > 0 || bboxArea > 0) candidates.push({ area: Math.max(area, bboxArea * 0.01), bboxArea, polygon: map(pts), curved });
    };
    if (name === 'rect') {
      const x = n(attr(s, 'x')), y = n(attr(s, 'y')), w = n(attr(s, 'width')), h = n(attr(s, 'height'));
      if (w > 0 && h > 0) add([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
    } else if (name === 'polygon' || name === 'polyline') {
      const q = attr(s, 'points')?.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) ?? [];
      const pts: Point[] = [];
      for (let i = 0; i + 1 < q.length; i += 2) pts.push([q[i], q[i + 1]]);
      add(pts);
    } else if (name === 'circle' || name === 'ellipse') {
      const cx = n(attr(s, 'cx')), cy = n(attr(s, 'cy'));
      const rx = n(attr(s, name === 'circle' ? 'r' : 'rx'));
      const ry = n(attr(s, name === 'circle' ? 'r' : 'ry'));
      if (rx > 0 && ry > 0) add(ellipsePolygon(cx, cy, rx, ry, 24), true);
    } else if (name === 'path') {
      const d = attr(s, 'd') ?? '';
      const curved = /[csqta]/i.test(d);
      for (const ring of pathPolygons(d)) add(ring, curved);
    }
  }
  if (!candidates.length) return undefined;
  candidates.sort((a, b) => b.area - a.area);
  const canvasArea = Math.max(1, width * height);
  // Prefer a filled footprint that is not a near-full background plate (use shoelace area).
  const primary = candidates.find(c => c.area / canvasArea <= 0.85) ?? candidates[0];
  const related = candidates.filter(c => {
    if (c === primary) return true;
    return c.area >= primary.area * 0.2 && c.area / canvasArea <= 0.85;
  });
  const pool = related.length ? related : [primary];
  for (const c of pool.slice(0, 8)) polygons.push(c.polygon);
  const hasCurves = Boolean(primary.curved);
  return { originX, originY, width, height, polygons, hasCurves };
}
