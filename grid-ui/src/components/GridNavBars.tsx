import React, { useCallback, useMemo, useRef } from 'react';
import type { FloorConfig } from '../types/geometry';
import { floorWorldHeight, floorWorldWidth } from '../types/geometry';
import type { Viewport } from '../types/viewport';
import { clampViewportToFirstQuadrant } from '../geometry/coordinates';
import { getVisibleWorldBounds } from '../geometry/grid';

interface GridNavBarsProps {
  floor: FloorConfig;
  viewport: Viewport;
  svgWidth: number;
  svgHeight: number;
  onViewport: (next: Viewport) => void;
}

/**
 * Scroll-like pan bars when zoomed in past fitting the floor.
 * Bottom = X, right = Y.
 */
const GridNavBars: React.FC<GridNavBarsProps> = ({
  floor,
  viewport,
  svgWidth,
  svgHeight,
  onViewport,
}) => {
  const fw = floorWorldWidth(floor);
  const fh = floorWorldHeight(floor);
  const dragRef = useRef<'x' | 'y' | null>(null);

  const bounds = useMemo(
    () => getVisibleWorldBounds(viewport, svgWidth, svgHeight),
    [viewport, svgWidth, svgHeight],
  );

  const viewW = Math.max(1e-6, bounds.maxX - bounds.minX);
  const viewH = Math.max(1e-6, bounds.maxY - bounds.minY);
  const show =
    viewW < fw * 0.98 || viewH < fh * 0.98 || viewport.zoom > (svgWidth / Math.max(fw, 1)) * 1.05;

  const thumbX = {
    left: Math.max(0, Math.min(1, bounds.minX / fw)) * 100,
    width: Math.max(4, Math.min(100, (viewW / fw) * 100)),
  };
  const thumbY = {
    // SVG Y-up: maxY is top of view; flip for bar (top = high world Y)
    top: Math.max(0, Math.min(1, 1 - bounds.maxY / fh)) * 100,
    height: Math.max(4, Math.min(100, (viewH / fh) * 100)),
  };

  const setPanFromX = useCallback(
    (clientX: number, track: HTMLElement) => {
      const rect = track.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const worldCenterX = t * fw;
      const half = viewW / 2;
      const targetMinX = Math.max(0, worldCenterX - half);
      const panX = -targetMinX * viewport.zoom;
      onViewport(
        clampViewportToFirstQuadrant(
          { ...viewport, panX },
          svgWidth,
          svgHeight,
        ),
      );
    },
    [fw, viewW, viewport, svgWidth, svgHeight, onViewport],
  );

  const setPanFromY = useCallback(
    (clientY: number, track: HTMLElement) => {
      const rect = track.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      // t=0 → top of floor (high Y), t=1 → bottom (Y=0)
      const worldCenterY = (1 - t) * fh;
      const half = viewH / 2;
      const targetMinY = Math.max(0, worldCenterY - half);
      const panY = svgHeight + targetMinY * viewport.zoom;
      onViewport(
        clampViewportToFirstQuadrant(
          { ...viewport, panY },
          svgWidth,
          svgHeight,
        ),
      );
    },
    [fh, viewH, viewport, svgWidth, svgHeight, onViewport],
  );

  if (!show) return null;

  return (
    <>
      <div
        className="grid-nav-x"
        onMouseDown={(e) => {
          dragRef.current = 'x';
          setPanFromX(e.clientX, e.currentTarget);
          const track = e.currentTarget;
          const move = (ev: MouseEvent) => setPanFromX(ev.clientX, track);
          const up = () => {
            dragRef.current = null;
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
          };
          window.addEventListener('mousemove', move);
          window.addEventListener('mouseup', up);
        }}
      >
        <div
          className="grid-nav-thumb"
          style={{ left: `${thumbX.left}%`, width: `${thumbX.width}%` }}
        />
      </div>
      <div
        className="grid-nav-y"
        onMouseDown={(e) => {
          dragRef.current = 'y';
          setPanFromY(e.clientY, e.currentTarget);
          const track = e.currentTarget;
          const move = (ev: MouseEvent) => setPanFromY(ev.clientY, track);
          const up = () => {
            dragRef.current = null;
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
          };
          window.addEventListener('mousemove', move);
          window.addEventListener('mouseup', up);
        }}
      >
        <div
          className="grid-nav-thumb"
          style={{ top: `${thumbY.top}%`, height: `${thumbY.height}%` }}
        />
      </div>
    </>
  );
};

export default GridNavBars;
