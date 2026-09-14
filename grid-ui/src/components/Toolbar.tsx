import React, { useState } from 'react';
import type { Viewport } from '../types/viewport';
import type { EditorTool } from '../types/floorplan';
import { listDrafts } from '../lib/drafts';

interface ToolbarProps {
  viewport: Viewport;
  tool: EditorTool;
  showGrid: boolean;
  snapEnabled: boolean;
  showCoordinates: boolean;
  includeGridOnExport: boolean;
  theme: 'dark' | 'light';
  canUndo: boolean;
  canRedo: boolean;
  canPaste: boolean;
  hasSelection: boolean;
  onTool: (tool: EditorTool) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitFloor: () => void;
  onResetView: () => void;
  onToggleGrid: () => void;
  onToggleSnap: () => void;
  onToggleCoordinates: () => void;
  onToggleExportGrid: () => void;
  onToggleTheme: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onRotate: (quarterTurns: number) => void;
  onDelete: () => void;
  onHowToUse: () => void;
  onSaveDraft: (name: string) => void;
  onLoadDraft: (name: string) => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  onExportPdf: () => void;
  onExportJson: () => void;
  onCopyJson: () => void;
  onImportJson: (text: string) => void;
}

const TOOLS: { id: EditorTool; label: string; hint: string }[] = [
  { id: 'select', label: 'Select', hint: 'Select and move (V)' },
  { id: 'pan', label: 'Pan', hint: 'Pan the camera (H)' },
  { id: 'area', label: 'Area', hint: 'Drag cells to build an area (A)' },
  { id: 'wall', label: 'Wall', hint: 'Click grid vertices; Enter or double-click to finish (W)' },
  { id: 'seat', label: 'Seat', hint: 'Click to place a seat (S)' },
  { id: 'desk', label: 'Desk', hint: 'Click to place a desk (D)' },
  { id: 'room', label: 'Room', hint: 'Drag to place a room (R)' },
  { id: 'plant', label: 'Plant', hint: 'Click to place a plant (P)' },
  { id: 'delete', label: 'Erase', hint: 'Click objects to erase (E)' },
];

const Toolbar: React.FC<ToolbarProps> = ({
  viewport,
  tool,
  showGrid,
  snapEnabled,
  showCoordinates,
  includeGridOnExport,
  theme,
  canUndo,
  canRedo,
  canPaste,
  hasSelection,
  onTool,
  onZoomIn,
  onZoomOut,
  onFitFloor,
  onResetView,
  onToggleGrid,
  onToggleSnap,
  onToggleCoordinates,
  onToggleExportGrid,
  onToggleTheme,
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  onDuplicate,
  onRotate,
  onDelete,
  onHowToUse,
  onSaveDraft,
  onLoadDraft,
  onExportPng,
  onExportSvg,
  onExportPdf,
  onExportJson,
  onCopyJson,
  onImportJson,
}) => {
  const [draftOpen, setDraftOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftsVersion, setDraftsVersion] = useState(0);
  const drafts = draftOpen ? listDrafts() : [];
  void draftsVersion;
  const zoomPercent = Math.round((viewport.zoom / 40) * 100);

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => onImportJson(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  return (
    <header className="toolbar" role="toolbar" aria-label="Floor editor controls">
      <div className="toolbar-brand">
        <span className="brand-mark" aria-hidden />
        <span>Floor Planner</span>
      </div>

      <div className="toolbar-group toolbar-tools">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`toolbar-btn toggle-btn ${tool === t.id ? 'active' : ''}`}
            onClick={() => onTool(t.id)}
            title={t.hint}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button
          type="button"
          className="toolbar-btn icon-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          type="button"
          className="toolbar-btn icon-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          ↷
        </button>
        <button
          type="button"
          className="toolbar-btn icon-btn"
          onClick={() => onRotate(-1)}
          disabled={!hasSelection}
          title="Rotate 90° counter-clockwise (Shift+R)"
        >
          ⟲
        </button>
        <button
          type="button"
          className="toolbar-btn icon-btn"
          onClick={() => onRotate(1)}
          disabled={!hasSelection}
          title="Rotate 90° clockwise (R)"
        >
          ⟳
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button
          type="button"
          className="toolbar-btn"
          onClick={onCopy}
          disabled={!hasSelection}
          title="Copy (Ctrl+C)"
        >
          Copy
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={onPaste}
          disabled={!canPaste}
          title="Paste at cursor (Ctrl+V)"
        >
          Paste
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={onDuplicate}
          disabled={!hasSelection}
          title="Duplicate (Ctrl+D)"
        >
          Duplicate
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={onDelete}
          disabled={!hasSelection}
          title="Delete (Del)"
        >
          Delete
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button type="button" className="toolbar-btn icon-btn" onClick={onZoomOut} title="Zoom out">
          −
        </button>
        <span className="zoom-display" title={`Zoom scale: ${viewport.zoom.toFixed(1)} px/m`}>
          {zoomPercent}%
        </span>
        <button type="button" className="toolbar-btn icon-btn" onClick={onZoomIn} title="Zoom in">
          +
        </button>
        <button type="button" className="toolbar-btn" onClick={onFitFloor} title="Fit floor">
          Fit
        </button>
        <button type="button" className="toolbar-btn" onClick={onResetView} title="Reset camera">
          Reset
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button
          type="button"
          className={`toolbar-btn toggle-btn ${showGrid ? 'active' : ''}`}
          onClick={onToggleGrid}
          title="Show grid"
        >
          Grid
        </button>
        <button
          type="button"
          className={`toolbar-btn toggle-btn ${snapEnabled ? 'active' : ''}`}
          onClick={onToggleSnap}
          title="Snap to the visible grid level"
        >
          Snap
        </button>
        <button
          type="button"
          className={`toolbar-btn toggle-btn ${showCoordinates ? 'active' : ''}`}
          onClick={onToggleCoordinates}
          title="Show coordinates and axis labels"
        >
          Coords
        </button>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group toolbar-menus">
        <button type="button" className="toolbar-btn" onClick={onHowToUse}>
          How to use
        </button>

        <div className="menu-wrap">
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => {
              setDraftOpen((o) => !o);
              setExportOpen(false);
              setDraftsVersion((v) => v + 1);
            }}
          >
            Drafts
          </button>
          {draftOpen && (
            <div className="menu-dropdown draft-menu">
              <div className="draft-save-form" onMouseDown={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  placeholder="Draft name"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && draftName.trim()) {
                      onSaveDraft(draftName.trim());
                      setDraftName('');
                      setDraftsVersion((v) => v + 1);
                    }
                  }}
                />
                <button
                  type="button"
                  className="toolbar-btn"
                  disabled={!draftName.trim()}
                  onClick={() => {
                    if (!draftName.trim()) return;
                    onSaveDraft(draftName.trim());
                    setDraftName('');
                    setDraftsVersion((v) => v + 1);
                  }}
                >
                  Save draft
                </button>
              </div>
              <div className="menu-divider" />
              {drafts.length === 0 && <div className="menu-empty">No saved drafts yet</div>}
              {drafts.map((d) => (
                <button
                  key={d.name}
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    onLoadDraft(d.name);
                    setDraftOpen(false);
                  }}
                >
                  {d.name}
                  <small>{new Date(d.savedAt).toLocaleString()}</small>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="menu-wrap">
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => {
              setExportOpen((o) => !o);
              setDraftOpen(false);
            }}
          >
            Export
          </button>
          {exportOpen && (
            <div className="menu-dropdown">
              <p className="menu-empty" style={{ paddingBottom: 4 }}>
                Floor plan JSON is the contract for the viewer app
              </p>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  onExportJson();
                  setExportOpen(false);
                }}
              >
                Download floor plan JSON
              </button>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  onCopyJson();
                  setExportOpen(false);
                }}
              >
                Copy floor plan JSON
              </button>
              <label className="menu-item" style={{ cursor: 'pointer' }}>
                Import floor plan JSON
                <input
                  type="file"
                  accept="application/json,.json"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImportFile(file);
                    e.target.value = '';
                    setExportOpen(false);
                  }}
                />
              </label>
              <div className="menu-divider" />
              <label className="menu-check">
                <input
                  type="checkbox"
                  checked={includeGridOnExport}
                  onChange={onToggleExportGrid}
                />
                Include grid lines in images
              </label>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  onExportPng();
                  setExportOpen(false);
                }}
              >
                Download PNG
              </button>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  onExportSvg();
                  setExportOpen(false);
                }}
              >
                Download SVG
              </button>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  onExportPdf();
                  setExportOpen(false);
                }}
              >
                Download PDF
              </button>
            </div>
          )}
        </div>

        <button type="button" className="toolbar-btn" onClick={onToggleTheme}>
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>
    </header>
  );
};

export default Toolbar;
