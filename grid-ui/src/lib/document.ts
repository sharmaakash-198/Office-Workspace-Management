/**
 * Document construction and floor-level operations.
 *
 * Pure functions over `FloorPlanDoc` so they stay testable and so the store
 * can treat every edit as a plain value replacement.
 */

import type {
  Entity,
  Floor,
  FloorPlanDoc,
  GridConfig,
  Wall,
  WorkspaceConfig,
} from '../types/floorplan';
import type { FloorConfig } from '../types/geometry';

export function createId(prefix = 'e'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export const DEFAULT_GRID: GridConfig = {
  a: 0.25,
  subdivisionFactor: 4,
  levels: 2,
};

export const DEFAULT_WORKSPACE: WorkspaceConfig = {
  id: 'workspace-1',
  name: 'Office',
  // 64 m x 64 m at a = 0.25 m.
  widthCells: 256,
  heightCells: 256,
  unit: 'meter',
};

export function createFloor(name: string): Floor {
  return { id: createId('floor'), name, entities: [], walls: [] };
}

export function createEmptyDoc(): FloorPlanDoc {
  return {
    workspace: { ...DEFAULT_WORKSPACE },
    grid: { ...DEFAULT_GRID },
    floors: [createFloor('Ground Floor')],
  };
}

/**
 * World-unit view of the workspace, for the camera and grid renderer which
 * think in meters rather than cells.
 */
export function floorConfigOf(doc: FloorPlanDoc): FloorConfig {
  return {
    width: doc.workspace.widthCells * doc.grid.a,
    height: doc.workspace.heightCells * doc.grid.a,
    a: doc.grid.a,
  };
}

export function findFloor(doc: FloorPlanDoc, floorId: string): Floor | undefined {
  return doc.floors.find((f) => f.id === floorId);
}

export function mapFloor(
  doc: FloorPlanDoc,
  floorId: string,
  fn: (floor: Floor) => Floor,
): FloorPlanDoc {
  return {
    ...doc,
    floors: doc.floors.map((f) => (f.id === floorId ? fn(f) : f)),
  };
}

export function setEntities(
  doc: FloorPlanDoc,
  floorId: string,
  entities: Entity[],
): FloorPlanDoc {
  return mapFloor(doc, floorId, (f) => ({ ...f, entities }));
}

export function setWalls(
  doc: FloorPlanDoc,
  floorId: string,
  walls: Wall[],
): FloorPlanDoc {
  return mapFloor(doc, floorId, (f) => ({ ...f, walls }));
}

export function addFloor(doc: FloorPlanDoc, name?: string): {
  doc: FloorPlanDoc;
  floor: Floor;
} {
  const floor = createFloor(name ?? `Floor ${doc.floors.length + 1}`);
  return { doc: { ...doc, floors: [...doc.floors, floor] }, floor };
}

/** Copy a floor's geometry into a new floor, useful for similar storeys. */
export function duplicateFloor(
  doc: FloorPlanDoc,
  floorId: string,
): { doc: FloorPlanDoc; floor: Floor } | null {
  const source = findFloor(doc, floorId);
  if (!source) return null;
  const floor: Floor = {
    id: createId('floor'),
    name: `${source.name} copy`,
    entities: source.entities.map((e) => ({
      ...e,
      id: createId(e.kind),
      origin: { ...e.origin },
      size: { ...e.size },
      cells: e.cells?.map((c) => ({ ...c })),
    })),
    walls: source.walls.map((w) => ({
      ...w,
      id: createId('wall'),
      points: w.points.map((p) => ({ ...p })),
    })),
  };
  const index = doc.floors.findIndex((f) => f.id === floorId);
  const floors = [...doc.floors];
  floors.splice(index + 1, 0, floor);
  return { doc: { ...doc, floors }, floor };
}

/** Removing the last floor is rejected; a plan always has at least one. */
export function removeFloor(doc: FloorPlanDoc, floorId: string): FloorPlanDoc {
  if (doc.floors.length <= 1) return doc;
  return { ...doc, floors: doc.floors.filter((f) => f.id !== floorId) };
}

export function renameFloor(
  doc: FloorPlanDoc,
  floorId: string,
  name: string,
): FloorPlanDoc {
  return mapFloor(doc, floorId, (f) => ({ ...f, name }));
}

export function moveFloor(
  doc: FloorPlanDoc,
  floorId: string,
  direction: -1 | 1,
): FloorPlanDoc {
  const index = doc.floors.findIndex((f) => f.id === floorId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= doc.floors.length) return doc;
  const floors = [...doc.floors];
  [floors[index], floors[target]] = [floors[target], floors[index]];
  return { ...doc, floors };
}

/**
 * Resize the logical workspace.
 *
 * Existing objects keep their cell coordinates; nothing is scaled or moved,
 * even if it now falls outside the boundary.
 */
export function resizeWorkspace(
  doc: FloorPlanDoc,
  widthCells: number,
  heightCells: number,
): FloorPlanDoc {
  return {
    ...doc,
    workspace: {
      ...doc.workspace,
      widthCells: Math.max(1, Math.round(widthCells)),
      heightCells: Math.max(1, Math.round(heightCells)),
    },
  };
}

/**
 * Change the reference cell size.
 *
 * Cell coordinates are untouched, so the plan keeps its shape and simply
 * describes a physically larger or smaller office.
 */
export function setBaseUnit(doc: FloorPlanDoc, a: number): FloorPlanDoc {
  if (!(a > 0)) return doc;
  return { ...doc, grid: { ...doc.grid, a } };
}
