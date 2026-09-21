/**
 * Continuous-space primitives used by the camera, the grid renderer and SVG
 * output. The logical floor-plan model lives in `./floorplan` and is always
 * expressed in integer cells; these types exist only on the presentation side
 * of that boundary.
 */

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

/** World-unit view of the workspace, derived from the document. */
export type FloorConfig = {
  width: number;
  height: number;
  a: number;
};

/** A cell at a specific rendering level, used for grid display and snapping. */
export type CellRef = {
  level: number;
  col: number;
  row: number;
};
