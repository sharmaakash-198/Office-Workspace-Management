import { describe, expect, it } from 'vitest';
import type { Entity, GridCell } from '../types/floorplan';
import {
  absoluteCells,
  cellRange,
  footprintFromCells,
  isSolidRect,
  normalizeCells,
  relativeCells,
  resizeEntity,
  rotateCellsCW,
  rotateEntity,
  translateEntity,
  worldToCell,
  worldToVertex,
} from './cells';

const cell = (x: number, y: number): GridCell => ({ x, y });

const keys = (cells: GridCell[]) => cells.map((c) => `${c.x},${c.y}`).sort();

function entity(partial: Partial<Entity> = {}): Entity {
  return {
    id: 'e1',
    kind: 'desk',
    code: 1,
    origin: cell(0, 0),
    size: { w: 3, h: 2 },
    rotation: 0,
    ...partial,
  };
}

describe('relativeCells / absoluteCells', () => {
  it('expands an implicit rectangle', () => {
    expect(relativeCells(entity())).toHaveLength(6);
  });

  it('offsets by the origin', () => {
    const cells = absoluteCells(entity({ origin: cell(10, 20) }));
    expect(keys(cells)).toContain('10,20');
    expect(keys(cells)).toContain('12,21');
  });
});

describe('normalizeCells', () => {
  it('shifts the minimum corner to the origin and reports the offset', () => {
    const result = normalizeCells([cell(5, 7), cell(6, 7), cell(5, 8)]);
    expect(result.origin).toEqual(cell(5, 7));
    expect(result.size).toEqual({ w: 2, h: 2 });
    expect(keys(result.cells)).toEqual(['0,0', '0,1', '1,0']);
  });

  it('removes duplicates', () => {
    const result = normalizeCells([cell(1, 1), cell(1, 1), cell(2, 1)]);
    expect(result.cells).toHaveLength(2);
  });

  it('handles negative coordinates', () => {
    const result = normalizeCells([cell(-4, -3), cell(-3, -3)]);
    expect(result.origin).toEqual(cell(-4, -3));
    expect(result.size).toEqual({ w: 2, h: 1 });
  });
});

describe('footprintFromCells', () => {
  it('drops the explicit cell list for a solid rectangle', () => {
    const fp = footprintFromCells(cellRange(cell(2, 2), cell(4, 3)));
    expect(fp?.size).toEqual({ w: 3, h: 2 });
    expect(fp?.cells).toBeUndefined();
  });

  it('keeps the cell list for an irregular shape', () => {
    const fp = footprintFromCells([cell(0, 0), cell(1, 0), cell(0, 1)]);
    expect(fp?.cells).toHaveLength(3);
  });

  it('returns null for an empty selection', () => {
    expect(footprintFromCells([])).toBeNull();
  });
});

describe('rotateCellsCW', () => {
  it('swaps the bounding box dimensions', () => {
    const result = rotateCellsCW([cell(0, 0), cell(1, 0), cell(2, 0)], { w: 3, h: 1 });
    expect(result.size).toEqual({ w: 1, h: 3 });
  });

  it('turns a horizontal bar into a vertical bar', () => {
    const result = rotateCellsCW([cell(0, 0), cell(1, 0), cell(2, 0)], { w: 3, h: 1 });
    expect(keys(result.cells)).toEqual(['0,0', '0,1', '0,2']);
  });

  it('returns to the original after four turns', () => {
    const original = [cell(0, 0), cell(0, 1), cell(0, 2), cell(1, 2), cell(2, 2)];
    let state = { cells: original, size: { w: 3, h: 3 } };
    for (let i = 0; i < 4; i++) state = rotateCellsCW(state.cells, state.size);
    expect(keys(state.cells)).toEqual(keys(original));
    expect(state.size).toEqual({ w: 3, h: 3 });
  });

  it('produces an exact cell set with no loss for an L shape', () => {
    const original = [cell(0, 0), cell(0, 1), cell(0, 2), cell(1, 2), cell(2, 2)];
    const rotated = rotateCellsCW(original, { w: 3, h: 3 });
    expect(rotated.cells).toHaveLength(original.length);
    expect(rotated.cells.every((c) => Number.isInteger(c.x) && Number.isInteger(c.y))).toBe(
      true,
    );
  });
});

describe('rotateEntity', () => {
  it('advances the rotation metadata', () => {
    expect(rotateEntity(entity(), 1).rotation).toBe(90);
    expect(rotateEntity(entity({ rotation: 270 }), 1).rotation).toBe(0);
  });

  it('bakes the turn into the footprint rather than deferring it', () => {
    const rotated = rotateEntity(entity({ size: { w: 4, h: 1 } }), 1);
    expect(rotated.size).toEqual({ w: 1, h: 4 });
  });

  it('keeps the footprint grid aligned', () => {
    const rotated = rotateEntity(
      entity({ origin: cell(7, 3), size: { w: 5, h: 2 } }),
      1,
    );
    expect(Number.isInteger(rotated.origin.x)).toBe(true);
    expect(Number.isInteger(rotated.origin.y)).toBe(true);
  });

  it('pivots about the centre so the shape does not drift', () => {
    const source = entity({ origin: cell(10, 10), size: { w: 4, h: 2 } });
    const rotated = rotateEntity(source, 1);
    const centreBefore = {
      x: source.origin.x + source.size.w / 2,
      y: source.origin.y + source.size.h / 2,
    };
    const centreAfter = {
      x: rotated.origin.x + rotated.size.w / 2,
      y: rotated.origin.y + rotated.size.h / 2,
    };
    expect(Math.abs(centreAfter.x - centreBefore.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(centreAfter.y - centreBefore.y)).toBeLessThanOrEqual(0.5);
  });

  it('is a no-op for zero turns', () => {
    const source = entity();
    expect(rotateEntity(source, 0)).toBe(source);
  });

  it('preserves cell count through a full turn cycle', () => {
    const source = entity({
      size: { w: 3, h: 3 },
      cells: [cell(0, 0), cell(1, 0), cell(2, 0), cell(0, 1), cell(0, 2)],
    });
    let current = source;
    for (let i = 0; i < 4; i++) current = rotateEntity(current, 1);
    expect(keys(absoluteCells(current))).toHaveLength(5);
    expect(current.rotation).toBe(0);
  });
});

describe('translateEntity', () => {
  it('moves only the origin', () => {
    const moved = translateEntity(entity({ origin: cell(3, 4) }), 2, -1);
    expect(moved.origin).toEqual(cell(5, 3));
    expect(moved.size).toEqual({ w: 3, h: 2 });
  });

  it('returns the same reference when nothing moves', () => {
    const source = entity();
    expect(translateEntity(source, 0, 0)).toBe(source);
  });
});

describe('resizeEntity', () => {
  it('clamps to at least one cell', () => {
    const resized = resizeEntity(entity(), cell(0, 0), { w: 0, h: -3 });
    expect(resized.size).toEqual({ w: 1, h: 1 });
  });

  it('keeps sizes integral', () => {
    const resized = resizeEntity(entity(), cell(0, 0), { w: 3.7, h: 2.2 });
    expect(resized.size).toEqual({ w: 4, h: 2 });
  });

  it('leaves a rectangle implicit', () => {
    const resized = resizeEntity(entity(), cell(0, 0), { w: 6, h: 4 });
    expect(resized.cells).toBeUndefined();
  });

  it('keeps an irregular shape irregular', () => {
    const source = entity({
      size: { w: 2, h: 2 },
      cells: [cell(0, 0), cell(1, 0), cell(0, 1)],
    });
    const resized = resizeEntity(source, cell(0, 0), { w: 4, h: 4 });
    expect(isSolidRect(resized.cells ?? [], resized.size)).toBe(false);
  });
});

describe('world conversion', () => {
  it('maps a world point to the containing cell', () => {
    expect(worldToCell({ x: 2.6, y: 0.1 }, 0.25)).toEqual(cell(10, 0));
  });

  it('floors toward negative infinity for negative coordinates', () => {
    expect(worldToCell({ x: -0.1, y: -0.6 }, 0.25)).toEqual(cell(-1, -3));
  });

  it('snaps to the nearest vertex, not the containing cell', () => {
    expect(worldToVertex({ x: 2.6, y: 0.1 }, 0.25)).toEqual(cell(10, 0));
    expect(worldToVertex({ x: 2.4, y: 0.2 }, 0.25)).toEqual(cell(10, 1));
  });
});

describe('cellRange', () => {
  it('is inclusive at both ends and order independent', () => {
    expect(cellRange(cell(4, 5), cell(2, 3))).toHaveLength(9);
  });
});
