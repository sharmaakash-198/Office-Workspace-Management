import React, { useState } from 'react';
import type { Floor } from '../types/floorplan';

interface FloorSwitcherProps {
  floors: Floor[];
  activeFloorId: string;
  onSelect: (floorId: string) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onRename: (floorId: string, name: string) => void;
  onMove: (direction: -1 | 1) => void;
}

const FloorSwitcher: React.FC<FloorSwitcherProps> = ({
  floors,
  activeFloorId,
  onSelect,
  onAdd,
  onDuplicate,
  onRemove,
  onRename,
  onMove,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const commitRename = () => {
    if (editingId && draftName.trim()) onRename(editingId, draftName.trim());
    setEditingId(null);
  };

  return (
    <div className="floor-switcher" aria-label="Floors">
      <div className="floor-tabs">
        {floors.map((floor) => {
          const active = floor.id === activeFloorId;
          const objectCount = floor.entities.length + floor.walls.length;
          if (editingId === floor.id) {
            return (
              <input
                key={floor.id}
                className="floor-tab-input"
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setEditingId(null);
                }}
              />
            );
          }
          return (
            <button
              key={floor.id}
              type="button"
              className={`floor-tab ${active ? 'active' : ''}`}
              onClick={() => onSelect(floor.id)}
              onDoubleClick={() => {
                setEditingId(floor.id);
                setDraftName(floor.name);
              }}
              title={`${floor.name} — ${objectCount} object(s). Double-click to rename.`}
            >
              {floor.name}
              <small>{objectCount}</small>
            </button>
          );
        })}
      </div>

      <div className="floor-actions">
        <button type="button" className="toolbar-btn icon-btn" onClick={onAdd} title="Add floor">
          +
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={onDuplicate}
          title="Duplicate this floor"
        >
          Copy
        </button>
        <button
          type="button"
          className="toolbar-btn icon-btn"
          onClick={() => onMove(-1)}
          title="Move floor down the list"
        >
          ↑
        </button>
        <button
          type="button"
          className="toolbar-btn icon-btn"
          onClick={() => onMove(1)}
          title="Move floor up the list"
        >
          ↓
        </button>
        <button
          type="button"
          className="toolbar-btn icon-btn"
          onClick={onRemove}
          disabled={floors.length <= 1}
          title={floors.length <= 1 ? 'A plan needs at least one floor' : 'Delete this floor'}
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default FloorSwitcher;
