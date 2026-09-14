import React from 'react';
import type { FloorConfig } from '../types/geometry';

interface FloorBoundaryProps {
  floor: FloorConfig;
}

/** Working floor rectangle in world meters (optional visual guide). */
const FloorBoundary: React.FC<FloorBoundaryProps> = ({ floor }) => {
  return (
    <g id="floor-boundary-group">
      <rect
        id="floor-boundary"
        x={0}
        y={0}
        width={floor.width}
        height={floor.height}
        className="floor-fill"
        strokeWidth={0.15}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
};

export default FloorBoundary;
