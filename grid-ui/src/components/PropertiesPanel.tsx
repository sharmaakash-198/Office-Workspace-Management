import React from 'react';
import type { Entity, FloorPlanDoc, Wall } from '../types/floorplan';
import type { CollisionPair } from '../geometry/collision';

interface PropertiesPanelProps {
  doc: FloorPlanDoc;
  onWorkspaceResize: (widthCells: number, heightCells: number) => void;
  onBaseUnitChange: (a: number) => void;
  selected: Entity[];
  selectedWalls: Wall[];
  onUpdateSelected: (patch: Partial<Entity>) => void;
  onUpdateWall: (patch: Partial<Wall>) => void;
  onResizeSelected: (w: number, h: number) => void;
  onMoveSelected: (x: number, y: number) => void;
  collisions: CollisionPair[];
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  doc,
  onWorkspaceResize,
  onBaseUnitChange,
  selected,
  selectedWalls,
  onUpdateSelected,
  onUpdateWall,
  onResizeSelected,
  onMoveSelected,
  collisions,
}) => {
  const { workspace, grid } = doc;
  const single = selected.length === 1 ? selected[0] : null;
  const singleWall = selectedWalls.length === 1 ? selectedWalls[0] : null;
  const widthMeters = workspace.widthCells * grid.a;
  const heightMeters = workspace.heightCells * grid.a;

  return (
    <aside className="side-panel right-panel" aria-label="Properties">
      <div className="panel-header">Properties</div>

      <section className="prop-section">
        <h3>Workspace</h3>
        <label className="prop-field">
          <span>Cell size a (m)</span>
          <input
            type="number"
            min={0.05}
            step={0.05}
            value={grid.a}
            onChange={(e) => onBaseUnitChange(Math.max(0.05, Number(e.target.value) || 0.25))}
          />
        </label>
        <label className="prop-field">
          <span>Width (m)</span>
          <input
            type="number"
            min={grid.a}
            step={grid.a}
            value={Number(widthMeters.toFixed(3))}
            onChange={(e) =>
              onWorkspaceResize(
                Math.max(1, Math.round((Number(e.target.value) || 0) / grid.a)),
                workspace.heightCells,
              )
            }
          />
        </label>
        <label className="prop-field">
          <span>Height (m)</span>
          <input
            type="number"
            min={grid.a}
            step={grid.a}
            value={Number(heightMeters.toFixed(3))}
            onChange={(e) =>
              onWorkspaceResize(
                workspace.widthCells,
                Math.max(1, Math.round((Number(e.target.value) || 0) / grid.a)),
              )
            }
          />
        </label>
        <p className="panel-hint mono">
          {workspace.widthCells} × {workspace.heightCells} cells · subdivision{' '}
          {grid.subdivisionFactor} · {grid.levels} coarser levels
        </p>
      </section>

      <section className="prop-section">
        <h3>Selection {selected.length > 0 ? `(${selected.length})` : ''}</h3>
        {selected.length === 0 && selectedWalls.length === 0 && (
          <p className="panel-hint">Select an object on the canvas.</p>
        )}

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
            <label className="prop-field">
              <span>Colour</span>
              <input
                type="color"
                value={single.color ?? '#94a3b8'}
                onChange={(e) => onUpdateSelected({ color: e.target.value })}
              />
            </label>

            <div className="prop-row">
              <label className="prop-field">
                <span>X (cells)</span>
                <input
                  type="number"
                  step={1}
                  value={single.origin.x}
                  onChange={(e) =>
                    onMoveSelected(Math.round(Number(e.target.value) || 0), single.origin.y)
                  }
                />
              </label>
              <label className="prop-field">
                <span>Y (cells)</span>
                <input
                  type="number"
                  step={1}
                  value={single.origin.y}
                  onChange={(e) =>
                    onMoveSelected(single.origin.x, Math.round(Number(e.target.value) || 0))
                  }
                />
              </label>
            </div>

            <div className="prop-row">
              <label className="prop-field">
                <span>W (cells)</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={single.size.w}
                  onChange={(e) =>
                    onResizeSelected(
                      Math.max(1, Math.round(Number(e.target.value) || 1)),
                      single.size.h,
                    )
                  }
                />
              </label>
              <label className="prop-field">
                <span>H (cells)</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={single.size.h}
                  onChange={(e) =>
                    onResizeSelected(
                      single.size.w,
                      Math.max(1, Math.round(Number(e.target.value) || 1)),
                    )
                  }
                />
              </label>
            </div>

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
                <span>Label size</span>
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
              {(single.size.w * grid.a).toFixed(2)} × {(single.size.h * grid.a).toFixed(2)} m ·
              rotation {single.rotation}° ·{' '}
              {single.cells ? `${single.cells.length} cells` : 'rectangle'}
            </p>
          </>
        )}

        {singleWall && (
          <>
            <label className="prop-field">
              <span>Thickness (cells)</span>
              <input
                type="number"
                min={1}
                step={1}
                value={singleWall.thickness}
                onChange={(e) =>
                  onUpdateWall({ thickness: Math.max(1, Math.round(Number(e.target.value) || 1)) })
                }
              />
            </label>
            <label className="prop-field">
              <span>Colour</span>
              <input
                type="color"
                value={singleWall.color ?? '#475569'}
                onChange={(e) => onUpdateWall({ color: e.target.value })}
              />
            </label>
            <label className="prop-check">
              <input
                type="checkbox"
                checked={singleWall.exterior}
                onChange={(e) => onUpdateWall({ exterior: e.target.checked })}
              />
              Exterior wall
            </label>
            <p className="panel-hint mono">
              {singleWall.points.length} vertices ·{' '}
              {(singleWall.thickness * grid.a).toFixed(2)} m thick
            </p>
          </>
        )}

        {selected.length > 1 && (
          <p className="panel-hint">
            {selected.length} objects selected. Drag to move together, R to rotate.
          </p>
        )}
      </section>

      {collisions.length > 0 && (
        <section className="prop-section">
          <h3>Overlaps ({collisions.length})</h3>
          <p className="panel-hint">
            These objects share cells. Overlap is allowed but usually unintended.
          </p>
          <ul className="collision-list">
            {collisions.slice(0, 8).map((c) => (
              <li key={`${c.a}-${c.b}`} className="mono">
                {c.a} ∩ {c.b} — {c.cells} cell(s)
              </li>
            ))}
          </ul>
        </section>
      )}

    </aside>
  );
};

export default PropertiesPanel;
