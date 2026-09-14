import React from 'react';
import type { LibraryItem } from '../types/geometry';

interface EntityLibraryProps {
  items: LibraryItem[];
  customItems: LibraryItem[];
  activeId: string | null;
  onSelect: (item: LibraryItem) => void;
  onColorChange: (id: string, color: string) => void;
}

const EntityLibrary: React.FC<EntityLibraryProps> = ({
  items,
  customItems,
  activeId,
  onSelect,
  onColorChange,
}) => {
  const renderItem = (item: LibraryItem) => (
    <div
      key={item.id}
      className={`library-item ${activeId === item.id ? 'active' : ''}`}
    >
      <button
        type="button"
        className="library-item-main"
        onClick={() => onSelect(item)}
      >
        <span className="library-swatch" style={{ background: item.color }} />
            <span className="library-meta">
              <strong>{item.label}</strong>
              <small>
                {item.kind === 'text'
                  ? 'Label only · no matrix code'
                  : `${item.defaultWidth.toFixed(2)}×${item.defaultHeight.toFixed(2)} m · code ${item.code}`}
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
      <p className="panel-hint">Click an item, then click the canvas to place.</p>
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
