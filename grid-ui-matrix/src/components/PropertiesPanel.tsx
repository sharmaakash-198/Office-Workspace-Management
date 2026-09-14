import React from 'react';
import type { Entity, FloorConfig } from '../types/geometry';
import type { FloorMatrix } from '../geometry/matrix';

interface PropertiesPanelProps {
  floor: FloorConfig;
  onFloorChange: (next: FloorConfig) => void;
  selected: Entity[];
  onUpdateSelected: (patch: Partial<Entity>) => void;
  matrix: FloorMatrix | null;
  onGenerateMatrix: () => void;
  onCopyMatrix: () => void;
  onCopyMatrixJson: () => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  floor,
  onFloorChange,
  selected,
  onUpdateSelected,
  matrix,
  onGenerateMatrix,
  onCopyMatrix,
  onCopyMatrixJson,
}) => {
  const single = selected.length === 1 ? selected[0] : null;

  return (
    <aside className="side-panel right-panel" aria-label="Properties">
      <div className="panel-header">Properties</div>

      <section className="prop-section">
        <h3>Grid</h3>
        <label className="prop-field">
          <span>Cell size a (m)</span>
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
          <span>Floor width (m)</span>
          <input
            type="number"
            min={4}
            step={1}
            value={floor.width}
            onChange={(e) =>
              onFloorChange({ ...floor, width: Math.max(4, Number(e.target.value) || 64) })
            }
          />
        </label>
        <label className="prop-field">
          <span>Floor height (m)</span>
          <input
            type="number"
            min={4}
            step={1}
            value={floor.height}
            onChange={(e) =>
              onFloorChange({ ...floor, height: Math.max(4, Number(e.target.value) || 64) })
            }
          />
        </label>
      </section>

      <section className="prop-section">
        <h3>Selection {selected.length > 0 ? `(${selected.length})` : ''}</h3>
        {selected.length === 0 && <p className="panel-hint">Select an entity on the canvas.</p>}
        {single && (
          <>
            <label className="prop-field">
              <span>Label / text</span>
              <input
                type="text"
                value={single.label ?? ''}
                onChange={(e) => onUpdateSelected({ label: e.target.value })}
              />
            </label>
            {single.kind !== 'text' && (
              <label className="prop-field">
                <span>Code</span>
                <input
                  type="number"
                  value={single.code}
                  onChange={(e) => onUpdateSelected({ code: Number(e.target.value) || 0 })}
                />
              </label>
            )}
            <label className="prop-field">
              <span>Colour</span>
              <input
                type="color"
                value={single.color ?? '#94a3b8'}
                onChange={(e) => onUpdateSelected({ color: e.target.value })}
              />
            </label>
            {single.kind === 'text' ? (
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
            {single.kind !== 'polygon' && single.kind !== 'text' && (
              <>
                <label className="prop-field">
                  <span>Width (m)</span>
                  <input
                    type="number"
                    min={0.05}
                    step={0.05}
                    value={single.width}
                    onChange={(e) =>
                      onUpdateSelected({ width: Math.max(0.05, Number(e.target.value) || 0.05) })
                    }
                  />
                </label>
                <label className="prop-field">
                  <span>Height (m)</span>
                  <input
                    type="number"
                    min={0.05}
                    step={0.05}
                    value={single.height}
                    onChange={(e) =>
                      onUpdateSelected({ height: Math.max(0.05, Number(e.target.value) || 0.05) })
                    }
                  />
                </label>
              </>
            )}
            <p className="panel-hint mono">
              ({Math.round(single.x)}, {Math.round(single.y)})
            </p>
          </>
        )}
        {selected.length > 1 && (
          <p className="panel-hint">{selected.length} entities selected. Drag to move together.</p>
        )}
      </section>

      <section className="prop-section">
        <h3>Matrix</h3>
        <p className="panel-hint">
          Covers the full floor at cell size a. Row 0 is the top of the floor. Empty = 0.
        </p>
        <div className="prop-actions">
          <button type="button" className="toolbar-btn" onClick={onGenerateMatrix}>
            Generate
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={onCopyMatrix}
            disabled={!matrix || matrix.rows === 0}
          >
            Copy matrix
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={onCopyMatrixJson}
            disabled={!matrix || matrix.rows === 0}
          >
            Copy JSON
          </button>
        </div>
        {matrix && matrix.rows > 0 && (
          <pre className="matrix-preview">
            {matrix.matrix.map((row) => row.join(' ')).join('\n')}
          </pre>
        )}
      </section>
    </aside>
  );
};

export default PropertiesPanel;
