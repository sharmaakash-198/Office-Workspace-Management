import React from 'react';
import type { CellRef } from '../types/geometry';
import { cellToWorldRect } from '../geometry/grid';

interface CellHighlightProps {
  hoveredCell: CellRef | null;
  selectedCells: CellRef[];
  a: number;
}

const CellHighlight: React.FC<CellHighlightProps> = ({
  hoveredCell,
  selectedCells,
  a,
}) => {
  const selectedKeys = new Set(
    selectedCells.map((c) => `${c.level}:${c.col}:${c.row}`),
  );

  return (
    <g id="cell-highlight" pointerEvents="none">
      {hoveredCell &&
        hoveredCell.col >= 0 &&
        hoveredCell.row >= 0 &&
        !selectedKeys.has(`${hoveredCell.level}:${hoveredCell.col}:${hoveredCell.row}`) &&
        (() => {
          const r = cellToWorldRect(hoveredCell, a);
          return (
            <rect
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              className="cell-hover"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          );
        })()}

      {selectedCells.map((cell) => {
        const r = cellToWorldRect(cell, a);
        return (
          <rect
            key={`${cell.level}:${cell.col}:${cell.row}`}
            x={r.x}
            y={r.y}
            width={r.width}
            height={r.height}
            className="cell-selected"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </g>
  );
};

export default CellHighlight;
