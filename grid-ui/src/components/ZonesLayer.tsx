import React, { useMemo } from 'react';
import type { FloorZone } from '../types/geometry';
import { FINEST_PER_A } from '../geometry/grid';
import { cellsToMergedRects } from '../geometry/cellMerge';

interface ZonesLayerProps {
  zones: FloorZone[];
  a: number;
}

const ZonesLayer: React.FC<ZonesLayerProps> = ({ zones, a }) => {
  const f = a / FINEST_PER_A;

  const prepared = useMemo(
    () =>
      zones.map((zone) => ({
        id: zone.id,
        label: zone.label,
        color: zone.color,
        rects: cellsToMergedRects(zone.cells, f),
      })),
    [zones, f],
  );

  return (
    <g id="zones" pointerEvents="none">
      {prepared.map((zone) => (
        <g key={zone.id} data-zone={zone.label}>
          {zone.rects.map((r, i) => (
            <rect
              key={`${zone.id}-${i}`}
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              fill={zone.color}
              stroke="none"
            />
          ))}
        </g>
      ))}
    </g>
  );
};

export default ZonesLayer;
