import React, { useState } from 'react';

export type CopyDirection = 'right' | 'down' | 'left' | 'up';

interface EntityContextPanelProps {
  /** Screen X of the horizontal centre of the selection bounding box. */
  x: number;
  /** Screen Y anchor — top edge of selection (above) or bottom edge (flipped). */
  y: number;
  /** When true the panel renders below the selection instead of above. */
  flipped: boolean;
  count: number;
  onDuplicate: () => void;
  onMultiDuplicate: (times: number, direction: CopyDirection) => void;
  onRotateCW: () => void;
  onRotateCCW: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const DIR_BUTTONS: { dir: CopyDirection; label: string; title: string }[] = [
  { dir: 'right', label: '→', title: 'Copy to the right' },
  { dir: 'down',  label: '↓', title: 'Copy downward'    },
  { dir: 'left',  label: '←', title: 'Copy to the left' },
  { dir: 'up',    label: '↑', title: 'Copy upward'      },
];

const EntityContextPanel: React.FC<EntityContextPanelProps> = ({
  x,
  y,
  flipped,
  count,
  onDuplicate,
  onMultiDuplicate,
  onRotateCW,
  onRotateCCW,
  onDelete,
  onClose,
}) => {
  const [nCopies, setNCopies] = useState(2);

  return (
    <div
      className={`entity-ctx-panel ${flipped ? 'flipped' : ''}`}
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="ctx-panel-header">
        <span>{count} object{count !== 1 ? 's' : ''}</span>
        <button className="ctx-panel-close" onClick={onClose} title="Deselect (Esc)">
          ×
        </button>
      </div>

      {/* Quick actions row */}
      <div className="ctx-panel-row">
        <button
          className="ctx-panel-btn"
          onClick={onDuplicate}
          title="Duplicate once, offset diagonally (Ctrl+D)"
        >
          📋 ×1
        </button>
        <div className="ctx-panel-spacer" />
        <button
          className="ctx-panel-btn ghost"
          onClick={onRotateCCW}
          title="Rotate 90° counter-clockwise (Shift+R)"
        >
          ⟲
        </button>
        <button
          className="ctx-panel-btn ghost"
          onClick={onRotateCW}
          title="Rotate 90° clockwise (R)"
        >
          ⟳
        </button>
      </div>

      <div className="ctx-panel-divider" />

      {/* Copy ×N row */}
      <div className="ctx-panel-label">Copy N times:</div>
      <div className="ctx-panel-row">
        <span className="ctx-panel-label" style={{ whiteSpace: 'nowrap' }}>×</span>
        <input
          className="ctx-panel-n-input"
          type="number"
          min={2}
          max={50}
          value={nCopies}
          onChange={(e) => setNCopies(Math.max(2, Math.min(50, Number(e.target.value) || 2)))}
          title="Number of copies"
        />
        {DIR_BUTTONS.map(({ dir, label, title }) => (
          <button
            key={dir}
            className="ctx-panel-btn dir"
            onClick={() => onMultiDuplicate(nCopies, dir)}
            title={title}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="ctx-panel-divider" />

      {/* Delete */}
      <div className="ctx-panel-row">
        <button
          className="ctx-panel-btn danger"
          onClick={onDelete}
          title="Delete selected (Del)"
        >
          🗑 Delete
        </button>
      </div>
    </div>
  );
};

export default EntityContextPanel;
