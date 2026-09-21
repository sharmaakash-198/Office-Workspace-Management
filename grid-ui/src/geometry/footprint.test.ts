import { describe, expect, it } from 'vitest';
import {
  cellsToFootprint,
  cellsToRelativeFinest,
  cellsToSvgPath,
  outlineGridCells,
  pointInFootprint,
} from './footprint';

describe('cellsToFootprint', () => {
  it('keeps an L-shape as 6 cells, not a filled rectangle', () => {
    const cells = [
      { level: 0, col: 0, row: 0 },
      { level: 0, col: 1, row: 0 },
      { level: 0, col: 0, row: 1 },
      { level: 0, col: 1, row: 1 },
      { level: 0, col: 0, row: 2 },
      { level: 0, col: 0, row: 3 },
    ];
    const built = cellsToFootprint(cells, 1);
    expect(built).not.toBeNull();
    expect(built!.footprint).toHaveLength(6);
    expect(built!.width).toBe(2);
    expect(built!.height).toBe(4);

    expect(
      pointInFootprint({ x: 1.5, y: 2.5 }, built!.origin.x, built!.origin.y, built!.footprint),
    ).toBe(false);
    expect(
      pointInFootprint({ x: 0.5, y: 2.5 }, built!.origin.x, built!.origin.y, built!.footprint),
    ).toBe(true);
  });
});

describe('cellsToRelativeFinest', () => {
  it('stores relative finest cells and svg path for an L', () => {
    const cells = [
      { level: 0, col: 0, row: 0 },
      { level: 0, col: 1, row: 0 },
      { level: 0, col: 0, row: 1 },
      { level: 0, col: 0, row: 2 },
    ];
    const built = cellsToRelativeFinest(cells, 1, 1, 4);
    expect(built).not.toBeNull();
    expect(built!.cells).toHaveLength(4);
    expect(built!.widthCells).toBe(2);
    expect(built!.heightCells).toBe(3);
    const path = cellsToSvgPath(built!.cells);
    expect(path.startsWith('M')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
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
    const outline = outlineGridCells(cells);
    expect(outline.length).toBeGreaterThan(4);
  });
});
