import React, { useState } from 'react';
import type { Viewport } from '../types/viewport';
import type { EditorTool } from '../types/geometry';
import { listDrafts } from '../lib/drafts';

interface ToolbarProps {
  viewport: Viewport;
  tool: EditorTool;
  showGrid: boolean;
  snapEnabled: boolean;
  includeGridOnExport: boolean;
  theme: 'dark' | 'light';
  canUndo: boolean;
  canRedo: boolean;
  canPaste: boolean;
  onTool: (tool: EditorTool) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitFloor: () => void;
  onToggleGrid: () => void;
  onToggleSnap: () => void;
  onToggleExportGrid: () => void;
  onToggleTheme: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onHowToUse: () => void;
  onSaveDraft: (name: string) => void;
  onLoadDraft: (name: string) => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  onExportPdf: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  viewport,
  tool,
  showGrid,
  snapEnabled,
  includeGridOnExport,
  theme,
  canUndo,
  canRedo,
  canPaste,
  onTool,
  onZoomIn,
  onZoomOut,
  onFitFloor,
  onToggleGrid,
  onToggleSnap,
  onToggleExportGrid,
  onToggleTheme,
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  onHowToUse,
  onSaveDraft,
  onLoadDraft,
  onExportPng,
  onExportSvg,
  onExportPdf,
}) => {
  const [draftOpen, setDraftOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftsVersion, setDraftsVersion] = useState(0);
  const drafts = draftOpen ? listDrafts() : [];
  void draftsVersion;
  const zoomPercent = Math.round((viewport.zoom / 40) * 100);

  return (
    <header className="toolbar" role="toolbar" aria-label="Floor editor controls">
      <div className="toolbar-brand">
        <span className="brand-mark" aria-hidden />
        <span>Floor Planner</span>
      </div>

      <div className="toolbar-group">
        <button
          type="button"
          className={`toolbar-btn toggle-btn ${tool === 'select' ? 'active' : ''}`}
          onClick={() => onTool('select')}
          title="Select"
        >
          Select
        </button>
        <button
          type="button"
          className={`toolbar-btn toggle-btn ${tool === 'pan' ? 'active' : ''}`}
          onClick={() => onTool('pan')}
          title="Pan"
        >
          Pan
        </button>
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
        <button type="button" className="toolbar-btn" onClick={onCopy} title="Copy (Ctrl+C)">
          Copy
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={onPaste}
          disabled={!canPaste}
          title="Paste into selected cell (Ctrl+V)"
        >
          Paste
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
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button
          type="button"
          className={`toolbar-btn toggle-btn ${showGrid ? 'active' : ''}`}
          onClick={onToggleGrid}
        >
          Grid
        </button>
        <button
          type="button"
          className={`toolbar-btn toggle-btn ${snapEnabled ? 'active' : ''}`}
          onClick={onToggleSnap}
        >
          Snap
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
                Exports the full floor area
              </p>
              <label className="menu-check">
                <input
                  type="checkbox"
                  checked={includeGridOnExport}
                  onChange={onToggleExportGrid}
                />
                Include grid lines
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
