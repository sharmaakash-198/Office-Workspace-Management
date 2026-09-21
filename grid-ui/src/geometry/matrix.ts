/**
 * Dense occupancy-matrix export.
 *
 * This is an interop convenience for consumers that want a simple grid dump.
 * It is deliberately NOT the persistence format: the canonical contract is the
 * sparse vertex-polygon document produced by `lib/serialization`, because a
 * dense matrix scales with workspace area rather than with content.
 */

import type { Floor, GridCell, WorkspaceConfig } from '../types/floorplan';
import { absoluteCells } from './cells';
import { wallCells } from './walls';

export type FloorMatrix = {
  cellSize: number;
  rows: number;
  cols: number;
  /** Row 0 is the top of the floor (highest world Y), matching the screen. */
  matrix: number[][];
};

export const WALL_CODE = 99;

export function generateFloorMatrix(
  floor: Floor,
  workspace: WorkspaceConfig,
  a: number,
  options: { includeWalls?: boolean } = {},
): FloorMatrix {
  const cols = Math.max(0, Math.round(workspace.length / a));
  const rows = Math.max(0, Math.round(workspace.breadth / a));
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0) as number[]);

  const stamp = (cell: GridCell, code: number) => {
    if (cell.x < 0 || cell.x >= cols || cell.y < 0 || cell.y >= rows) return;
    matrix[rows - 1 - cell.y][cell.x] = code;
  };

  for (const entity of floor.entities) {
    if (entity.kind === 'text' || entity.code === 0) continue;
    for (const cell of absoluteCells(entity)) stamp(cell, entity.code);
  }

  if (options.includeWalls !== false) {
    for (const wall of floor.walls) {
      for (const cell of wallCells(wall)) stamp(cell, WALL_CODE);
    }
  }

  return { cellSize: a, rows, cols, matrix };
}

export function matrixToPlainText(m: FloorMatrix): string {
  return m.matrix.map((row) => row.join(' ')).join('\n');
}

export function matrixToJson(m: FloorMatrix): string {
  return JSON.stringify(
    { cellSize: m.cellSize, rows: m.rows, cols: m.cols, matrix: m.matrix },
    null,
    2,
  );
}
