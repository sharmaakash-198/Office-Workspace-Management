import { describe, expect, it } from 'vitest';
import { cellsToFootprint, outlineGridCells, pointInFootprint } from './footprint';

describe('cellsToFootprint', () => {
  it('keeps an L-shape as 6 cells, not a filled rectangle', () => {
    // Boot / inverted-L: 2×2 base + 2 cells stacked on left
    // rows (world): (0,0)(1,0)(0,1)(1,1)(0,2)(0,3) at level with cell size 1 via baseUnit=1 level 0
    const cells = [
      { level: 0, col: 0, row: 0 },
      { level: 0, col: 1, row: 0 },
      { level: 0, col: 0, row: 1 },
      { level: 0, col: 1, row: 1 },
      { level: 0, col: 0, row: 2 },
      { level: 0, col: 0, row: 3 },
    ];
    // baseUnit 1, level 0 → cell size 1
    const built = cellsToFootprint(cells, 1);
    expect(built).not.toBeNull();
    expect(built!.footprint).toHaveLength(6);
    expect(built!.width).toBe(2);
    expect(built!.height).toBe(4);

    // Missing corner of the AABB (1,2) and (1,3) should NOT be inside footprint
    expect(
      pointInFootprint({ x: 1.5, y: 2.5 }, built!.origin.x, built!.origin.y, built!.footprint),
    ).toBe(false);
    expect(
      pointInFootprint({ x: 0.5, y: 2.5 }, built!.origin.x, built!.origin.y, built!.footprint),
    ).toBe(true);
    expect(
      pointInFootprint({ x: 1.5, y: 0.5 }, built!.origin.x, built!.origin.y, built!.footprint),
    ).toBe(true);
  });
});

describe('outlineGridCells', () => {
  it('returns more than 4 vertices for an L shape', () => {
    const cells = [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
      { col: 0, row: 2 },
      { col: 0, row: 3 },
    ];
    const outline = outlineGridCells(cells, 1);
    expect(outline.length).toBeGreaterThan(4);
  });
});
