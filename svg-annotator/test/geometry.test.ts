import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAsset } from '../src/geometry/generate.js';
import { validateGeometry } from '../src/geometry/validator.js';
import { resolveGeometry } from '../src/geometry/resolveGeometry.js';
import { imageAsset } from '../src/raster/silhouette.js';
import { renderAnnotationSvg } from '../src/export/annotationSvg.js';
import type { Asset, Point } from '../src/types/geometry.js';

test('uses integral square-grid coordinates for a rectangular SVG', () => {
  const a = generateAsset('chair.svg', '<svg viewBox="0 0 200 100"><rect x="10" y="20" width="180" height="60"/></svg>');
  assert.equal(a.geometry?.type, 'rectangle');
  assert.equal(a.geometry && validateGeometry(a.geometry, a.metadata.unitGrid!.cellsPerLongSide), undefined);
  assert.equal(a.metadata.status, 'AUTO_BOUNDS');
});

test('handles paths and empty artwork', () => {
  const filled = generateAsset('x.svg', '<svg viewBox="0 0 50 80"><path d="M0 0 L50 0 L50 80 Z"/></svg>');
  assert.ok(filled.geometry);
  assert.ok(['AUTO_BOUNDS', 'AUTO_ORTHOGONAL'].includes(filled.metadata.status));
  assert.equal(generateAsset('x.svg', '<svg/>').metadata.status, 'REVIEW_REQUIRED');
});

test('auto uses a rectangle for solid blocks and an orthogonal polygon for L-shapes', () => {
  const data = new Uint8ClampedArray(10 * 10 * 4);
  for (let y = 2; y < 8; y++) for (let x = 3; x < 7; x++) {
    const i = (y * 10 + x) * 4; data[i] = 30; data[i + 1] = 90; data[i + 2] = 150; data[i + 3] = 255;
  }
  const input = { width: 10, height: 10, data } as ImageData;
  const a = imageAsset('chairs/blue-chair.png', input);
  assert.equal(a.label, 'blue-chair');
  assert.equal(a.geometry?.type, 'rectangle');
  assert.equal(a.geometry && validateGeometry(a.geometry, a.metadata.unitGrid!.cellsPerLongSide), undefined);
  assert.equal(imageAsset('chairs/blue-chair.png', input, 'orthogonal').geometry?.type, 'orthogonal-polygon');

  // L-shape occupancy on a larger canvas
  const w = 32, h = 32;
  const L = new Uint8ClampedArray(w * h * 4);
  for (let y = 4; y < 28; y++) for (let x = 4; x < 12; x++) { const i = (y * w + x) * 4; L[i + 3] = 255; L[i] = 40; }
  for (let y = 20; y < 28; y++) for (let x = 4; x < 28; x++) { const i = (y * w + x) * 4; L[i + 3] = 255; L[i] = 40; }
  const Lasset = imageAsset('corner/L.png', { width: w, height: h, data: L } as ImageData, 'auto', { gridSize: 32 });
  assert.equal(Lasset.geometry?.type, 'orthogonal-polygon');
  assert.ok(Lasset.geometry?.type === 'orthogonal-polygon' && Lasset.geometry.points.length > 4);
  assert.equal(Lasset.geometry && validateGeometry(Lasset.geometry, 32), undefined);
});

test('uses equal square units for non-square images', () => {
  const data = new Uint8ClampedArray(200 * 100 * 4);
  for (let y = 20; y < 80; y++) for (let x = 20; x < 180; x++) {
    const i = (y * 200 + x) * 4; data[i] = 50; data[i + 1] = 50; data[i + 2] = 50; data[i + 3] = 255;
  }
  const a = imageAsset('wide.png', { width: 200, height: 100, data } as ImageData, 'orthogonal', { gridSize: 64 });
  assert.deepEqual(a.metadata.unitGrid, { cellsPerLongSide: 64, cellSizePx: 3.125, columns: 64, rows: 32 });
  const points = a.geometry?.type === 'orthogonal-polygon' ? a.geometry.points : [];
  assert.ok(points.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y)));
});

test('auto uses full grid-bbox coverage except for clear L shapes', () => {
  const four = resolveGeometry('auto', { simplified: [[0, 0], [8, 0], [8, 4], [0, 4]], minX: 0, minY: 0, maxX: 8, maxY: 4, occupiedCount: 32 });
  assert.equal(four.geometry.type, 'rectangle');
  const solid = resolveGeometry('auto', { simplified: [[0, 0], [10, 0], [10, 1], [8, 1], [8, 10], [0, 10]], minX: 0, minY: 0, maxX: 10, maxY: 10, occupiedCount: 95 });
  assert.equal(solid.geometry.type, 'rectangle');
  const noisy = resolveGeometry('auto', { simplified: [[0, 0], [64, 0], [64, 4], [56, 4], [56, 8], [8, 8], [8, 4], [0, 4]], minX: 0, minY: 0, maxX: 64, maxY: 8, occupiedCount: 400 });
  assert.equal(noisy.geometry.type, 'rectangle');
  const L = resolveGeometry('auto', { simplified: [[0, 0], [3, 0], [3, 7], [10, 7], [10, 10], [0, 10]], minX: 0, minY: 0, maxX: 10, maxY: 10, occupiedCount: 51 });
  assert.equal(L.geometry.type, 'orthogonal-polygon');
});

test('L-shaped SVG gets an orthogonal polygon in auto mode', () => {
  const svg = `<svg viewBox="0 0 100 100"><path d="M10 10 H40 V60 H90 V90 H10 Z"/></svg>`;
  const a = generateAsset('countertop-corner.svg', svg, 'auto', 32);
  assert.equal(a.geometry?.type, 'orthogonal-polygon');
  assert.ok(a.geometry?.type === 'orthogonal-polygon' && a.geometry.points.length >= 6);
  assert.equal(a.geometry && validateGeometry(a.geometry, 32), undefined);
});

test('curved SVG uses a full-grid bounding rectangle', () => {
  const a = generateAsset('round-table.svg', '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>', 'auto', 32);
  assert.equal(a.geometry?.type, 'rectangle');
  assert.deepEqual(a.geometry, { type: 'rectangle', x: 0, y: 0, width: a.metadata.unitGrid!.columns, height: a.metadata.unitGrid!.rows });
});

test('non-L assets cover the full square grid', () => {
  const a = generateAsset('box.svg', '<svg viewBox="0 0 64 64"><rect x="8" y="8" width="20" height="16"/></svg>', 'auto', 32);
  assert.equal(a.geometry?.type, 'rectangle');
  assert.equal(a.geometry?.type === 'rectangle' && a.geometry.x, 0);
  assert.equal(a.geometry?.type === 'rectangle' && a.geometry.y, 0);
  assert.equal(a.geometry?.type === 'rectangle' && a.geometry.width, a.metadata.unitGrid!.columns);
  assert.equal(a.geometry?.type === 'rectangle' && a.geometry.height, a.metadata.unitGrid!.rows);
});

test('renders annotation SVG for rectangle and polygon', () => {
  const rect = generateAsset('box.svg', '<svg viewBox="0 0 64 64"><rect x="8" y="8" width="40" height="20"/></svg>', 'rectangle', 32);
  const svg = renderAnnotationSvg(rect);
  assert.match(svg, /<rect /);
  assert.match(svg, /data-label="box"/);
  const poly: Asset = {
    id: 'L', source: 'L.svg', label: 'L',
    geometry: { type: 'orthogonal-polygon', points: [[0, 0], [4, 0], [4, 6], [10, 6], [10, 10], [0, 10]] as Point[] },
    metadata: { automatic: true, status: 'AUTO_ORTHOGONAL', unitGrid: { cellsPerLongSide: 32, cellSizePx: 1, columns: 32, rows: 32 } },
  };
  assert.match(renderAnnotationSvg(poly), /<polygon points=/);
});
