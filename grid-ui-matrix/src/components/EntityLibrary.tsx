import React, { useEffect, useState } from 'react';
import type { CatalogCategory, CustomLibraryEntry, LibraryItem } from '../types/geometry';
import { assetUrl } from '../lib/catalog';
import { groupCustomByCategory } from '../lib/library';

interface EntityLibraryProps {
  categories: CatalogCategory[];
  customItems: CustomLibraryEntry[];
  activeId: string | null;
  onSelect: (item: LibraryItem) => void;
  onDeleteCustom: (id: string) => void;
  onColorChange?: (id: string, color: string) => void;
}

const EntityLibrary: React.FC<EntityLibraryProps> = ({
  categories,
  customItems,
  activeId,
  onSelect,
  onDeleteCustom,
  onColorChange,
}) => {
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!openCategory && categories[0]) {
      setOpenCategory(categories[0].category);
    }
  }, [categories, openCategory]);

  const customGrouped = groupCustomByCategory(customItems);
  const customCategoryNames = Array.from(customGrouped.keys()).sort();

  const toggle = (key: string) => {
    setOpenCategory((prev) => (prev === key ? null : key));
  };

  const renderType = (item: LibraryItem) => {
    const preview = assetUrl(item.svg);
    return (
      <div
        key={item.id}
        className={`library-item ${activeId === item.id ? 'active' : ''}`}
      >
        <button
          type="button"
          className="library-item-main"
          onClick={() => onSelect(item)}
        >
          {preview ? (
            <img src={preview} alt="" className="library-preview" />
          ) : (
            <span className="library-swatch" style={{ background: item.color }} />
          )}
          <span className="library-meta">
            <strong>{item.label}</strong>
            <small>
              {item.widthCells}×{item.heightCells} cells
            </small>
          </span>
        </button>
        {onColorChange && (
          <label className="library-color" title="Change colour" onClick={(e) => e.stopPropagation()}>
            <input
              type="color"
              value={item.color}
              onChange={(e) => onColorChange(item.id, e.target.value)}
              aria-label={`Colour for ${item.label}`}
            />
          </label>
        )}
        {item.fromSelection && (
          <button
            type="button"
            className="library-delete"
            title="Remove from library"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteCustom(item.id);
            }}
          >
            ×
          </button>
        )}
      </div>
    );
  };

  return (
    <aside className="side-panel left-panel" aria-label="Entity library">
      <div className="panel-header">Library</div>
      <p className="panel-hint">Open a category, pick a type, then click the canvas.</p>
      <p className="panel-hint">
        To map irregular floors: select cells, then use <strong>Mark unusable</strong> in the
        floating cell menu.
      </p>

      {categories.map((cat) => {
        const open = openCategory === cat.category;
        return (
          <div key={cat.category} className="library-accordion">
            <button
              type="button"
              className={`library-accordion-head ${open ? 'open' : ''}`}
              onClick={() => toggle(cat.category)}
              aria-expanded={open}
            >
              <span>{cat.label}</span>
              <span className="library-accordion-count">{cat.types.length}</span>
            </button>
            {open && (
              <div className="library-list">
                {cat.types.map((t) =>
                  renderType({
                    id: `${cat.category}:${t.elementType}`,
                    category: cat.category,
                    elementType: t.elementType,
                    label: t.label,
                    widthCells: t.widthCells,
                    heightCells: t.heightCells,
                    color: t.color,
                    svg: t.svg,
                    defaultFontSize: cat.category === 'text' ? 0.6 : undefined,
                  }),
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="library-accordion">
        <button
          type="button"
          className={`library-accordion-head ${openCategory === 'custom' ? 'open' : ''}`}
          onClick={() => toggle('custom')}
          aria-expanded={openCategory === 'custom'}
        >
          <span>Custom</span>
          <span className="library-accordion-count">
            {customGrouped.get('custom')?.length ?? 0}
          </span>
        </button>
        {openCategory === 'custom' && (
          <div className="library-list">
            {(customGrouped.get('custom') ?? []).map(renderType)}
            {(customGrouped.get('custom')?.length ?? 0) === 0 && (
              <p className="panel-hint">Mark cells as a polygon to add shapes here.</p>
            )}
          </div>
        )}
      </div>

      {customCategoryNames
        .filter((name) => name !== 'custom')
        .map((name) => {
          const open = openCategory === name;
          const items = customGrouped.get(name) ?? [];
          return (
            <div key={name} className="library-accordion">
              <button
                type="button"
                className={`library-accordion-head ${open ? 'open' : ''}`}
                onClick={() => toggle(name)}
                aria-expanded={open}
              >
                <span>{name}</span>
                <span className="library-accordion-count">{items.length}</span>
              </button>
              {open && <div className="library-list">{items.map(renderType)}</div>}
            </div>
          );
        })}
    </aside>
  );
};

export default EntityLibrary;
