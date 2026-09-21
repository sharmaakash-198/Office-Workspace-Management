import React from 'react';
import type { FloorZone } from '../types/geometry';
import { finestCellToWorldRect } from '../geometry/grid';

interface ZonesLayerProps {
  zones: FloorZone[];
  a: number;
}

const ZonesLayer: React.FC<ZonesLayerProps> = ({ zones, a }) => {
  return (
    <g id="zones" pointerEvents="none">
      {zones.map((zone) => (
        <g key={zone.id} data-zone={zone.label}>
          {zone.cells.map((c) => {
            const r = finestCellToWorldRect(c.col, c.row, a);
            return (
              <rect
                key={`${zone.id}-${c.col}-${c.row}`}
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.height}
                fill={zone.color}
                stroke="none"
              />
            );
          })}
        </g>
      ))}
    </g>
  );
};

export default ZonesLayer;
