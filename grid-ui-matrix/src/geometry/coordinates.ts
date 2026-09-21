import type { FloorConfig, Point } from '../types/geometry';
import { floorWorldHeight, floorWorldWidth } from '../types/geometry';
import type { Viewport } from '../types/viewport';

/**
 * Convert a world-coordinate point to screen (SVG) pixel coordinates.
 *
 * World space is a first-quadrant, Y-up plane (like a math graph): increasing
 * world Y moves UP. SVG is Y-down, so this deliberately flips Y.
 */
export function worldToScreen(point: Point, viewport: Viewport): Point {
  return {
    x: point.x * viewport.zoom + viewport.panX,
    y: -point.y * viewport.zoom + viewport.panY,
  };
}

/** Exact inverse of worldToScreen. */
export function screenToWorld(point: Point, viewport: Viewport): Point {
  return {
    x: (point.x - viewport.panX) / viewport.zoom,
    y: (viewport.panY - point.y) / viewport.zoom,
  };
}

/** SVG transform string mapping world space → screen space. */
export function getViewportTransform(viewport: Viewport): string {
  return `translate(${viewport.panX}, ${viewport.panY}) scale(${viewport.zoom}, ${-viewport.zoom})`;
}

/**
 * Zoom by `factor` around a screen-space anchor. The world point under the
 * anchor stays fixed on screen (Figma/CAD-style).
 */
export function zoomAround(
  viewport: Viewport,
  factor: number,
  anchor: Point,
): Viewport {
  const newZoom = viewport.zoom * factor;
  const worldAnchor = screenToWorld(anchor, viewport);
  return {
    zoom: newZoom,
    panX: anchor.x - worldAnchor.x * newZoom,
    panY: anchor.y + worldAnchor.y * newZoom,
  };
}

/** Minimum zoom such that the working floor fills the viewport (with padding). */
export function minZoomToFitFloor(
  floor: FloorConfig,
  svgWidth: number,
  svgHeight: number,
  paddingPx = 48,
): number {
  const usableW = Math.max(1, svgWidth - paddingPx * 2);
  const usableH = Math.max(1, svgHeight - paddingPx * 2);
  const w = floorWorldWidth(floor);
  const h = floorWorldHeight(floor);
  return Math.min(usableW / w, usableH / h);
}

/** Screen-space gutter so origin/axis labels stay readable (bottom-left). */
export const AXIS_GUTTER_PX = 36;

/**
 * Fit floor with world (0,0) inset from the bottom-left by AXIS_GUTTER_PX.
 */
export function fitFloorViewport(
  floor: FloorConfig,
  svgWidth: number,
  svgHeight: number,
  paddingPx = 48,
): Viewport {
  const zoom = minZoomToFitFloor(floor, svgWidth, svgHeight, paddingPx);
  return {
    zoom,
    panX: AXIS_GUTTER_PX,
    panY: svgHeight - AXIS_GUTTER_PX,
  };
}

/**
 * Close-up initial camera with origin inset from the bottom-left.
 */
export function initialCloseUpViewport(
  floor: FloorConfig,
  svgWidth: number,
  svgHeight: number,
  targetCellPx = 48,
): Viewport {
  const zoom = Math.max(targetCellPx / floor.a, minZoomToFitFloor(floor, svgWidth, svgHeight));
  return {
    zoom,
    panX: AXIS_GUTTER_PX,
    panY: svgHeight - AXIS_GUTTER_PX,
  };
}

/** Clamp zoom to [minZoom, maxZoom] while preserving the world point under anchor. */
export function clampZoomAround(
  viewport: Viewport,
  desiredZoom: number,
  anchor: Point,
  minZoom: number,
  maxZoom: number,
): Viewport {
  const clamped = Math.min(maxZoom, Math.max(minZoom, desiredZoom));
  if (clamped === viewport.zoom) return viewport;
  const factor = clamped / viewport.zoom;
  return zoomAround(viewport, factor, anchor);
}

/**
 * Clamp pan so the origin cannot move past the bottom-left gutter.
 * You may pan into +X / +Y; you cannot reveal past the gutter into empty void.
 *
 *   panX ≤ AXIS_GUTTER_PX
 *   panY ≥ svgHeight - AXIS_GUTTER_PX
 */
export function clampViewportToFirstQuadrant(
  viewport: Viewport,
  svgWidth: number,
  svgHeight: number,
): Viewport {
  void svgWidth;
  return {
    zoom: viewport.zoom,
    panX: Math.min(AXIS_GUTTER_PX, viewport.panX),
    panY: Math.max(svgHeight - AXIS_GUTTER_PX, viewport.panY),
  };
}
