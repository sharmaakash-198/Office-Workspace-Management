import { describe, expect, it } from 'vitest';
import type { GridCell } from '../types/floorplan';
import { cellsToRings, ringSignedArea2, ringsToCells } from './rings';

const cell = (x: number, y: number): GridCell => ({ x, y });

/** Order-insensitive comparison of two cell sets. */
function sameCells(a: GridCell[], b: GridCell[]): boolean {
  const norm = (cells: GridCell[]) =>
    cells
      .map((c) => `${c.x},${c.y}`)
      .sort()
      .join(' ');
  return norm(a) === norm(b);
}

function rect(x0: number, y0: number, w: number, h: number): GridCell[] {
  const out: GridCell[] = [];
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) out.push(cell(x, y));
  }
  return out;
}

describe('cellsToRings', () => {
  it('returns nothing for an empty cell set', () => {
    expect(cellsToRings([])).toEqual([]);
  });

  it('traces a single cell as a unit square with four vertices', () => {
    const rings = cellsToRings([cell(0, 0)]);
    expect(rings).toHaveLength(1);
    expect(rings[0].role).toBe('outer');
    expect(rings[0].vertices).toHaveLength(4);
  });

  it('spans one more vertex index than cell index on each axis', () => {
    // 3x2 cells occupy x 0..2, so the boundary must reach vertex x = 3.
    const rings = cellsToRings(rect(0, 0, 3, 2));
    const xs = rings[0].vertices.map((v) => v.x);
    const ys = rings[0].vertices.map((v) => v.y);
    expect(Math.max(...xs)).toBe(3);
    expect(Math.max(...ys)).toBe(2);
  });

  it('collapses collinear runs so a rectangle has exactly four vertices', () => {
    const rings = cellsToRings(rect(0, 0, 5, 4));
    expect(rings).toHaveLength(1);
    expect(rings[0].vertices).toHaveLength(4);
  });

  it('winds outer boundaries counter-clockwise', () => {
    const rings = cellsToRings(rect(0, 0, 2, 2));
    expect(ringSignedArea2(rings[0].vertices)).toBeGreaterThan(0);
  });

  it('traces an L shape with six vertices', () => {
    // XXX
    // X
    // X
    const cells = [cell(0, 0), cell(0, 1), cell(0, 2), cell(1, 2), cell(2, 2)];
    const rings = cellsToRings(cells);
    expect(rings).toHaveLength(1);
    expect(rings[0].vertices).toHaveLength(6);
  });

  it('emits a clockwise hole ring for a donut', () => {
    const cells = rect(0, 0, 3, 3).filter((c) => !(c.x === 1 && c.y === 1));
    const rings = cellsToRings(cells);
    expect(rings).toHaveLength(2);
    const outer = rings.find((r) => r.role === 'outer')!;
    const hole = rings.find((r) => r.role === 'hole')!;
    expect(ringSignedArea2(outer.vertices)).toBeGreaterThan(0);
    expect(ringSignedArea2(hole.vertices)).toBeLessThan(0);
  });

  it('emits one outer ring per disconnected group', () => {
    const cells = [...rect(0, 0, 2, 2), ...rect(5, 5, 2, 2)];
    const rings = cellsToRings(cells);
    expect(rings.filter((r) => r.role === 'outer')).toHaveLength(2);
  });

  it('is deterministic regardless of input cell order', () => {
    const cells = rect(2, 3, 4, 3);
    const forward = cellsToRings(cells);
    const reversed = cellsToRings([...cells].reverse());
    expect(JSON.stringify(forward)).toBe(JSON.stringify(reversed));
  });
});

describe('ringsToCells', () => {
  it('round-trips a rectangle', () => {
    const cells = rect(3, 4, 5, 2);
    expect(sameCells(ringsToCells(cellsToRings(cells)), cells)).toBe(true);
  });

  it('round-trips an L shape', () => {
    const cells = [cell(0, 0), cell(0, 1), cell(0, 2), cell(1, 2), cell(2, 2)];
    expect(sameCells(ringsToCells(cellsToRings(cells)), cells)).toBe(true);
  });

  it('round-trips a shape with a hole', () => {
    const cells = rect(0, 0, 4, 4).filter(
      (c) => !(c.x >= 1 && c.x <= 2 && c.y >= 1 && c.y <= 2),
    );
    expect(sameCells(ringsToCells(cellsToRings(cells)), cells)).toBe(true);
  });

  it('round-trips disconnected groups', () => {
    const cells = [...rect(0, 0, 2, 2), ...rect(4, 1, 3, 2)];
    expect(sameCells(ringsToCells(cellsToRings(cells)), cells)).toBe(true);
  });

  it('round-trips negative coordinates', () => {
    const cells = rect(-6, -3, 3, 4);
    expect(sameCells(ringsToCells(cellsToRings(cells)), cells)).toBe(true);
  });

  it('round-trips a U shape', () => {
    // X X
    // X X
    // XXX
    const cells = [
      cell(0, 0),
      cell(1, 0),
      cell(2, 0),
      cell(0, 1),
      cell(2, 1),
      cell(0, 2),
      cell(2, 2),
    ];
    expect(sameCells(ringsToCells(cellsToRings(cells)), cells)).toBe(true);
  });
});
