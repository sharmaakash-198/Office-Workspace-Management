import { describe, expect, it } from 'vitest';
import { snapPointToGrid, snapToGrid } from './snapping';

describe('snapToGrid', () => {
  it('snaps to the nearest multiple of gridSize', () => {
    expect(snapToGrid(23, 5)).toBe(25);
    expect(snapToGrid(22, 5)).toBe(20);
    expect(snapToGrid(37, 10)).toBe(40);
    expect(snapToGrid(37, 5)).toBe(35);
  });

  it('supports fine (sub-1) grid sizes down to 0.25', () => {
    expect(snapToGrid(8.3, 0.25)).toBe(8.25);
    expect(snapToGrid(8.4, 0.25)).toBe(8.5);
  });
});

describe('snapPointToGrid', () => {
  it('snaps both axes independently', () => {
    expect(snapPointToGrid(23, 37, 5)).toEqual({ x: 25, y: 35 });
  });
});
