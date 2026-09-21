import React, { useMemo } from 'react';
import type { FloorConfig } from '../types/geometry';
import type { Viewport } from '../types/viewport';
import {
  getFloorBaseUnit,
  getGridLevel,
  getLevelCellSize,
  getVisibleLinePositions,
  getVisibleWorldBounds,
} from '../geometry/grid';

interface GridProps {
  floor: FloorConfig;
  viewport: Viewport;
  showGrid: boolean;
  svgWidth: number;
  svgHeight: number;
  /** When false, draw infinite paper lines (not clipped to floor). */
  clipToFloor?: boolean;
}

/**
 * Hierarchical grid. Lines cover the visible viewport (FigJam-style infinite
 * paper). Major = Level 0 (= a × 16), minor = current level (down to `a`).
 */
const Grid: React.FC<GridProps> = ({
  floor,
  viewport,
  showGrid,
  svgWidth,
  svgHeight,
  clipToFloor = false,
}) => {
  const baseUnit = getFloorBaseUnit(floor);

  const { lines, level, majorSize, minorSize, bounds } = useMemo(() => {
    if (!showGrid) {
      return {
        lines: { h: [] as number[], v: [] as number[] },
        level: 0,
        majorSize: 0,
        minorSize: 0,
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      };
    }

    const world = getVisibleWorldBounds(viewport, svgWidth, svgHeight);
    const minX = clipToFloor ? Math.max(0, world.minX) : world.minX;
    const maxX = clipToFloor ? Math.min(floor.width, world.maxX) : world.maxX;
    const minY = clipToFloor ? Math.max(0, world.minY) : world.minY;
    const maxY = clipToFloor ? Math.min(floor.height, world.maxY) : world.maxY;

    const currentLevel = getGridLevel(viewport.zoom, baseUnit);
    const minor = getLevelCellSize(currentLevel, baseUnit);
    const major = baseUnit;

    return {
      lines: {
        v: getVisibleLinePositions(minX, maxX, minor),
        h: getVisibleLinePositions(minY, maxY, minor),
      },
      level: currentLevel,
      majorSize: major,
      minorSize: minor,
      bounds: { minX, maxX, minY, maxY },
    };
  }, [viewport, floor, showGrid, svgWidth, svgHeight, clipToFloor, baseUnit]);

  if (!showGrid) return null;

  const isMajorLine = (pos: number) => {
    if (majorSize <= 0) return false;
    const rem = ((pos % majorSize) + majorSize) % majorSize;
    return rem < 1e-6 || Math.abs(rem - majorSize) < 1e-6;
  };

  const pad = minorSize * 2;
  const x1 = bounds.minX - pad;
  const x2 = bounds.maxX + pad;
  const y1 = bounds.minY - pad;
  const y2 = bounds.maxY + pad;

  return (
    <g
      id="grid"
      data-level={level}
      data-cell-size={minorSize}
      clipPath={clipToFloor ? 'url(#floor-clip)' : undefined}
    >
      {lines.v.map((x) => (
        <line
          key={`v-${x}`}
          x1={x}
          y1={y1}
          x2={x}
          y2={y2}
          className={isMajorLine(x) ? 'grid-line major' : 'grid-line minor'}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {lines.h.map((y) => (
        <line
          key={`h-${y}`}
          x1={x1}
          y1={y}
          x2={x2}
          y2={y}
          className={isMajorLine(y) ? 'grid-line major' : 'grid-line minor'}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      <circle cx={0} cy={0} r={3 / viewport.zoom} className="grid-origin" opacity={0.8} />
    </g>
  );
};

export default Grid;
