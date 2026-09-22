import { describe, expect, it } from 'vitest';
import {
  FINEST_PER_A,
  cellKey,
  cellToWorldRect,
  getBaseUnit,
  getGridLevel,
  getVisibleLinePositions,
  isSameCell,
  levelCellSize,
  worldToCell,
  worldToPlacementFinest,
} from './grid';

describe('levelCellSize fixed ladder', () => {
  const a = 0.25;

  it('maps named levels to 2a, a, a/4, a/16', () => {
    expect(levelCellSize(-1, a)).toBe(2 * a);
    expect(levelCellSize(0, a)).toBe(a);
    expect(levelCellSize(1, a)).toBe(a / 4);
    expect(levelCellSize(2, a)).toBe(a / 16);
  });

  it('coarsest base unit is 2a', () => {
    expect(getBaseUnit(a)).toBe(2 * a);
  });
});

describe('getGridLevel', () => {
  const a = 0.25;

  it('stays coarse when zoomed out', () => {
    expect(getGridLevel(5, a)).toBeLessThanOrEqual(0);
  });

  it('reaches finer levels as zoom increases', () => {
    // a/4 * zoom >= 24 → zoom >= 96/a; a/16 * zoom >= 24 → zoom >= 384/a
    expect(getGridLevel(500, a)).toBeGreaterThanOrEqual(1);
    expect(getGridLevel(2000, a)).toBe(2);
  });

  it('never exceeds level 2', () => {
    expect(getGridLevel(1_000_000, a)).toBe(2);
  });
});

describe('worldToCell / cellToWorldRect', () => {
  const a = 4;

  it('round-trips at level 0', () => {
    const cell = worldToCell({ x: 9.4, y: 8.1 }, 0, a);
    expect(cell).toEqual({ level: 0, col: 2, row: 2 });
    expect(cellToWorldRect(cell, a)).toEqual({ x: 8, y: 8, width: 4, height: 4 });
  });

  it('resolves a/4 cells at level 1', () => {
    const cell = worldToCell({ x: 1.1, y: 0.3 }, 1, a);
    expect(cell.level).toBe(1);
    expect(cell.col).toBe(1);
    expect(cell.row).toBe(0);
  });
});

describe('worldToPlacementFinest', () => {
  it('snaps to a/4 and returns finest origin', () => {
    const a = 0.25;
    const cell = worldToPlacementFinest({ x: a * 0.6, y: a * 0.1 }, a);
    // place size a/4=0.0625; x=0.15 → place col 2 → finest 8
    expect(cell.col % 4).toBe(0);
    expect(cell.row % 4).toBe(0);
    expect(cell.col).toBe(8);
    expect(cell.row).toBe(0);
  });

  it('maps catalog placement cell to finest multiples of 4', () => {
    const a = 1;
    const cell = worldToPlacementFinest({ x: 0.3, y: 0.9 }, a);
    // place size 0.25; col=1,row=3 → finest 4,12
    expect(cell).toEqual({ col: 4, row: 12 });
    expect(FINEST_PER_A).toBe(16);
  });
});

describe('cellKey / isSameCell', () => {
  it('compares cells', () => {
    const a = { level: 1, col: 3, row: 5 };
    const b = { level: 1, col: 3, row: 5 };
    const c = { level: 1, col: 3, row: 6 };
    expect(cellKey(a)).toBe(cellKey(b));
    expect(isSameCell(a, b)).toBe(true);
    expect(isSameCell(a, c)).toBe(false);
  });
});

describe('getVisibleLinePositions', () => {
  it('covers the given range from first quadrant', () => {
    expect(getVisibleLinePositions(0, 10, 4)).toEqual([0, 4, 8, 12]);
  });
});
