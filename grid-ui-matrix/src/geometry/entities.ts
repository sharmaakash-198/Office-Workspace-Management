import type { CellRef, Entity, EntityKind, Point, Rect } from '../types/geometry';
import type { FootprintRect } from './footprint';
import { pointInFootprint } from './footprint';

export type { FootprintRect };

export function entityBounds(entity: Entity): Rect {
  if (entity.kind === 'polygon' && entity.footprint && entity.footprint.length > 0) {
    return { x: entity.x, y: entity.y, width: entity.width, height: entity.height };
  }
  if (entity.kind === 'polygon' && entity.points && entity.points.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of entity.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  if (entity.kind === 'text') {
    return { x: entity.x, y: entity.y, width: entity.width, height: entity.height };
  }
  return { x: entity.x, y: entity.y, width: entity.width, height: entity.height };
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

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function hitTestEntity(entities: Entity[], world: Point): Entity | null {
  for (let i = entities.length - 1; i >= 0; i--) {
    const e = entities[i];
    if (e.kind === 'text') {
      if (pointInRect(world, entityBounds(e))) return e;
      continue;
    }
    if (e.kind === 'polygon' && e.footprint && e.footprint.length > 0) {
      if (pointInFootprint(world, e.x, e.y, e.footprint)) return e;
      continue;
    }
    if (e.kind === 'polygon' && e.points && e.points.length >= 3) {
      if (pointInPolygon(world, e.points)) return e;
      continue;
    }
    if (pointInRect(world, entityBounds(e))) return e;
  }
  return null;
}

export function entitiesIntersectingRect(entities: Entity[], rect: Rect): Entity[] {
  return entities.filter((e) => {
    if (e.kind === 'polygon' && e.footprint && e.footprint.length > 0) {
      return e.footprint.some((f) =>
        rectsIntersect(rect, {
          x: e.x + f.x,
          y: e.y + f.y,
          width: f.width,
          height: f.height,
        }),
      );
    }
    return rectsIntersect(entityBounds(e), rect);
  });
}

export function translateEntity(entity: Entity, dx: number, dy: number): Entity {
  if (entity.kind === 'polygon' && entity.points) {
    return {
      ...entity,
      x: entity.x + dx,
      y: entity.y + dy,
      points: entity.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    };
  }
  return { ...entity, x: entity.x + dx, y: entity.y + dy };
}

export function resizeEntity(
  entity: Entity,
  next: { x: number; y: number; width: number; height: number },
): Entity {
  const ow = Math.max(0.01, entity.width);
  const oh = Math.max(0.01, entity.height);
  const nw = Math.max(0.01, next.width);
  const nh = Math.max(0.01, next.height);
  const sx = nw / ow;
  const sy = nh / oh;

  if (entity.kind === 'polygon' && entity.footprint) {
    return {
      ...entity,
      x: next.x,
      y: next.y,
      width: nw,
      height: nh,
      footprint: entity.footprint.map((f) => ({
        x: f.x * sx,
        y: f.y * sy,
        width: f.width * sx,
        height: f.height * sy,
      })),
      points: entity.points?.map((p) => ({
        x: next.x + (p.x - entity.x) * sx,
        y: next.y + (p.y - entity.y) * sy,
      })),
    };
  }

  if (entity.kind === 'polygon' && entity.points) {
    return {
      ...entity,
      x: next.x,
      y: next.y,
      width: nw,
      height: nh,
      points: entity.points.map((p) => ({
        x: next.x + (p.x - entity.x) * sx,
        y: next.y + (p.y - entity.y) * sy,
      })),
    };
  }

  return {
    ...entity,
    x: next.x,
    y: next.y,
    width: nw,
    height: nh,
  };
}

export function cloneEntity(entity: Entity, id: string): Entity {
  return {
    ...entity,
    id,
    points: entity.points?.map((p) => ({ ...p })),
    footprint: entity.footprint?.map((f) => ({ ...f })),
  };
}

export function createId(prefix = 'e'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export type { CellRef, EntityKind };
