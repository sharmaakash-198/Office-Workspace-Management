import React from 'react';

interface SelectionActionMenuProps {
  x: number;
  y: number;
  cellCount: number;
  canPaste: boolean;
  onMarkPolygon: () => void;
  onPaste: () => void;
  onCopyZone: () => void;
  onMarkZone: () => void;
  onMarkUnusable: () => void;
  onClearUnusable: () => void;
  onClear: () => void;
}

/** Floating menu near a multi-cell selection. */
const SelectionActionMenu: React.FC<SelectionActionMenuProps> = ({
  x,
  y,
  cellCount,
  canPaste,
  onMarkPolygon,
  onPaste,
  onCopyZone,
  onMarkZone,
  onMarkUnusable,
  onClearUnusable,
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
      <button type="button" className="selection-action-btn" onClick={onMarkUnusable}>
        Mark unusable
      </button>
      <button type="button" className="selection-action-btn" onClick={onClearUnusable}>
        Clear unusable
      </button>
      <button
        type="button"
        className="selection-action-btn"
        onClick={onPaste}
        disabled={!canPaste}
      >
        Paste
      </button>
      <button type="button" className="selection-action-btn" onClick={onCopyZone}>
        Copy zone
      </button>
      <button type="button" className="selection-action-btn" onClick={onMarkZone}>
        Mark zone
      </button>
      <button type="button" className="selection-action-btn ghost" onClick={onClear}>
        Clear
      </button>
    </div>
  );
};

export default SelectionActionMenu;
