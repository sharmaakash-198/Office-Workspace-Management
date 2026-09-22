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

/**
 * Working floor in units of `a` (level 0).
 * World size = cols*a × rows*a. Finest cell = a/16.
 */
export type FloorConfig = {
  cols: number;
  rows: number;
  a: number;
};

export type GridCell = {
  col: number;
  row: number;
};

export type CatalogType = {
  elementType: string;
  label: string;
  svg?: string;
  /** Size in level-1 (a/4) cells. */
  widthCells: number;
  heightCells: number;
  color: string;
};

export type CatalogCategory = {
  category: string;
  label: string;
  types: CatalogType[];
};

export type LibraryItem = {
  id: string;
  category: string;
  elementType: string;
  label: string;
  /** Catalog / library size in a/4 cells (converted to finest on place). */
  widthCells: number;
  heightCells: number;
  color: string;
  svg?: string;
  /** Relative finest (a/16) cells for custom polygons. */
  cells?: GridCell[];
  svgPath?: string;
  fromSelection?: boolean;
  defaultFontSize?: number;
};

export type CustomLibraryEntry = LibraryItem & {
  category: string;
};

export type Entity = {
  objectId: string;
  category: string;
  elementType: string;
  /** Origin in finest (a/16) cells. */
  origin: GridCell;
  /** Size in finest (a/16) cells. */
  widthCells: number;
  heightCells: number;
  /** Anticlockwise only: 0 | 90 | 180 | 270. */
  rotation?: 0 | 90 | 180 | 270;
  color?: string;
  label?: string;
  svg?: string;
  /** Relative finest cells for custom polygons. */
  cells?: GridCell[];
  /** Boundary path in finest-cell coords (preview). */
  svgPath?: string;
  fontSize?: number;
};

export type FloorZone = {
  id: string;
  label: string;
  cells: GridCell[];
  color: string;
};

export type UnusableRegion = {
  id: string;
  label: string;
  cells: GridCell[];
  color?: string;
};

export type CellRef = {
  /** Named grid level: -1 | 0 | 1 | 2 */
  level: number;
  col: number;
  row: number;
};

export type EditorTool = 'select' | 'pan' | 'place';

export function floorWorldWidth(floor: FloorConfig): number {
  return floor.cols * floor.a;
}

export function floorWorldHeight(floor: FloorConfig): number {
  return floor.rows * floor.a;
}
