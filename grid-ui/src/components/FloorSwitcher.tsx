import React, { useState, useRef, useCallback, useEffect } from 'react';
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

/* ── small context-menu shown on right-click ── */
interface CtxMenu {
  floorId: string;
  x: number;
  y: number;
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
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  /* ── rename helpers ── */
  const commitRename = useCallback(() => {
    if (editingId && draftName.trim()) onRename(editingId, draftName.trim());
    setEditingId(null);
  }, [editingId, draftName, onRename]);

  const startRename = useCallback(
    (id: string, currentName: string) => {
      onSelect(id);
      setEditingId(id);
      setDraftName(currentName);
    },
    [onSelect],
  );

  /* ── close context menu on outside click / Esc ── */
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [ctxMenu]);

  /* ── drag-and-drop reorder ── */
  const handleDragStart = (e: React.DragEvent, floorId: string) => {
    setDragId(floorId);
    e.dataTransfer.effectAllowed = 'move';
    // Make the drag ghost semi-transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '';
    }
    if (dragId && dragOverId && dragId !== dragOverId) {
      const fromIdx = floors.findIndex((f) => f.id === dragId);
      const toIdx = floors.findIndex((f) => f.id === dragOverId);
      if (fromIdx !== -1 && toIdx !== -1) {
        // Select the dragged floor, then move it in the right direction
        onSelect(dragId);
        const diff = toIdx - fromIdx;
        const direction = diff > 0 ? 1 : -1;
        const steps = Math.abs(diff);
        for (let i = 0; i < steps; i++) {
          onMove(direction as -1 | 1);
        }
      }
    }
    setDragId(null);
    setDragOverId(null);
  };

  const handleDragOver = (e: React.DragEvent, floorId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(floorId);
  };

  /* ── context-menu actions ── */
  const ctxAction = (action: () => void) => {
    setCtxMenu(null);
    action();
  };

  const activeIdx = floors.findIndex((f) => f.id === activeFloorId);

  return (
    <div className="browser-tab-bar" aria-label="Floors">
      {/* scrollable tab strip */}
      <div className="browser-tab-strip" ref={tabsRef}>
        {floors.map((floor) => {
          const active = floor.id === activeFloorId;
          const objectCount = floor.entities.length + floor.walls.length;
          const isEditing = editingId === floor.id;
          const isDragOver = dragOverId === floor.id && dragId !== floor.id;

          return (
            <div
              key={floor.id}
              className={[
                'browser-tab',
                active && 'active',
                isDragOver && 'drag-over',
              ]
                .filter(Boolean)
                .join(' ')}
              draggable={!isEditing}
              onDragStart={(e) => handleDragStart(e, floor.id)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, floor.id)}
              onClick={() => {
                if (!isEditing) onSelect(floor.id);
              }}
              onDoubleClick={() => startRename(floor.id, floor.name)}
              onContextMenu={(e) => {
                e.preventDefault();
                onSelect(floor.id);
                setCtxMenu({ floorId: floor.id, x: e.clientX, y: e.clientY });
              }}
              title={
                isEditing
                  ? undefined
                  : `${floor.name} — ${objectCount} object(s)\nDouble-click to rename · Right-click for options`
              }
            >
              {isEditing ? (
                <input
                  className="browser-tab-rename-input"
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <span className="browser-tab-label">{floor.name}</span>
                  {objectCount > 0 && (
                    <span className="browser-tab-badge">{objectCount}</span>
                  )}
                </>
              )}

              {/* close button — only if more than 1 floor */}
              {!isEditing && floors.length > 1 && (
                <button
                  type="button"
                  className="browser-tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(floor.id);
                    // Small delay to let selection propagate
                    requestAnimationFrame(() => onRemove());
                  }}
                  title="Close tab"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}

        {/* New-tab button */}
        <button
          type="button"
          className="browser-tab-add"
          onClick={onAdd}
          title="New floor (tab)"
        >
          +
        </button>
      </div>

      {/* ── Right-click context menu ── */}
      {ctxMenu && (
        <div
          className="browser-tab-ctx"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="browser-tab-ctx-item"
            onClick={() => {
              const fl = floors.find((f) => f.id === ctxMenu.floorId);
              if (fl) ctxAction(() => startRename(fl.id, fl.name));
            }}
          >
            ✏️ Rename
          </button>
          <button
            className="browser-tab-ctx-item"
            onClick={() => ctxAction(onDuplicate)}
          >
            📄 Duplicate
          </button>
          <div className="browser-tab-ctx-divider" />
          <button
            className="browser-tab-ctx-item"
            disabled={activeIdx <= 0}
            onClick={() => ctxAction(() => onMove(-1))}
          >
            ← Move left
          </button>
          <button
            className="browser-tab-ctx-item"
            disabled={activeIdx >= floors.length - 1}
            onClick={() => ctxAction(() => onMove(1))}
          >
            → Move right
          </button>
          <div className="browser-tab-ctx-divider" />
          <button
            className="browser-tab-ctx-item danger"
            disabled={floors.length <= 1}
            onClick={() => ctxAction(onRemove)}
          >
            🗑 Close tab
          </button>
        </div>
      )}
    </div>
  );
};

export default FloorSwitcher;
