import React from 'react';

interface SelectionActionMenuProps {
  x: number;
  y: number;
  cellCount: number;
  hasCellClipboard: boolean;
  onCreateArea: () => void;
  onCreateRoom: () => void;
  onSaveAsShape: () => void;
  onCopyCells: () => void;
  onPasteCells: () => void;
  onClear: () => void;
}

const SelectionActionMenu: React.FC<SelectionActionMenuProps> = ({
  x,
  y,
  cellCount,
  hasCellClipboard,
  onCreateArea,
  onCreateRoom,
  onSaveAsShape,
  onCopyCells,
  onPasteCells,
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
    <button
      type="button"
      className="toolbar-btn"
      onClick={onCopyCells}
      title="Copy entities in selected cells (Ctrl+Shift+C)"
    >
      Copy cells
    </button>
    <button
      type="button"
      className="toolbar-btn"
      onClick={onPasteCells}
      disabled={!hasCellClipboard}
      title="Paste copied entities at the selected cell origin (Ctrl+Shift+V)"
    >
      Paste here
    </button>
    <button type="button" className="toolbar-btn" onClick={onClear}>
      Clear
    </button>
  </div>
);

export default SelectionActionMenu;
