import React from 'react';

interface SelectionActionMenuProps {
  x: number;
  y: number;
  cellCount: number;
  onCreateArea: () => void;
  onCreateRoom: () => void;
  onSaveAsShape: () => void;
  onClear: () => void;
}

const SelectionActionMenu: React.FC<SelectionActionMenuProps> = ({
  x,
  y,
  cellCount,
  onCreateArea,
  onCreateRoom,
  onSaveAsShape,
  onClear,
}) => (
  <div
    className="selection-menu"
    style={{ left: x, top: y }}
    onMouseDown={(e) => e.stopPropagation()}
  >
    <span className="selection-count">{cellCount} cell(s)</span>
    <button type="button" className="toolbar-btn" onClick={onCreateArea}>
      Make area
    </button>
    <button type="button" className="toolbar-btn" onClick={onCreateRoom}>
      Make room
    </button>
    <button
      type="button"
      className="toolbar-btn"
      onClick={onSaveAsShape}
      title="Add this footprint to the library so it can be reused"
    >
      Save as shape
    </button>
    <button type="button" className="toolbar-btn" onClick={onClear}>
      Clear
    </button>
  </div>
);

export default SelectionActionMenu;
