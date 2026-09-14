import type { Entity, FloorConfig, Point } from '../types/geometry';
import { entityBounds, pointInPolygon } from './entities';
import { pointInFootprint } from './footprint';

export type FloorMatrix = {
  cellSize: number;
  rows: number;
  cols: number;
  /** Row 0 = top of the floor (high world Y), matching the on-screen view. */
  matrix: number[][];
};

export function generateFloorMatrix(
  entities: Entity[],
  floor: FloorConfig,
): FloorMatrix {
  const a = floor.a;
  if (a <= 0 || floor.width <= 0 || floor.height <= 0) {
    return { cellSize: a, rows: 0, cols: 0, matrix: [] };
  }

  const cols = Math.max(1, Math.ceil(floor.width / a));
  const rows = Math.max(1, Math.ceil(floor.height / a));
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0) as number[]);

  for (const ent of entities) {
    if (ent.kind === 'text' || ent.code === 0) continue;
    if (ent.kind === 'polygon' && ent.footprint && ent.footprint.length > 0) {
      stampFootprint(matrix, ent, a, cols, rows);
    } else if (ent.kind === 'polygon' && ent.points && ent.points.length >= 3) {
      stampPolygon(matrix, ent.points, ent.code, a, cols, rows);
    } else {
      stampRect(matrix, ent, a, cols, rows);
    }
  }

  return { cellSize: a, rows, cols, matrix };
}

function toMatrixRow(worldRow: number, rows: number): number {
  return rows - 1 - worldRow;
}

function stampRect(
  matrix: number[][],
  ent: Entity,
  a: number,
  cols: number,
  rows: number,
): void {
  const startC = Math.floor(ent.x / a);
  const startR = Math.floor(ent.y / a);
  const endC = Math.ceil((ent.x + ent.width) / a);
  const endR = Math.ceil((ent.y + ent.height) / a);

  for (let wr = startR; wr < endR; wr++) {
    if (wr < 0 || wr >= rows) continue;
    const mr = toMatrixRow(wr, rows);
    for (let c = startC; c < endC; c++) {
      if (c < 0 || c >= cols) continue;
      matrix[mr][c] = ent.code;
    }
  }
}

function stampFootprint(
  matrix: number[][],
  ent: Entity,
  a: number,
  cols: number,
  rows: number,
): void {
  if (!ent.footprint) return;
  for (let wr = 0; wr < rows; wr++) {
    const mr = toMatrixRow(wr, rows);
    for (let c = 0; c < cols; c++) {
      const cx = (c + 0.5) * a;
      const cy = (wr + 0.5) * a;
      if (pointInFootprint({ x: cx, y: cy }, ent.x, ent.y, ent.footprint)) {
        matrix[mr][c] = ent.code;
      }
    }
  }
}

function stampPolygon(
  matrix: number[][],
  points: Point[],
  code: number,
  a: number,
  cols: number,
  rows: number,
): void {
  for (let wr = 0; wr < rows; wr++) {
    const mr = toMatrixRow(wr, rows);
    for (let c = 0; c < cols; c++) {
      const cx = (c + 0.5) * a;
      const cy = (wr + 0.5) * a;
      if (pointInPolygon({ x: cx, y: cy }, points)) {
        matrix[mr][c] = code;
      }
    }
  }
}

export function matrixToPlainText(m: FloorMatrix): string {
  return m.matrix.map((row) => row.join(' ')).join('\n');
}

export function matrixToJson(m: FloorMatrix): string {
  return JSON.stringify(
    {
      cellSize: m.cellSize,
      rows: m.rows,
      cols: m.cols,
      matrix: m.matrix,
    },
    null,
    2,
  );
}

export function entityWorldExtent(entities: Entity[]) {
  if (entities.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const e of entities) {
    const b = entityBounds(e);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return { minX, minY, maxX, maxY };
}
