import React from 'react';
import type { Entity, FloorConfig, FloorZone, UnusableRegion } from '../types/geometry';

interface PropertiesPanelProps {
  floor: FloorConfig;
  onFloorChange: (next: FloorConfig) => void;
  selected: Entity[];
  onUpdateSelected: (patch: Partial<Entity>) => void;
  zones: FloorZone[];
  onDeleteZone: (id: string) => void;
  unusableRegions: UnusableRegion[];
  onLabelUnusableRegion: (id: string) => void;
  onDeleteUnusableRegion: (id: string) => void;
  onExportJson: () => void;
  onCopyJson: () => void;
  onImportJson: (file: File) => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  floor,
  onFloorChange,
  selected,
  onUpdateSelected,
  zones,
  onDeleteZone,
  unusableRegions,
  onLabelUnusableRegion,
  onDeleteUnusableRegion,
  onExportJson,
  onCopyJson,
  onImportJson,
}) => {
  const single = selected.length === 1 ? selected[0] : null;

  return (
    <aside className="side-panel right-panel" aria-label="Properties">
      <div className="panel-header">Properties</div>

      <section className="prop-section">
        <h3>Grid</h3>
        <label className="prop-field">
          <span>Unit a</span>
          <input
            type="number"
            min={0.05}
            step={0.05}
            value={floor.a}
            onChange={(e) =>
              onFloorChange({ ...floor, a: Math.max(0.05, Number(e.target.value) || 0.25) })
            }
          />
        </label>
        <label className="prop-field">
          <span>Floor cols (×a)</span>
          <input
            type="number"
            min={4}
            step={1}
            value={floor.cols}
            onChange={(e) =>
              onFloorChange({ ...floor, cols: Math.max(4, Number(e.target.value) || 64) })
            }
          />
        </label>
        <label className="prop-field">
          <span>Floor rows (×a)</span>
          <input
            type="number"
            min={4}
            step={1}
            value={floor.rows}
            onChange={(e) =>
              onFloorChange({ ...floor, rows: Math.max(4, Number(e.target.value) || 64) })
            }
          />
        </label>
        <p className="panel-hint">
          Levels: 2a → a → a/4 → a/16. Place at a/4; store at a/16.
        </p>
      </section>

      <section className="prop-section">
        <h3>Selection {selected.length > 0 ? `(${selected.length})` : ''}</h3>
        {selected.length === 0 && <p className="panel-hint">Select an entity on the canvas.</p>}
        {single && (
          <>
            <p className="panel-hint mono">
              {single.category} / {single.elementType}
              <br />
              id: {single.objectId}
            </p>
            <label className="prop-field">
              <span>Label</span>
              <input
                type="text"
                value={single.label ?? ''}
                onChange={(e) => onUpdateSelected({ label: e.target.value })}
              />
            </label>
            <label className="prop-field">
              <span>Colour</span>
              <input
                type="color"
                value={single.color ?? '#94a3b8'}
                onChange={(e) => onUpdateSelected({ color: e.target.value })}
              />
            </label>
            {single.category === 'text' ? (
              <label className="prop-field">
                <span>Font size</span>
                <input
                  type="number"
                  min={0.1}
                  step={0.05}
                  value={single.fontSize ?? 0.5}
                  onChange={(e) =>
                    onUpdateSelected({ fontSize: Math.max(0.1, Number(e.target.value) || 0.5) })
                  }
                />
              </label>
            ) : (
              <label className="prop-field">
                <span>Label font size</span>
                <input
                  type="range"
                  min={0.3}
                  max={3}
                  step={0.1}
                  value={single.fontSize ?? 1}
                  onChange={(e) => onUpdateSelected({ fontSize: Number(e.target.value) })}
                />
                <span className="panel-hint mono">{(single.fontSize ?? 1).toFixed(1)}×</span>
              </label>
            )}
            <p className="panel-hint mono">
              origin ({single.origin.col}, {single.origin.row}) · {single.widthCells}×
              {single.heightCells} finest · rot {single.rotation ?? 0}°
            </p>
          </>
        )}
        {selected.length > 1 && (
          <p className="panel-hint">{selected.length} entities selected. Drag to move together.</p>
        )}
      </section>

      <section className="prop-section">
        <h3>Zones</h3>
        {zones.length === 0 && <p className="panel-hint">No marked zones.</p>}
        <ul className="zone-list">
          {zones.map((z) => (
            <li key={z.id} className="zone-list-item">
              <span className="zone-swatch" style={{ background: z.color }} title={z.label} />
              <span>{z.label}</span>
              <button type="button" className="toolbar-btn ghost" onClick={() => onDeleteZone(z.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="prop-section">
        <h3>Unusable</h3>
        {unusableRegions.length === 0 && <p className="panel-hint">No unusable regions.</p>}
        <ul className="zone-list">
          {unusableRegions.map((r) => (
            <li key={r.id} className="zone-list-item">
              <span>{r.label || '(unlabeled)'}</span>
              <button
                type="button"
                className="toolbar-btn ghost"
                onClick={() => onLabelUnusableRegion(r.id)}
              >
                Label
              </button>
              <button
                type="button"
                className="toolbar-btn ghost"
                onClick={() => onDeleteUnusableRegion(r.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="prop-section">
        <h3>Floor JSON</h3>
        <p className="panel-hint">Export layout for preview.</p>
        <div className="prop-actions">
          <button type="button" className="toolbar-btn" onClick={onExportJson}>
            Download JSON
          </button>
          <button type="button" className="toolbar-btn" onClick={onCopyJson}>
            Copy JSON
          </button>
          <label className="toolbar-btn" style={{ cursor: 'pointer' }}>
            Load JSON
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImportJson(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </section>
    </aside>
  );
};

export default PropertiesPanel;
