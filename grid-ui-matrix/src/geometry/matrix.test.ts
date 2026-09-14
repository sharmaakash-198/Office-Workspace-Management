import { describe, expect, it } from 'vitest';
import { generateFloorMatrix, matrixToJson } from './matrix';
import type { Entity, FloorConfig } from '../types/geometry';

const floor6: FloorConfig = { width: 6, height: 6, a: 1 };

describe('generateFloorMatrix', () => {
  it('covers the full floor with zeros when empty', () => {
    const m = generateFloorMatrix([], floor6);
    expect(m.rows).toBe(6);
    expect(m.cols).toBe(6);
    expect(m.matrix.flat().every((v) => v === 0)).toBe(true);
  });

  it('places a 4×4 workstation with zeros in the unused floor cells', () => {
    const entities: Entity[] = [
      {
        id: 'w1',
        kind: 'workstation',
        code: 1,
        x: 0,
        y: 0,
        width: 4,
        height: 4,
      },
    ];
    const m = generateFloorMatrix(entities, floor6);
    expect(m.rows).toBe(6);
    expect(m.cols).toBe(6);
    // Row 0 is top of floor (world y=5..6) → zeros
    expect(m.matrix[0]).toEqual([0, 0, 0, 0, 0, 0]);
    // Bottom-left (low world Y) should be 1s - last 4 rows, first 4 cols
    expect(m.matrix[5].slice(0, 4)).toEqual([1, 1, 1, 1]);
    expect(m.matrix[5][4]).toBe(0);
    expect(m.matrix[2][0]).toBe(1);
    expect(m.matrix[1][0]).toBe(0);
  });

  it('puts workstation bottom-left and plant top-right visually', () => {
    const floor: FloorConfig = { width: 5, height: 5, a: 1 };
    const entities: Entity[] = [
      { id: 'w', kind: 'workstation', code: 1, x: 0, y: 0, width: 2, height: 2 },
      { id: 'p', kind: 'plant', code: 2, x: 3, y: 3, width: 2, height: 2 },
    ];
    const m = generateFloorMatrix(entities, floor);
    // Top-right of matrix (row 0, last cols) = plant (high Y)
    expect(m.matrix[0][3]).toBe(2);
    expect(m.matrix[0][4]).toBe(2);
    // Bottom-left of matrix (last row, first cols) = workstation
    expect(m.matrix[4][0]).toBe(1);
    expect(m.matrix[4][1]).toBe(1);
    // Empty corner
    expect(m.matrix[0][0]).toBe(0);
    expect(m.matrix[4][4]).toBe(0);
  });

  it('exports clean JSON with matrix field', () => {
    const m = generateFloorMatrix([], { width: 2, height: 2, a: 1 });
    const json = JSON.parse(matrixToJson(m));
    expect(json).toEqual({
      cellSize: 1,
      rows: 2,
      cols: 2,
      matrix: [
        [0, 0],
        [0, 0],
      ],
    });
  });
});
