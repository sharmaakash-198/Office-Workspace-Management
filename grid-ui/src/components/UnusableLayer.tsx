import React, { useMemo } from 'react';
import type { UnusableRegion } from '../types/geometry';
import { FINEST_PER_A } from '../geometry/grid';
import { cellsToMergedRects } from '../geometry/cellMerge';

interface UnusableLayerProps {
  regions: UnusableRegion[];
  a: number;
}

const UnusableLayer: React.FC<UnusableLayerProps> = ({ regions, a }) => {
  const f = a / FINEST_PER_A;

  const prepared = useMemo(
    () =>
      regions.map((region) => {
        const rects = cellsToMergedRects(region.cells, f);
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const r of rects) {
          minX = Math.min(minX, r.x);
          minY = Math.min(minY, r.y);
          maxX = Math.max(maxX, r.x + r.width);
          maxY = Math.max(maxY, r.y + r.height);
        }
        return {
          id: region.id,
          label: region.label,
          rects,
          cx: (minX + maxX) / 2,
          cy: (minY + maxY) / 2,
        };
      }),
    [regions, f],
  );

  return (
    <g id="unusable" pointerEvents="none">
      <defs>
        <pattern
          id="unusable-hatch"
          width={f * 8}
          height={f * 8}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M0,${f * 8} L${f * 8},0`}
            stroke="rgba(71,85,105,0.5)"
            strokeWidth={f * 0.5}
          />
        </pattern>
      </defs>
      {prepared.map((region) => (
        <g key={region.id}>
          {region.rects.map((r, i) => (
            <rect
              key={`${region.id}-${i}`}
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              fill="url(#unusable-hatch)"
              className="unusable-cell"
            />
          ))}
          {region.label && region.rects.length > 0 && (
            <g transform={`translate(${region.cx}, ${region.cy}) scale(1, -1)`}>
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.max(f * 4, a * 0.12)}
                fill="rgba(51,65,85,0.85)"
                className="entity-label"
              >
                {region.label}
              </text>
            </g>
          )}
        </g>
      ))}
    </g>
  );
};

export default UnusableLayer;
