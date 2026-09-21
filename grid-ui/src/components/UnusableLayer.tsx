import React from 'react';
import type { GridCell } from '../types/geometry';
import { finestCellToWorldRect } from '../geometry/grid';

interface UnusableLayerProps {
  cells: GridCell[];
  a: number;
}

const UnusableLayer: React.FC<UnusableLayerProps> = ({ cells, a }) => {
  return (
    <g id="unusable" pointerEvents="none">
      <defs>
        <pattern
          id="unusable-hatch"
          width={a}
          height={a}
          patternUnits="userSpaceOnUse"
          patternTransform={`scale(${1})`}
        >
          <path
            d={`M0,${a} L${a},0`}
            stroke="rgba(71,85,105,0.55)"
            strokeWidth={a * 0.08}
          />
        </pattern>
      </defs>
      {cells.map((c) => {
        const r = finestCellToWorldRect(c.col, c.row, a);
        return (
          <rect
            key={`${c.col},${c.row}`}
            x={r.x}
            y={r.y}
            width={r.width}
            height={r.height}
            fill="url(#unusable-hatch)"
            className="unusable-cell"
          />
        );
      })}
    </g>
  );
};

export default UnusableLayer;
