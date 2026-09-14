export type Point = {
  x: number;
  y: number;
};

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FloorConfig = {
  width: number;
  height: number;
  a: number;
};

export type FloorObjectType = 'RECTANGLE';

export type FloorObject = {
  id: string;
  type: FloorObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type EntityKind =
  | 'workstation'
  | 'plant'
  | 'meeting_room'
  | 'cafeteria'
  | 'custom'
  | 'polygon'
  | 'text';

export type FootprintRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Entity = {
  id: string;
  kind: EntityKind;
  /** Integer code stamped into the occupancy matrix (0 for text). */
  code: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  points?: Point[];
  /** Exact cell rectangles relative to (x,y) - preserves irregular polygon shapes. */
  footprint?: FootprintRect[];
  label?: string;
  color?: string;
  /** Label font scale for shapes (1 = default). Absolute meters for text entities. */
  fontSize?: number;
};

export type CellRef = {
  level: number;
  col: number;
  row: number;
};

export type EditorTool = 'select' | 'pan' | 'place';

export type LibraryItem = {
  id: string;
  kind: Exclude<EntityKind, 'polygon'>;
  label: string;
  code: number;
  defaultWidth: number;
  defaultHeight: number;
  color: string;
  fromSelection?: boolean;
  /** Relative footprint for custom shapes created from cell selection. */
  footprint?: FootprintRect[];
  defaultFontSize?: number;
};
