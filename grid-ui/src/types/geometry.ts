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

/** Working floor in finest-cell counts; world size = cols*a × rows*a. */
export type FloorConfig = {
  cols: number;
  rows: number;
  a: number;
};

export type SubdivisionMode = 2 | 4;

export type GridCell = {
  col: number;
  row: number;
};

export type CatalogType = {
  elementType: string;
  label: string;
  svg?: string;
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
  widthCells: number;
  heightCells: number;
  color: string;
  svg?: string;
  /** Relative finest cells for custom polygons. */
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
  origin: GridCell;
  widthCells: number;
  heightCells: number;
  /** 0 = finest placement; each +1 multiplies size by subdivision. */
  scaleLevel: number;
  /** Anticlockwise only: 0 | 90 | 180 | 270. */
  rotation?: 0 | 90 | 180 | 270;
  color?: string;
  label?: string;
  svg?: string;
  /** Relative finest cells for custom polygons. */
  cells?: GridCell[];
  /** Boundary path in cell-unit coords (pretty-ui). */
  svgPath?: string;
  fontSize?: number;
};

export type FloorZone = {
  id: string;
  label: string;
  cells: GridCell[];
  color: string;
};

export type CellRef = {
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
