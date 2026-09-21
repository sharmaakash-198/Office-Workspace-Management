import React, { useMemo } from 'react';
import type { FloorConfig } from '../types/geometry';
import { floorWorldHeight, floorWorldWidth } from '../types/geometry';
import type { Viewport } from '../types/viewport';
import { getVisibleWorldBounds } from '../geometry/grid';

interface OutsideFloorOverlayProps {
  floor: FloorConfig;
  viewport: Viewport;
  svgWidth: number;
  svgHeight: number;
}

/**
 * Grays out first-quadrant space outside the designated floor
 * (still navigable; not placeable).
 */
const OutsideFloorOverlay: React.FC<OutsideFloorOverlayProps> = ({
  floor,
  viewport,
  svgWidth,
  svgHeight,
}) => {
  const floorW = floorWorldWidth(floor);
  const floorH = floorWorldHeight(floor);

  const bands = useMemo(() => {
    const world = getVisibleWorldBounds(viewport, svgWidth, svgHeight);
    const maxX = Math.max(0, world.maxX);
    const maxY = Math.max(0, world.maxY);
    const minX = Math.max(0, world.minX);
    const minY = Math.max(0, world.minY);
    const rects: Array<{ x: number; y: number; w: number; h: number }> = [];

    // Right of floor
    if (maxX > floorW) {
      rects.push({
        x: floorW,
        y: minY,
        w: maxX - floorW,
        h: Math.max(0, maxY - minY),
      });
    }
    // Above floor (only over the floor's X span to avoid double-covering corner)
    if (maxY > floorH) {
      rects.push({
        x: minX,
        y: floorH,
        w: Math.max(0, Math.min(maxX, floorW) - minX),
        h: maxY - floorH,
      });
    }
    return rects.filter((r) => r.w > 0 && r.h > 0);
  }, [viewport, svgWidth, svgHeight, floorW, floorH]);

  return (
    <g id="outside-floor" pointerEvents="none">
      {bands.map((r, i) => (
        <rect
          key={i}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          className="outside-floor-fill"
        />
      ))}
    </g>
  );
};

export default OutsideFloorOverlay;
