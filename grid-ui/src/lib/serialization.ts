/**
 * The floor-plan wire contract.
 *
 * This module is the boundary between the editor and everything downstream.
 * The editor works in occupied cells because that makes selection, collision
 * and undo trivial; consumers want polygons they can hand straight to a
 * renderer. So geometry is serialized as **grid-vertex polygons** and rebuilt
 * back into cells on load. The conversion is lossless, which means the file has
 * exactly one source of truth and cells can never drift from vertices.
 *
 * Two integer coordinate spaces appear in the output and they are not
 * interchangeable:
 *
 *   cells    - cell (i,j) covers world [i·a, (i+1)·a] x [j·a, (j+1)·a]
 *   vertices - vertex (i,j) is the single world point (i·a, j·a)
 *
 * An object three cells wide spans vertex x = 0..3. Both are declared in the
 * `coordinateSystem` block of every document so a consumer never has to guess.
 */

import type {
  Entity,
  EntityKind,
  Floor,
  FloorPlanDoc,
  GridCell,
  Rotation,
  Wall,
} from '../types/floorplan';
import { absoluteCells, footprintFromCells } from '../geometry/cells';
import { cellsToRings, ringsToCells, type Ring, type RingRole } from '../geometry/rings';

export const FLOOR_PLAN_VERSION = '1.0';

export type SerializedRing = {
  role: RingRole;
  vertices: [number, number][];
};

export type SerializedObject = {
  id: string;
  type: string;
  code: number;
  geometry: {
    type: 'POLYGON';
    coordinateSystem: 'GRID_VERTEX_INDEX';
    rings: SerializedRing[];
  };
  /**
   * Bounding-box origin in cells plus orientation. Both are derived from the
   * rings and provided for convenience; the rings remain authoritative.
   * Rotation is already baked into the geometry and is reported only so a
   * renderer can orient icons and labels.
   */
  transform: {
    x: number;
    y: number;
    rotation: Rotation;
  };
  sizeCells: { width: number; height: number };
  label?: string;
  color?: string;
  fontSize?: number;
};

export type SerializedWall = {
  id: string;
  geometry: {
    type: 'POLYLINE';
    coordinateSystem: 'GRID_VERTEX_INDEX';
    points: [number, number][];
  };
  properties: {
    exterior: boolean;
    thicknessCells: number;
    thickness: number;
  };
  color?: string;
};

export type SerializedFloor = {
  id: string;
  name: string;
  objects: SerializedObject[];
  walls: SerializedWall[];
};

export type FloorPlanJson = {
  version: string;
  generator: string;
  coordinateSystem: {
    origin: 'bottom-left';
    yAxis: 'up';
    cells: string;
    vertices: string;
  };
  workspace: {
    id: string;
    name: string;
    dimensions: { length: number; breadth: number; unit: string };
    cells: { width: number; height: number };
  };
  grid: {
    baseUnit: { name: 'a'; value: number; unit: string };
    canonicalLevel: number;
    subdivisionFactor: number;
    coarserLevels: number;
  };
  floors: SerializedFloor[];
};

const COORDINATE_SYSTEM_DOC = {
  origin: 'bottom-left',
  yAxis: 'up',
  cells:
    'Integer cell index. Cell (i,j) covers world x in [i*a,(i+1)*a] and y in [j*a,(j+1)*a].',
  vertices:
    'Integer grid-vertex index. Vertex (i,j) is the world point (i*a, j*a). An object n cells wide spans vertex indices 0..n.',
} as const;

function toPairs(cells: GridCell[]): [number, number][] {
  return cells.map((c) => [c.x, c.y]);
}

function fromPairs(pairs: [number, number][]): GridCell[] {
  return pairs.map(([x, y]) => ({ x, y }));
}

function serializeRings(rings: Ring[]): SerializedRing[] {
  return rings.map((r) => ({ role: r.role, vertices: toPairs(r.vertices) }));
}

function serializeObject(entity: Entity): SerializedObject {
  const rings = cellsToRings(absoluteCells(entity));
  const out: SerializedObject = {
    id: entity.id,
    type: entity.kind.toUpperCase(),
    code: entity.code,
    geometry: {
      type: 'POLYGON',
      coordinateSystem: 'GRID_VERTEX_INDEX',
      rings: serializeRings(rings),
    },
    transform: {
      x: entity.origin.x,
      y: entity.origin.y,
      rotation: entity.rotation,
    },
    sizeCells: { width: entity.size.w, height: entity.size.h },
  };
  // Only emit optional fields when set, so equal documents stringify equally.
  if (entity.label !== undefined) out.label = entity.label;
  if (entity.color !== undefined) out.color = entity.color;
  if (entity.fontSize !== undefined) out.fontSize = entity.fontSize;
  return out;
}

function serializeWall(wall: Wall, a: number): SerializedWall {
  const out: SerializedWall = {
    id: wall.id,
    geometry: {
      type: 'POLYLINE',
      coordinateSystem: 'GRID_VERTEX_INDEX',
      points: toPairs(wall.points),
    },
    properties: {
      exterior: wall.exterior,
      thicknessCells: wall.thickness,
      thickness: round(wall.thickness * a),
    },
  };
  if (wall.color !== undefined) out.color = wall.color;
  return out;
}

/** Trim float noise from derived world-unit values so output is stable. */
function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Produce the canonical JSON document.
 *
 * Deterministic: the same logical plan always yields byte-identical output,
 * which is what makes save -> load -> save a no-op and diffs meaningful.
 */
export function serializeFloorPlan(doc: FloorPlanDoc): FloorPlanJson {
  const { workspace, grid, floors } = doc;
  return {
    version: FLOOR_PLAN_VERSION,
    generator: 'dskt-mapper',
    coordinateSystem: { ...COORDINATE_SYSTEM_DOC },
    workspace: {
      id: workspace.id,
      name: workspace.name,
      dimensions: {
        length: round(workspace.widthCells * grid.a),
        breadth: round(workspace.heightCells * grid.a),
        unit: workspace.unit,
      },
      cells: { width: workspace.widthCells, height: workspace.heightCells },
    },
    grid: {
      baseUnit: { name: 'a', value: grid.a, unit: workspace.unit },
      canonicalLevel: 0,
      subdivisionFactor: grid.subdivisionFactor,
      coarserLevels: grid.levels,
    },
    floors: floors.map((floor) => ({
      id: floor.id,
      name: floor.name,
      objects: floor.entities.map(serializeObject),
      walls: floor.walls.map((w) => serializeWall(w, grid.a)),
    })),
  };
}

export function serializeFloorPlanToString(doc: FloorPlanDoc): string {
  return JSON.stringify(serializeFloorPlan(doc), null, 2);
}

export class FloorPlanFormatError extends Error {}

function requireObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new FloorPlanFormatError(`Expected an object at ${path}`);
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new FloorPlanFormatError(`Expected an array at ${path}`);
  }
  return value;
}

function requireNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new FloorPlanFormatError(`Expected a number at ${path}`);
  }
  return value;
}

function requireInt(value: unknown, path: string): number {
  const n = requireNumber(value, path);
  if (!Number.isInteger(n)) {
    throw new FloorPlanFormatError(`Expected an integer at ${path}, got ${n}`);
  }
  return n;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    throw new FloorPlanFormatError(`Expected a string at ${path}`);
  }
  return value;
}

function parsePairs(value: unknown, path: string): [number, number][] {
  return requireArray(value, path).map((pair, i) => {
    const p = requireArray(pair, `${path}[${i}]`);
    if (p.length !== 2) {
      throw new FloorPlanFormatError(`Expected [x, y] at ${path}[${i}]`);
    }
    return [requireInt(p[0], `${path}[${i}][0]`), requireInt(p[1], `${path}[${i}][1]`)];
  });
}

function parseRotation(value: unknown, path: string): Rotation {
  const n = requireInt(value, path);
  if (n !== 0 && n !== 90 && n !== 180 && n !== 270) {
    throw new FloorPlanFormatError(`Rotation at ${path} must be 0, 90, 180 or 270`);
  }
  return n;
}

function parseObject(raw: unknown, path: string): Entity {
  const obj = requireObject(raw, path);
  const geometry = requireObject(obj.geometry, `${path}.geometry`);
  const rawRings = requireArray(geometry.rings, `${path}.geometry.rings`);

  const rings: Ring[] = rawRings.map((r, i) => {
    const ring = requireObject(r, `${path}.geometry.rings[${i}]`);
    const role = requireString(ring.role, `${path}.geometry.rings[${i}].role`);
    if (role !== 'outer' && role !== 'hole') {
      throw new FloorPlanFormatError(
        `Ring role at ${path}.geometry.rings[${i}] must be "outer" or "hole"`,
      );
    }
    return {
      role,
      vertices: fromPairs(
        parsePairs(ring.vertices, `${path}.geometry.rings[${i}].vertices`),
      ),
    };
  });

  const cells = ringsToCells(rings);
  const footprint = footprintFromCells(cells);
  if (!footprint) {
    throw new FloorPlanFormatError(`Object at ${path} has no occupied cells`);
  }

  const transform = requireObject(obj.transform, `${path}.transform`);
  const entity: Entity = {
    id: requireString(obj.id, `${path}.id`),
    kind: requireString(obj.type, `${path}.type`).toLowerCase() as EntityKind,
    code: requireInt(obj.code, `${path}.code`),
    origin: footprint.origin,
    size: footprint.size,
    cells: footprint.cells,
    rotation: parseRotation(transform.rotation, `${path}.transform.rotation`),
  };
  if (typeof obj.label === 'string') entity.label = obj.label;
  if (typeof obj.color === 'string') entity.color = obj.color;
  if (typeof obj.fontSize === 'number') entity.fontSize = obj.fontSize;
  return entity;
}

function parseWall(raw: unknown, path: string): Wall {
  const obj = requireObject(raw, path);
  const geometry = requireObject(obj.geometry, `${path}.geometry`);
  const points = fromPairs(parsePairs(geometry.points, `${path}.geometry.points`));
  if (points.length < 2) {
    throw new FloorPlanFormatError(`Wall at ${path} needs at least two points`);
  }
  const properties = requireObject(obj.properties, `${path}.properties`);
  const wall: Wall = {
    id: requireString(obj.id, `${path}.id`),
    points,
    thickness: requireNumber(
      properties.thicknessCells,
      `${path}.properties.thicknessCells`,
    ),
    exterior: properties.exterior === true,
  };
  if (typeof obj.color === 'string') wall.color = obj.color;
  return wall;
}

/**
 * Rebuild the editor model from a document.
 *
 * Throws `FloorPlanFormatError` with a JSON path rather than silently
 * producing a half-loaded plan.
 */
export function deserializeFloorPlan(raw: unknown): FloorPlanDoc {
  const root = requireObject(raw, '$');
  const version = requireString(root.version, '$.version');
  if (version.split('.')[0] !== FLOOR_PLAN_VERSION.split('.')[0]) {
    throw new FloorPlanFormatError(
      `Unsupported floor plan version "${version}"; expected ${FLOOR_PLAN_VERSION}`,
    );
  }

  const workspace = requireObject(root.workspace, '$.workspace');
  const wsCells = requireObject(workspace.cells, '$.workspace.cells');
  const dimensions = requireObject(workspace.dimensions, '$.workspace.dimensions');
  const grid = requireObject(root.grid, '$.grid');
  const baseUnit = requireObject(grid.baseUnit, '$.grid.baseUnit');

  const floors: Floor[] = requireArray(root.floors, '$.floors').map((f, i) => {
    const floor = requireObject(f, `$.floors[${i}]`);
    return {
      id: requireString(floor.id, `$.floors[${i}].id`),
      name: requireString(floor.name, `$.floors[${i}].name`),
      entities: requireArray(floor.objects, `$.floors[${i}].objects`).map((o, j) =>
        parseObject(o, `$.floors[${i}].objects[${j}]`),
      ),
      walls: requireArray(floor.walls, `$.floors[${i}].walls`).map((w, j) =>
        parseWall(w, `$.floors[${i}].walls[${j}]`),
      ),
    };
  });

  if (floors.length === 0) {
    throw new FloorPlanFormatError('A floor plan must contain at least one floor');
  }

  return {
    workspace: {
      id: requireString(workspace.id, '$.workspace.id'),
      name: requireString(workspace.name, '$.workspace.name'),
      widthCells: requireInt(wsCells.width, '$.workspace.cells.width'),
      heightCells: requireInt(wsCells.height, '$.workspace.cells.height'),
      unit: requireString(dimensions.unit, '$.workspace.dimensions.unit'),
    },
    grid: {
      a: requireNumber(baseUnit.value, '$.grid.baseUnit.value'),
      subdivisionFactor: requireInt(
        grid.subdivisionFactor,
        '$.grid.subdivisionFactor',
      ),
      levels: requireInt(grid.coarserLevels, '$.grid.coarserLevels'),
    },
    floors,
  };
}

export function deserializeFloorPlanFromString(text: string): FloorPlanDoc {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new FloorPlanFormatError(
      `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return deserializeFloorPlan(parsed);
}
