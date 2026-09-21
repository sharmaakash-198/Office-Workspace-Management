import { describe, expect, it } from 'vitest';
import type { Entity, FloorPlanDoc, GridCell, Wall } from '../types/floorplan';
import { absoluteCells } from '../geometry/cells';
import { createEmptyDoc } from './document';
import {
  FloorPlanFormatError,
  deserializeFloorPlan,
  deserializeFloorPlanFromString,
  serializeFloorPlan,
  serializeFloorPlanToString,
} from './serialization';

const cell = (x: number, y: number): GridCell => ({ x, y });

function entity(partial: Partial<Entity> = {}): Entity {
  return {
    id: 'ent-1',
    kind: 'desk',
    code: 1,
    origin: cell(10, 20),
    size: { w: 3, h: 2 },
    rotation: 0,
    ...partial,
  };
}

function docWith(entities: Entity[] = [], walls: Wall[] = []): FloorPlanDoc {
  const doc = createEmptyDoc();
  return {
    ...doc,
    workspace: { ...doc.workspace, id: 'ws-1', name: 'HQ' },
    floors: [{ ...doc.floors[0], id: 'floor-1', name: 'Ground', entities, walls }],
  };
}

function cellsOf(doc: FloorPlanDoc, index = 0): string[] {
  return absoluteCells(doc.floors[0].entities[index])
    .map((c) => `${c.x},${c.y}`)
    .sort();
}

describe('serializeFloorPlan', () => {
  it('declares both coordinate spaces so consumers cannot confuse them', () => {
    const json = serializeFloorPlan(docWith([entity()]));
    expect(json.coordinateSystem.cells).toContain('Cell (i,j)');
    expect(json.coordinateSystem.vertices).toContain('Vertex (i,j)');
    expect(json.coordinateSystem.origin).toBe('bottom-left');
    expect(json.coordinateSystem.yAxis).toBe('up');
  });

  it('emits vertex-indexed polygon rings, not cell lists', () => {
    const json = serializeFloorPlan(docWith([entity()]));
    const geometry = json.floors[0].objects[0].geometry;
    expect(geometry.type).toBe('POLYGON');
    expect(geometry.coordinateSystem).toBe('GRID_VERTEX_INDEX');
    expect(geometry.rings).toHaveLength(1);
    // A 3x2 object at cell (10,20) spans vertices x 10..13 and y 20..22.
    expect(geometry.rings[0].vertices).toEqual([
      [10, 20],
      [13, 20],
      [13, 22],
      [10, 22],
    ]);
  });

  it('derives workspace dimensions in world units from cells and a', () => {
    const json = serializeFloorPlan(docWith());
    expect(json.workspace.cells).toEqual({ width: 256, height: 256 });
    expect(json.workspace.dimensions).toEqual({
      length: 64,
      breadth: 64,
      unit: 'meter',
    });
  });

  it('omits optional fields that were never set', () => {
    const json = serializeFloorPlan(docWith([entity()]));
    const obj = json.floors[0].objects[0];
    expect('label' in obj).toBe(false);
    expect('color' in obj).toBe(false);
  });

  it('reports wall thickness in both cells and world units', () => {
    const wall: Wall = {
      id: 'wall-1',
      points: [cell(2, 2), cell(8, 2)],
      thickness: 2,
      exterior: true,
    };
    const json = serializeFloorPlan(docWith([], [wall]));
    expect(json.floors[0].walls[0].properties).toEqual({
      exterior: true,
      thicknessCells: 2,
      thickness: 0.5,
    });
  });
});

describe('round trips', () => {
  it('preserves a rectangular object exactly', () => {
    const original = docWith([entity()]);
    const restored = deserializeFloorPlan(serializeFloorPlan(original));
    expect(cellsOf(restored)).toEqual(cellsOf(original));
    expect(restored.floors[0].entities[0].size).toEqual({ w: 3, h: 2 });
    expect(restored.floors[0].entities[0].cells).toBeUndefined();
  });

  it('preserves an irregular L-shaped footprint', () => {
    const original = docWith([
      entity({
        size: { w: 3, h: 3 },
        cells: [cell(0, 0), cell(0, 1), cell(0, 2), cell(1, 2), cell(2, 2)],
      }),
    ]);
    const restored = deserializeFloorPlan(serializeFloorPlan(original));
    expect(cellsOf(restored)).toEqual(cellsOf(original));
  });

  it('preserves a footprint containing a hole', () => {
    const cells: GridCell[] = [];
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if (x >= 1 && x <= 2 && y >= 1 && y <= 2) continue;
        cells.push(cell(x, y));
      }
    }
    const original = docWith([entity({ size: { w: 4, h: 4 }, cells })]);
    const restored = deserializeFloorPlan(serializeFloorPlan(original));
    expect(cellsOf(restored)).toEqual(cellsOf(original));
  });

  it('preserves rotation, labels and colours', () => {
    const original = docWith([
      entity({ rotation: 270, label: 'Engineering', color: '#3b82f6', code: 7 }),
    ]);
    const restored = deserializeFloorPlan(serializeFloorPlan(original));
    const e = restored.floors[0].entities[0];
    expect(e.rotation).toBe(270);
    expect(e.label).toBe('Engineering');
    expect(e.color).toBe('#3b82f6');
    expect(e.code).toBe(7);
  });

  it('preserves walls', () => {
    const wall: Wall = {
      id: 'wall-1',
      points: [cell(2, 2), cell(2, 9), cell(11, 9)],
      thickness: 1,
      exterior: false,
      color: '#888888',
    };
    const restored = deserializeFloorPlan(serializeFloorPlan(docWith([], [wall])));
    expect(restored.floors[0].walls[0]).toEqual(wall);
  });

  it('preserves multiple floors and their order', () => {
    const base = docWith([entity()]);
    const original: FloorPlanDoc = {
      ...base,
      floors: [
        base.floors[0],
        { id: 'floor-2', name: 'First', entities: [entity({ id: 'ent-2' })], walls: [] },
        { id: 'floor-3', name: 'Second', entities: [], walls: [] },
      ],
    };
    const restored = deserializeFloorPlan(serializeFloorPlan(original));
    expect(restored.floors.map((f) => f.name)).toEqual(['Ground', 'First', 'Second']);
  });

  it('is deterministic: save -> load -> save is byte identical', () => {
    const original = docWith(
      [
        entity(),
        entity({
          id: 'ent-2',
          origin: cell(-4, -2),
          size: { w: 3, h: 3 },
          cells: [cell(0, 0), cell(1, 0), cell(2, 0), cell(0, 1), cell(0, 2)],
        }),
      ],
      [{ id: 'wall-1', points: [cell(0, 0), cell(6, 0)], thickness: 1, exterior: true }],
    );
    const first = serializeFloorPlanToString(original);
    const second = serializeFloorPlanToString(deserializeFloorPlanFromString(first));
    expect(second).toBe(first);
  });

  it('survives repeated round trips without drift', () => {
    let doc = docWith([
      entity({ size: { w: 4, h: 3 }, cells: [cell(0, 0), cell(3, 2), cell(1, 1)] }),
    ]);
    const target = cellsOf(doc);
    for (let i = 0; i < 5; i++) {
      doc = deserializeFloorPlanFromString(serializeFloorPlanToString(doc));
    }
    expect(cellsOf(doc)).toEqual(target);
  });
});

describe('validation', () => {
  it('rejects an unsupported major version', () => {
    const json = serializeFloorPlan(docWith([entity()])) as unknown as {
      version: string;
    };
    json.version = '2.0';
    expect(() => deserializeFloorPlan(json)).toThrow(FloorPlanFormatError);
  });

  it('rejects malformed JSON text', () => {
    expect(() => deserializeFloorPlanFromString('{ nope')).toThrow(FloorPlanFormatError);
  });

  it('reports the JSON path of a bad value', () => {
    const json = JSON.parse(serializeFloorPlanToString(docWith([entity()])));
    json.floors[0].objects[0].transform.rotation = 45;
    expect(() => deserializeFloorPlan(json)).toThrow(/rotation/);
  });

  it('rejects non-integer vertices', () => {
    const json = JSON.parse(serializeFloorPlanToString(docWith([entity()])));
    json.floors[0].objects[0].geometry.rings[0].vertices[0] = [1.5, 2];
    expect(() => deserializeFloorPlan(json)).toThrow(/integer/);
  });

  it('rejects a document with no floors', () => {
    const json = JSON.parse(serializeFloorPlanToString(docWith()));
    json.floors = [];
    expect(() => deserializeFloorPlan(json)).toThrow(FloorPlanFormatError);
  });

  it('rejects a wall with a single point', () => {
    const json = JSON.parse(
      serializeFloorPlanToString(
        docWith([], [{ id: 'w', points: [cell(0, 0), cell(1, 0)], thickness: 1, exterior: false }]),
      ),
    );
    json.floors[0].walls[0].geometry.points = [[0, 0]];
    expect(() => deserializeFloorPlan(json)).toThrow(/at least two points/);
  });
});
