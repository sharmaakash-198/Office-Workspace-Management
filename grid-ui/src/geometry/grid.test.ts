import { describe, expect, it } from 'vitest';
import {
  MAX_LEVEL_2,
  MAX_LEVEL_4,
  cellKey,
  cellToWorldRect,
  getBaseUnit,
  getGridLevel,
  getLevelCellSize,
  getMaxLevel,
  getVisibleLinePositions,
  isSameCell,
  worldToCell,
} from './grid';

describe('getBaseUnit / getLevelCellSize with finest cell a', () => {
  it('4x: Level MAX equals a; Level 0 is a × 4^MAX', () => {
    const a = 0.25;
    const base = getBaseUnit(a, 4);
    expect(base).toBe(4);
    expect(getLevelCellSize(0, base, 4)).toBe(4);
    expect(getLevelCellSize(1, base, 4)).toBe(1);
    expect(getLevelCellSize(2, base, 4)).toBe(0.25);
  });

  it('2x: supports a → a/2 → … → a/16 from coarsest', () => {
    const a = 0.25;
    const base = getBaseUnit(a, 2);
    expect(getMaxLevel(2)).toBe(MAX_LEVEL_2);
    expect(base).toBe(a * 2 ** MAX_LEVEL_2);
    expect(getLevelCellSize(MAX_LEVEL_2, base, 2)).toBe(a);
    expect(getLevelCellSize(MAX_LEVEL_2 - 1, base, 2)).toBe(a * 2);
  });
});

describe('getGridLevel', () => {
  const baseUnit = 4;

  it('stays at Level 0 when zoomed out', () => {
    expect(getGridLevel(5, baseUnit, MAX_LEVEL_4, 4)).toBe(0);
  });

  it('advances to finer levels as zoom increases', () => {
    expect(getGridLevel(30, baseUnit, MAX_LEVEL_4, 4)).toBeGreaterThanOrEqual(1);
    expect(getGridLevel(200, baseUnit, MAX_LEVEL_4, 4)).toBe(MAX_LEVEL_4);
  });

  it('never exceeds max level', () => {
    expect(getGridLevel(1_000_000, baseUnit, MAX_LEVEL_4, 4)).toBe(MAX_LEVEL_4);
  });
});

describe('worldToCell / cellToWorldRect', () => {
  it('round-trips at level 0', () => {
    const cell = worldToCell({ x: 9.4, y: 8.1 }, 0, 4, 4);
    expect(cell).toEqual({ level: 0, col: 2, row: 2 });
    expect(cellToWorldRect(cell, 4, 4)).toEqual({ x: 8, y: 8, width: 4, height: 4 });
  });

  it('resolves finer cells at deeper levels', () => {
    const cell = worldToCell({ x: 8.3, y: 8.3 }, 2, 4, 4);
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
  it('covers the given range from first quadrant', () => {
    expect(getVisibleLinePositions(0, 10, 4)).toEqual([0, 4, 8, 12]);
  });
});
