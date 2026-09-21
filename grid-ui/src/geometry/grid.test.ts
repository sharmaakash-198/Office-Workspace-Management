import { describe, expect, it } from 'vitest';
import {
  MAX_LEVEL,
  cellKey,
  cellToWorldRect,
  getBaseUnit,
  getGridLevel,
  getLevelCellSize,
  getVisibleLinePositions,
  isSameCell,
  worldToCell,
} from './grid';

describe('getBaseUnit / getLevelCellSize with finest cell a', () => {
  it('Level MAX equals a; Level 0 is a × 4^MAX', () => {
    const a = 0.25;
    const base = getBaseUnit(a);
    expect(base).toBe(4); // 0.25 * 16
    expect(getLevelCellSize(0, base)).toBe(4);
    expect(getLevelCellSize(1, base)).toBe(1);
    expect(getLevelCellSize(2, base)).toBe(0.25);
  });
});

describe('getGridLevel', () => {
  const baseUnit = 4;

  it('stays at Level 0 when zoomed out', () => {
    expect(getGridLevel(5, baseUnit)).toBe(0);
  });

  it('advances to finer levels as zoom increases', () => {
    expect(getGridLevel(30, baseUnit)).toBeGreaterThanOrEqual(1);
    expect(getGridLevel(200, baseUnit)).toBe(MAX_LEVEL);
  });

  it('never exceeds MAX_LEVEL', () => {
    expect(getGridLevel(1_000_000, baseUnit)).toBe(MAX_LEVEL);
  });
});

describe('worldToCell / cellToWorldRect', () => {
  it('round-trips at level 0', () => {
    const cell = worldToCell({ x: 9.4, y: 8.1 }, 0, 4);
    expect(cell).toEqual({ level: 0, col: 2, row: 2 });
    expect(cellToWorldRect(cell, 4)).toEqual({ x: 8, y: 8, width: 4, height: 4 });
  });

  it('resolves finer cells at deeper levels', () => {
    const cell = worldToCell({ x: 8.3, y: 8.3 }, 2, 4);
    expect(cell).toEqual({ level: 2, col: 33, row: 33 });
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
  it('covers the given range', () => {
    expect(getVisibleLinePositions(0, 10, 4)).toEqual([0, 4, 8, 12]);
  });
});
