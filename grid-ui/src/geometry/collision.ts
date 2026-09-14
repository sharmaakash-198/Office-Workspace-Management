/**
 * Collision and occupancy checks.
 *
 * Because every footprint is a set of complete cells, overlap is exact set
 * intersection — no polygon clipping and no floating-point tolerance.
 */

import type { Entity, GridCell } from '../types/floorplan';
import { absoluteCells, cellKey } from './cells';

export function cellSetOf(entity: Entity): Set<string> {
  return new Set(absoluteCells(entity).map(cellKey));
}

export function entitiesCollide(a: Entity, b: Entity): boolean {
  const setA = cellSetOf(a);
  for (const cell of absoluteCells(b)) {
    if (setA.has(cellKey(cell))) return true;
  }
  return false;
}

/** Cells shared by two entities. */
export function overlappingCells(a: Entity, b: Entity): GridCell[] {
  const setA = cellSetOf(a);
  return absoluteCells(b).filter((c) => setA.has(cellKey(c)));
}

export type CollisionPair = {
  a: string;
  b: string;
  cells: number;
};

/**
 * All overlapping entity pairs, found via a single occupancy sweep so cost is
 * proportional to occupied cells rather than to the square of the entity count.
 */
export function findCollisions(entities: Entity[]): CollisionPair[] {
  const owners = new Map<string, string[]>();
  for (const entity of entities) {
    for (const cell of absoluteCells(entity)) {
      const k = cellKey(cell);
      const list = owners.get(k);
      if (list) list.push(entity.id);
      else owners.set(k, [entity.id]);
    }
  }

  const counts = new Map<string, number>();
  for (const ids of owners.values()) {
    if (ids.length < 2) continue;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const pair = ids[i] < ids[j] ? `${ids[i]}|${ids[j]}` : `${ids[j]}|${ids[i]}`;
        counts.set(pair, (counts.get(pair) ?? 0) + 1);
      }
    }
  }

  return Array.from(counts.entries()).map(([pair, cells]) => {
    const [a, b] = pair.split('|');
    return { a, b, cells };
  });
}

/** Which entity, if any, occupies a given cell. Later entities win. */
export function entityAtCell(entities: Entity[], cell: GridCell): Entity | null {
  const target = cellKey(cell);
  for (let i = entities.length - 1; i >= 0; i--) {
    for (const c of absoluteCells(entities[i])) {
      if (cellKey(c) === target) return entities[i];
    }
  }
  return null;
}

/**
 * Cells that fall outside the workspace rectangle.
 *
 * Used to warn rather than to block: shrinking a workspace should not silently
 * destroy objects that now sit beyond the boundary.
 */
export function cellsOutsideWorkspace(
  entity: Entity,
  widthCells: number,
  heightCells: number,
): GridCell[] {
  return absoluteCells(entity).filter(
    (c) => c.x < 0 || c.y < 0 || c.x >= widthCells || c.y >= heightCells,
  );
}

export function isWithinWorkspace(
  entity: Entity,
  widthCells: number,
  heightCells: number,
): boolean {
  return cellsOutsideWorkspace(entity, widthCells, heightCells).length === 0;
}
