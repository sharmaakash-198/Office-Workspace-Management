import React from 'react';
import type { GridCell } from '../types/floorplan';

interface CellHighlightProps {
  hoveredCell: GridCell | null;
  selectedCells: GridCell[];
  /** Canonical cell size in world units. */
  a: number;
  /** Size of the hover brush in cells, matching the active snap step. */
  hoverSpan?: number;
}

const CellHighlight: React.FC<CellHighlightProps> = ({
  hoveredCell,
  selectedCells,
  a,
  hoverSpan = 1,
}) => {
  const selectedKeys = new Set(selectedCells.map((c) => `${c.x},${c.y}`));

  return (
    <g id="cell-highlight" pointerEvents="none">
      {hoveredCell && !selectedKeys.has(`${hoveredCell.x},${hoveredCell.y}`) && (
        <rect
          x={hoveredCell.x * a}
          y={hoveredCell.y * a}
          width={a * hoverSpan}
          height={a * hoverSpan}
          className="cell-hover"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}

      {selectedCells.map((cell) => (
        <rect
          key={`${cell.x},${cell.y}`}
          x={cell.x * a}
          y={cell.y * a}
          width={a}
          height={a}
          className="cell-selected"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
};

export default CellHighlight;
