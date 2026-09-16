import { describe, expect, it } from 'vitest';
import type { Entity, Floor, GridCell, Wall, WorkspaceConfig } from '../types/floorplan';
import { WALL_CODE, generateFloorMatrix, matrixToPlainText } from './matrix';

const cell = (x: number, y: number): GridCell => ({ level: 0, x, y });

const workspace: WorkspaceConfig = {
  id: 'w',
  name: 'W',
  length: 1,
  breadth: 0.75,
  unit: 'meter',
};

function floorWith(entities: Entity[] = [], walls: Wall[] = []): Floor {
  return { id: 'f', name: 'F', entities, walls };
}

function entity(partial: Partial<Entity> = {}): Entity {
  return {
    id: 'e',
    kind: 'desk',
    code: 6,
    level: 0,
    origin: cell(0, 0),
    size: { w: 1, h: 1 },
    rotation: 0,
    ...partial,
  };
}

describe('generateFloorMatrix', () => {
  it('sizes the matrix from the workspace cell extent', () => {
    const m = generateFloorMatrix(floorWith(), workspace, 0.25);
    expect(m.rows).toBe(3);
    expect(m.cols).toBe(4);
    expect(m.cellSize).toBe(0.25);
  });

  it('puts world row 0 at the bottom of the matrix', () => {
    const m = generateFloorMatrix(floorWith([entity()]), workspace, 0.25);
    expect(m.matrix[2][0]).toBe(6);
    expect(m.matrix[0][0]).toBe(0);
  });

  it('stamps every occupied cell of a rectangle', () => {
    const m = generateFloorMatrix(
      floorWith([entity({ size: { w: 2, h: 2 } })]),
      workspace,
      0.25,
    );
    expect(matrixToPlainText(m)).toBe('0 0 0 0\n6 6 0 0\n6 6 0 0');
  });

  it('follows an irregular footprint exactly', () => {
    const m = generateFloorMatrix(
      floorWith([
        entity({ size: { w: 2, h: 2 }, cells: [cell(0, 0), cell(1, 0), cell(0, 1)] }),
      ]),
      workspace,
      0.25,
    );
    expect(matrixToPlainText(m)).toBe('0 0 0 0\n6 0 0 0\n6 6 0 0');
  });

  it('ignores text entities and zero codes', () => {
    const m = generateFloorMatrix(
      floorWith([entity({ kind: 'text', code: 0 })]),
      workspace,
      0.25,
    );
    expect(m.matrix.flat().every((v) => v === 0)).toBe(true);
  });

  it('clips cells that fall outside the workspace', () => {
    const m = generateFloorMatrix(
      floorWith([entity({ origin: cell(3, 2), size: { w: 4, h: 4 } })]),
      workspace,
      0.25,
    );
    expect(m.matrix[0][3]).toBe(6);
    expect(m.rows).toBe(3);
    expect(m.cols).toBe(4);
  });

  it('stamps walls with a reserved code', () => {
    const wall: Wall = {
      id: 'w1',
      points: [cell(0, 1), cell(4, 1)],
      thickness: 1,
      exterior: false,
    };
    const m = generateFloorMatrix(floorWith([], [wall]), workspace, 0.25);
    expect(m.matrix[1].every((v) => v === WALL_CODE)).toBe(true);
  });

  it('can omit walls', () => {
    const wall: Wall = {
      id: 'w1',
      points: [cell(0, 1), cell(4, 1)],
      thickness: 1,
      exterior: false,
    };
    const m = generateFloorMatrix(floorWith([], [wall]), workspace, 0.25, {
      includeWalls: false,
    });
    expect(m.matrix.flat().every((v) => v === 0)).toBe(true);
  });

  it('lets later entities overwrite earlier ones', () => {
    const m = generateFloorMatrix(
      floorWith([entity({ id: 'a', code: 1 }), entity({ id: 'b', code: 2 })]),
      workspace,
      0.25,
    );
    expect(m.matrix[2][0]).toBe(2);
  });
});
