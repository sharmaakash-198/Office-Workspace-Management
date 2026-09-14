import type { FloorConfig, Point } from '../types/geometry';
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
  return Math.min(usableW / floor.width, usableH / floor.height);
}

/** Viewport that fits + centers the entire working floor (max zoom-out target). */
export function fitFloorViewport(
  floor: FloorConfig,
  svgWidth: number,
  svgHeight: number,
  paddingPx = 48,
): Viewport {
  const zoom = minZoomToFitFloor(floor, svgWidth, svgHeight, paddingPx);
  const panX = (svgWidth - floor.width * zoom) / 2;
  const panY = (svgHeight + floor.height * zoom) / 2;
  return { zoom, panX, panY };
}

/**
 * Close-up initial camera: fine cells fill the screen (FigJam feel),
 * centered near the origin of the working floor.
 */
export function initialCloseUpViewport(
  floor: FloorConfig,
  svgWidth: number,
  svgHeight: number,
  targetCellPx = 48,
): Viewport {
  const zoom = Math.max(targetCellPx / floor.a, minZoomToFitFloor(floor, svgWidth, svgHeight));
  // Show roughly the lower-left portion of the floor, like FigJam opening close-up.
  const worldCenterX = Math.min(floor.width * 0.25, (svgWidth / zoom) * 0.45);
  const worldCenterY = Math.min(floor.height * 0.25, (svgHeight / zoom) * 0.45);
  return {
    zoom,
    panX: svgWidth / 2 - worldCenterX * zoom,
    panY: svgHeight / 2 + worldCenterY * zoom,
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
