import React, { useMemo } from 'react';
import type { FloorConfig, SubdivisionMode } from '../types/geometry';
import type { Viewport } from '../types/viewport';
import {
  getFloorBaseUnit,
  getGridLevel,
  getLevelCellSize,
  getMaxLevel,
  getVisibleLinePositions,
  getVisibleWorldBounds,
} from '../geometry/grid';

interface GridProps {
  floor: FloorConfig;
  viewport: Viewport;
  showGrid: boolean;
  svgWidth: number;
  svgHeight: number;
  subdivision: SubdivisionMode;
}

/**
 * First-quadrant infinite paper grid (x≥0, y≥0). Not clipped to floor —
 * continues into the grayed exterior beyond the designated floor.
 */
const Grid: React.FC<GridProps> = ({
  floor,
  viewport,
  showGrid,
  svgWidth,
  svgHeight,
  subdivision,
}) => {
  const baseUnit = getFloorBaseUnit(floor, subdivision);
  const maxLevel = getMaxLevel(subdivision);

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
    const minX = Math.max(0, world.minX);
    const maxX = Math.max(0, world.maxX);
    const minY = Math.max(0, world.minY);
    const maxY = Math.max(0, world.maxY);

    const currentLevel = getGridLevel(viewport.zoom, baseUnit, maxLevel, subdivision);
    const minor = getLevelCellSize(currentLevel, baseUnit, subdivision);
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
  }, [viewport, showGrid, svgWidth, svgHeight, baseUnit, maxLevel, subdivision]);

  if (!showGrid) return null;

  const isMajorLine = (pos: number) => {
    if (majorSize <= 0) return false;
    const rem = ((pos % majorSize) + majorSize) % majorSize;
    return rem < 1e-6 || Math.abs(rem - majorSize) < 1e-6;
  };

  const pad = Math.max(minorSize * 2, 1);
  const y1 = Math.max(0, bounds.minY - pad);
  const y2 = bounds.maxY + pad;
  const x1 = Math.max(0, bounds.minX - pad);
  const x2 = bounds.maxX + pad;

  return (
    <g id="grid" data-level={level} data-cell-size={minorSize}>
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
