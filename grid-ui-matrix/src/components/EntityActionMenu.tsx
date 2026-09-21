import React from 'react';

interface EntityActionMenuProps {
  x: number;
  y: number;
  canScaleUp: boolean;
  canScaleDown: boolean;
  onCopy: () => void;
  onScaleUp: () => void;
  onScaleDown: () => void;
  onRotate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const EntityActionMenu: React.FC<EntityActionMenuProps> = ({
  x,
  y,
  canScaleUp,
  canScaleDown,
  onCopy,
  onScaleUp,
  onScaleDown,
  onRotate,
  onDelete,
  onClose,
}) => {
  return (
    <div
      className="selection-action-menu entity-action-menu"
      style={{ left: x, top: y }}
      role="menu"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button type="button" className="selection-action-btn" onClick={onCopy}>
        Copy
      </button>
      <button
        type="button"
        className="selection-action-btn"
        onClick={onScaleUp}
        disabled={!canScaleUp}
        title="Scale footprint one zoom level coarser"
      >
        Scale up
      </button>
      <button
        type="button"
        className="selection-action-btn"
        onClick={onScaleDown}
        disabled={!canScaleDown}
        title="Scale footprint one zoom level finer"
      >
        Scale down
      </button>
      <button
        type="button"
        className="selection-action-btn"
        onClick={onRotate}
        title="Rotate 90° anticlockwise"
      >
        Rotate
      </button>
      <button type="button" className="selection-action-btn" onClick={onDelete}>
        Delete
      </button>
      <button type="button" className="selection-action-btn ghost" onClick={onClose}>
        Close
      </button>
    </div>
  );
};

export default EntityActionMenu;
