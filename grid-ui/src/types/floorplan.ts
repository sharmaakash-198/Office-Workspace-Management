/**
 * Logical floor-plan domain model.
 *
 * Everything spatial in this file is expressed in **canonical cells**: integer
 * coordinates on the finest grid level, where one cell spans `grid.a` world
 * units. Coarser levels exist only to drive rendering and snapping, so no
 * persisted geometry ever carries a level of its own and no coordinate is ever
 * fractional. This is what makes save/load round-trips exact and collision a
 * plain set intersection.
 */

/** Integer coordinate on the canonical (finest) grid. */
export type GridCell = {
  x: number;
  y: number;
};

/** Cell-count size of an axis-aligned bounding box. */
export type CellSize = {
  w: number;
  h: number;
};

export type Rotation = 0 | 90 | 180 | 270;

export const ROTATIONS: Rotation[] = [0, 90, 180, 270];

export type EntityKind =
  | 'area'
  | 'room'
  | 'seat'
  | 'desk'
  | 'plant'
  | 'workstation'
  | 'meeting_room'
  | 'cafeteria'
  | 'custom'
  | 'text';

/**
 * An area-like object: a set of complete occupied cells plus a placement.
 *
 * `cells` holds offsets relative to `origin` and is omitted for the common case
 * of a solid `size.w × size.h` rectangle. Rotation is already baked into
 * `cells`, so the stored footprint is always the true footprint; the field is
 * retained only so renderers can orient icons and labels.
 */
export type Entity = {
  id: string;
  kind: EntityKind;
  /** Value stamped into the occupancy matrix export. 0 means "not stamped". */
  code: number;
  origin: GridCell;
  size: CellSize;
  /** Relative occupied cells. Undefined means the full bounding rectangle. */
  cells?: GridCell[];
  rotation: Rotation;
  label?: string;
  color?: string;
  /** Label scale for shapes; absolute world units for `text` entities. */
  fontSize?: number;
};

/**
 * A linear structure stored as a grid-aligned polyline.
 *
 * Walls carry real thickness because enclosure checks and rendering both need
 * it, and retrofitting thickness after the viewer exists is expensive.
 */
export type Wall = {
  id: string;
  /** Absolute canonical vertices; at least two. */
  points: GridCell[];
  /** Thickness in cells. */
  thickness: number;
  exterior: boolean;
  color?: string;
};

export type Floor = {
  id: string;
  name: string;
  entities: Entity[];
  walls: Wall[];
};

export type GridConfig = {
  /** World size of one canonical cell, in `unit`. This is the reference `a`. */
  a: number;
  /** Cells per axis when stepping one level finer. Must be an integer > 1. */
  subdivisionFactor: number;
  /** Number of coarser levels available above the canonical level. */
  levels: number;
};

export type WorkspaceConfig = {
  id: string;
  name: string;
  /** Workspace extent in canonical cells; always cell-aligned by construction. */
  widthCells: number;
  heightCells: number;
  unit: string;
};

/** The complete logical model. This, and only this, is what gets persisted. */
export type FloorPlanDoc = {
  workspace: WorkspaceConfig;
  grid: GridConfig;
  floors: Floor[];
};

export type EditorTool =
  | 'select'
  | 'pan'
  | 'area'
  | 'wall'
  | 'seat'
  | 'desk'
  | 'plant'
  | 'room'
  | 'delete';

/** Tools that place an entity of a fixed kind by clicking or dragging. */
export const TOOL_ENTITY_KIND: Partial<Record<EditorTool, EntityKind>> = {
  seat: 'seat',
  desk: 'desk',
  plant: 'plant',
  room: 'room',
  area: 'area',
};

export type LibraryItem = {
  id: string;
  kind: EntityKind;
  label: string;
  code: number;
  /** Default footprint in cells. */
  defaultSize: CellSize;
  color: string;
  fromSelection?: boolean;
  /** Relative cells for irregular custom shapes. */
  cells?: GridCell[];
  defaultFontSize?: number;
};
