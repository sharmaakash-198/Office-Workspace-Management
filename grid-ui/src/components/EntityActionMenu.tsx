import React from 'react';

interface EntityActionMenuProps {
  x: number;
  y: number;
  onCopy: () => void;
  onRotate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const EntityActionMenu: React.FC<EntityActionMenuProps> = ({
  x,
  y,
  onCopy,
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
