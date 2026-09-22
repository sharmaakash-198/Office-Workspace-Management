import React, { useMemo } from 'react';
import type { FloorConfig } from '../types/geometry';
import type { Viewport } from '../types/viewport';
import {
  getGridLevel,
  levelCellSize,
  getVisibleLinePositions,
  getVisibleWorldBounds,
  type NamedGridLevel,
  NAMED_LEVELS,
} from '../geometry/grid';

interface GridProps {
  floor: FloorConfig;
  viewport: Viewport;
  showGrid: boolean;
  svgWidth: number;
  svgHeight: number;
}

const FULL_PX = 24;

type Tier = {
  level: NamedGridLevel;
  v: number[];
  h: number[];
  opacity: number;
  kind: 'coarse' | 'major' | 'minor' | 'fine';
};

function kindFor(level: NamedGridLevel): Tier['kind'] {
  if (level <= -1) return 'coarse';
  if (level === 0) return 'major';
  if (level === 1) return 'minor';
  return 'fine';
}

/**
 * Multi-tier grid with fading next-finer lines so cells visibly split
 * while zooming: 2a → a → a/4 → a/16.
 */
const Grid: React.FC<GridProps> = ({
  floor,
  viewport,
  showGrid,
  svgWidth,
  svgHeight,
}) => {
  const a = floor.a;

  const { tiers, bounds, level } = useMemo(() => {
    if (!showGrid) {
      return {
        tiers: [] as Tier[],
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
        level: 0 as NamedGridLevel,
      };
    }

    const world = getVisibleWorldBounds(viewport, svgWidth, svgHeight);
    const minX = Math.max(0, world.minX);
    const maxX = Math.max(0, world.maxX);
    const minY = Math.max(0, world.minY);
    const maxY = Math.max(0, world.maxY);
    const current = getGridLevel(viewport.zoom, a);

    const tiers: Tier[] = [];
    for (const lvl of NAMED_LEVELS) {
      if (lvl > current + 1) break;
      const px = levelCellSize(lvl, a) * viewport.zoom;
      let opacity = 1;
      if (lvl > current) {
        // Next-finer: fade in early so subdivisions are visible before "snapping"
        opacity = Math.min(1, Math.max(0.28, px / FULL_PX));
      } else if (lvl === current) {
        opacity = 1;
      } else {
        opacity = 1;
      }
      if (opacity < 0.05) continue;
      const size = levelCellSize(lvl, a);
      tiers.push({
        level: lvl,
        v: getVisibleLinePositions(minX, maxX, size),
        h: getVisibleLinePositions(minY, maxY, size),
        opacity,
        kind: kindFor(lvl),
      });
    }

    return {
      tiers,
      bounds: { minX, maxX, minY, maxY },
      level: current,
    };
  }, [viewport, showGrid, svgWidth, svgHeight, a]);

  if (!showGrid) return null;

  const pad = Math.max(levelCellSize(level, a) * 2, 1);
  const y1 = Math.max(0, bounds.minY - pad);
  const y2 = bounds.maxY + pad;
  const x1 = Math.max(0, bounds.minX - pad);
  const x2 = bounds.maxX + pad;

  return (
    <g id="grid" data-level={level}>
      {tiers.map((tier) => (
        <g
          key={`tier-${tier.level}`}
          opacity={tier.opacity}
          style={{ transition: 'opacity 120ms linear' }}
        >
          {tier.v.map((x) => (
            <line
              key={`v-${tier.level}-${x}`}
              x1={x}
              y1={y1}
              x2={x}
              y2={y2}
              className={`grid-line ${tier.kind}`}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {tier.h.map((y) => (
            <line
              key={`h-${tier.level}-${y}`}
              x1={x1}
              y1={y}
              x2={x2}
              y2={y}
              className={`grid-line ${tier.kind}`}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      ))}

      <circle cx={0} cy={0} r={3 / viewport.zoom} className="grid-origin" opacity={0.8} />
    </g>
  );
};

export default Grid;
