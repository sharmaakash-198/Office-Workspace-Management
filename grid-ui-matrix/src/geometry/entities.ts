import type { Entity, GridCell, Point, Rect, SubdivisionMode } from '../types/geometry';
import { pointInRelativeCells, cellsToSvgPath } from './footprint';

export function entityWorldRect(entity: Entity, a: number): Rect {
  return {
    x: entity.origin.col * a,
    y: entity.origin.row * a,
    width: entity.widthCells * a,
    height: entity.heightCells * a,
  };
}

export function entityBounds(entity: Entity, a: number): Rect {
  return entityWorldRect(entity, a);
}

export function pointInRect(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

export function isPolygonEntity(entity: Entity): boolean {
  return Boolean(entity.cells && entity.cells.length > 0);
}

export function hitTestEntity(entities: Entity[], world: Point, a: number): Entity | null {
  for (let i = entities.length - 1; i >= 0; i--) {
    const e = entities[i];
    if (isPolygonEntity(e) && e.cells) {
      if (pointInRelativeCells(world, e.origin, e.cells, a)) return e;
      continue;
    }
    if (pointInRect(world, entityBounds(e, a))) return e;
  }
  return null;
}

export function entitiesIntersectingRect(
  entities: Entity[],
  rect: Rect,
  a: number,
): Entity[] {
  return entities.filter((e) => {
    if (isPolygonEntity(e) && e.cells) {
      return e.cells.some((c) =>
        rectsIntersect(rect, {
          x: (e.origin.col + c.col) * a,
          y: (e.origin.row + c.row) * a,
          width: a,
          height: a,
        }),
      );
    }
    return rectsIntersect(entityBounds(e, a), rect);
  });
}

export function translateEntity(entity: Entity, dCol: number, dRow: number): Entity {
  return {
    ...entity,
    origin: {
      col: entity.origin.col + dCol,
      row: entity.origin.row + dRow,
    },
  };
}

/** Discrete scale-up: multiply footprint by subdivision on each axis. */
export function scaleEntityUp(
  entity: Entity,
  subdivision: SubdivisionMode,
): Entity | null {
  if (isPolygonEntity(entity)) return null;
  return {
    ...entity,
    widthCells: entity.widthCells * subdivision,
    heightCells: entity.heightCells * subdivision,
    scaleLevel: entity.scaleLevel + 1,
  };
}

/** Inverse of scaleEntityUp; disabled if not evenly divisible. */
export function scaleEntityDown(
  entity: Entity,
  subdivision: SubdivisionMode,
): Entity | null {
  if (isPolygonEntity(entity)) return null;
  if (entity.scaleLevel <= 0) return null;
  if (entity.widthCells % subdivision !== 0 || entity.heightCells % subdivision !== 0) {
    return null;
  }
  return {
    ...entity,
    widthCells: entity.widthCells / subdivision,
    heightCells: entity.heightCells / subdivision,
    scaleLevel: entity.scaleLevel - 1,
  };
}

export type EntityRotation = 0 | 90 | 180 | 270;

/** Rotate entity 90° anticlockwise; swaps width/height for rects; regenerates polygon path. */
export function rotateEntity90CCW(entity: Entity): Entity {
  const nextRot = (((entity.rotation ?? 0) + 90) % 360) as EntityRotation;

  if (isPolygonEntity(entity) && entity.cells) {
    const w = entity.widthCells;
    // (col, row) -> (row, w-1-col) for 90° CCW in grid space
    const rotated = entity.cells.map((c) => ({
      col: c.row,
      row: w - 1 - c.col,
    }));
    let minCol = Infinity;
    let minRow = Infinity;
    let maxCol = -Infinity;
    let maxRow = -Infinity;
    for (const c of rotated) {
      minCol = Math.min(minCol, c.col);
      minRow = Math.min(minRow, c.row);
      maxCol = Math.max(maxCol, c.col);
      maxRow = Math.max(maxRow, c.row);
    }
    const cells = rotated.map((c) => ({
      col: c.col - minCol,
      row: c.row - minRow,
    }));
    return {
      ...entity,
      origin: {
        col: entity.origin.col + minCol,
        row: entity.origin.row + minRow,
      },
      widthCells: maxCol - minCol + 1,
      heightCells: maxRow - minRow + 1,
      cells,
      svgPath: cellsToSvgPath(cells),
      rotation: nextRot,
    };
  }

  // Axis-aligned catalog rect: swap dims on every 90° CCW turn
  return {
    ...entity,
    widthCells: entity.heightCells,
    heightCells: entity.widthCells,
    rotation: nextRot,
  };
}

/**
 * Free-resize polygon by scaling relative cells into a new AABB
 * (rounded to finest cells) and regenerating svgPath.
 */
export function resizePolygonEntity(
  entity: Entity,
  next: { origin: GridCell; widthCells: number; heightCells: number },
): Entity {
  if (!entity.cells || entity.cells.length === 0) {
    return {
      ...entity,
      origin: next.origin,
      widthCells: Math.max(1, next.widthCells),
      heightCells: Math.max(1, next.heightCells),
    };
  }

  const ow = Math.max(1, entity.widthCells);
  const oh = Math.max(1, entity.heightCells);
  const nw = Math.max(1, next.widthCells);
  const nh = Math.max(1, next.heightCells);
  const sx = nw / ow;
  const sy = nh / oh;

  const scaled: GridCell[] = [];
  const seen = new Set<string>();
  for (const c of entity.cells) {
    const col = Math.round(c.col * sx);
    const row = Math.round(c.row * sy);
    const w = Math.max(1, Math.round(sx));
    const h = Math.max(1, Math.round(sy));
    for (let r = 0; r < h; r++) {
      for (let colOff = 0; colOff < w; colOff++) {
        const nc = Math.min(nw - 1, col + colOff);
        const nr = Math.min(nh - 1, row + r);
        const key = `${nc},${nr}`;
        if (seen.has(key)) continue;
        seen.add(key);
        scaled.push({ col: nc, row: nr });
      }
    }
  }

  if (scaled.length === 0) {
    for (let r = 0; r < nh; r++) {
      for (let c = 0; c < nw; c++) scaled.push({ col: c, row: r });
    }
  }

  return {
    ...entity,
    origin: next.origin,
    widthCells: nw,
    heightCells: nh,
    cells: scaled,
    svgPath: cellsToSvgPath(scaled),
  };
}

export function cloneEntity(entity: Entity, objectId: string): Entity {
  return {
    ...entity,
    objectId,
    origin: { ...entity.origin },
    cells: entity.cells?.map((c) => ({ ...c })),
  };
}

export function createId(prefix = 'e'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function entitiesInCells(
  entities: Entity[],
  cells: GridCell[],
  a: number,
): Entity[] {
  if (cells.length === 0) return [];
  let minCol = Infinity;
  let minRow = Infinity;
  let maxCol = -Infinity;
  let maxRow = -Infinity;
  for (const c of cells) {
    minCol = Math.min(minCol, c.col);
    minRow = Math.min(minRow, c.row);
    maxCol = Math.max(maxCol, c.col);
    maxRow = Math.max(maxRow, c.row);
  }
  const rect: Rect = {
    x: minCol * a,
    y: minRow * a,
    width: (maxCol - minCol + 1) * a,
    height: (maxRow - minRow + 1) * a,
  };
  return entitiesIntersectingRect(entities, rect, a);
}
