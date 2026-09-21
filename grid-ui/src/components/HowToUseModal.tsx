import React from 'react';

interface HowToUseModalProps {
  open: boolean;
  onClose: () => void;
}

const HowToUseModal: React.FC<HowToUseModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="howto-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="howto-title">How to use</h2>
          <button type="button" className="toolbar-btn icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="modal-body">
          <section>
            <h3>Canvas navigation</h3>
            <ul>
              <li>
                <strong>Pan</strong> - drag empty canvas with left mouse (or hold Space / use Pan
                tool).
              </li>
              <li>
                <strong>Zoom</strong> - scroll wheel or pinch; zooms toward the pointer.
              </li>
              <li>
                <strong>Fit</strong> - zooms out so the whole working floor fills the screen.
              </li>
            </ul>
          </section>

          <section>
            <h3>Selecting cells &amp; making a polygon</h3>
            <ul>
              <li>
                <strong>Click</strong> a cell to select it.
              </li>
              <li>
                <strong>Shift+click</strong> to add/remove cells from the selection.
              </li>
              <li>
                <strong>Ctrl+drag</strong> (⌘+drag on Mac) draws a marquee over cells or entities.
              </li>
              <li>
                When cells are selected, use <strong>Mark as polygon</strong> in the floating menu.
                The exact selected shape (L, T, etc.) is kept as one draggable block and added under{' '}
                <em>Custom shapes</em>.
              </li>
              <li>
                <strong>Copy / Paste</strong> - select a shape, Copy (or Ctrl+C), select a target
                cell, then Paste (Ctrl+V) to place another copy there.
              </li>
            </ul>
          </section>

          <section>
            <h3>Shapes</h3>
            <ul>
              <li>
                Pick a library item, then click the canvas to place it.
              </li>
              <li>Drag a shape to move it; use green handles to resize.</li>
              <li>Change library colours with the colour picker on each item.</li>
              <li>Delete - select shape(s) and press Delete / Backspace.</li>
            </ul>
          </section>

          <section>
            <h3>Top bar</h3>
            <ul>
              <li>
                <strong>Select / Pan</strong> - default tool mode.
              </li>
              <li>
                <strong>Undo / Redo</strong> - up to 5 steps (Ctrl+Z / Ctrl+Shift+Z).
              </li>
              <li>
                <strong>Grid</strong> - toggle grid lines.
              </li>
              <li>
                <strong>Snap</strong> - snap placement and moves to the current grid level.
              </li>
              <li>
                <strong>Drafts</strong> - save/load layout JSON in this browser.
              </li>
              <li>
                <strong>Export</strong> - PNG, SVG, or PDF (optional grid lines).
              </li>
              <li>
                <strong>Light / Dark</strong> - theme toggle.
              </li>
            </ul>
          </section>

          <section>
            <h3>Sidebars</h3>
            <ul>
              <li>
                <strong>Left - Library</strong> - built-in furniture stubs and custom polygons you
                marked.
              </li>
              <li>
                <strong>Right - Properties</strong> - cell size <em>a</em>, floor size, label font
                size, selection fields, and <strong>Generate matrix</strong> (codes on the floor
                grid with empty cells as 0).
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default HowToUseModal;
