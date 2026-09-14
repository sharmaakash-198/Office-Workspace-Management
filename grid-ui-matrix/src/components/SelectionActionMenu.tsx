import React from 'react';

interface SelectionActionMenuProps {
  x: number;
  y: number;
  cellCount: number;
  onMarkPolygon: () => void;
  onClear: () => void;
}

/** Floating menu near a multi-cell selection. */
const SelectionActionMenu: React.FC<SelectionActionMenuProps> = ({
  x,
  y,
  cellCount,
  onMarkPolygon,
  onClear,
}) => {
  return (
    <div
      className="selection-action-menu"
      style={{ left: x, top: y }}
      role="menu"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <span className="selection-action-count">{cellCount} cells</span>
      <button type="button" className="selection-action-btn" onClick={onMarkPolygon}>
        Mark as polygon
      </button>
      <button type="button" className="selection-action-btn ghost" onClick={onClear}>
        Clear
      </button>
    </div>
  );
};

export default SelectionActionMenu;
