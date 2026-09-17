import React from 'react';
import type { LibraryItem } from '../types/floorplan';

/** Payload key used when dragging a library item onto the canvas. */
export const LIBRARY_DND_MIME = 'application/x-floor-library-item';

interface EntityLibraryProps {
  items: LibraryItem[];
  customItems: LibraryItem[];
  activeId: string | null;
  /** Canonical cell size in world units (metres). */
  a: number;
  onSelect: (item: LibraryItem) => void;
  onColorChange: (id: string, color: string) => void;
}

const EntityLibrary: React.FC<EntityLibraryProps> = ({
  items,
  customItems,
  activeId,
  a,
  onSelect,
  onColorChange,
}) => {
  const allItems = [...items, ...customItems];
  const activeItem = allItems.find((i) => i.id === activeId) ?? null;

  const renderItem = (item: LibraryItem) => (
    <div
      key={item.id}
      className={`library-item ${activeId === item.id ? 'active' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(LIBRARY_DND_MIME, item.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
    >
      <button type="button" className="library-item-main" onClick={() => onSelect(item)}>
        <span className="library-swatch" style={{ background: item.color }} />
        <span className="library-meta">
          <strong>{item.label}</strong>
          <small>
            {item.kind === 'text'
              ? 'Label only '
              : `${item.footprint.widthCells}×${item.footprint.heightCells} cells · ${(
                  item.footprint.widthCells * a
                ).toFixed(2)}×${(item.footprint.heightCells * a).toFixed(2)} m · code ${item.code}`}
          </small>
        </span>
      </button>
      <label className="library-color" title="Change colour" onClick={(e) => e.stopPropagation()}>
        <input
          type="color"
          value={item.color}
          onChange={(e) => onColorChange(item.id, e.target.value)}
          aria-label={`Colour for ${item.label}`}
        />
      </label>
    </div>
  );

  return (
    <aside className="side-panel left-panel" aria-label="Entity library">
      <div className="panel-header">Library</div>
      <p className="panel-hint">
        {activeItem
          ? `"${activeItem.label}" armed — click canvas to place.`
          : 'Click an item to arm it, then click the canvas to place.'}
      </p>
      <div className="library-list">{items.map(renderItem)}</div>

      {customItems.length > 0 && (
        <>
          <div className="panel-header" style={{ marginTop: 16 }}>
            Custom shapes
          </div>
          <div className="library-list">{customItems.map(renderItem)}</div>
        </>
      )}
    </aside>
  );
};

export default EntityLibrary;
