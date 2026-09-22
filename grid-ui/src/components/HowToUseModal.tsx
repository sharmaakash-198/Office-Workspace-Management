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
            <h3>Grid levels</h3>
            <ul>
              <li>
                Fixed ladder: <strong>2a → a → a/4 → a/16</strong> (levels −1, 0, 1, 2).
              </li>
              <li>
                Default view is <strong>a</strong>. Zoom out merges to <strong>2a</strong>; zoom in
                reveals a/4 then a/16.
              </li>
              <li>
                Place furniture on the <strong>a/4</strong> grid; storage uses finest{' '}
                <strong>a/16</strong> cells. Entity size is fixed (no scale up/down).
              </li>
              <li>
                When zoomed in, use the bottom/right <strong>nav bars</strong> to pan quickly.
              </li>
            </ul>
          </section>

          <section>
            <h3>Canvas navigation</h3>
            <ul>
              <li>
                First quadrant only: cannot pan into x &lt; 0 or y &lt; 0. Outside the designated
                floor is grayed and not placeable.
              </li>
              <li>
                <strong>Pan</strong> - drag empty canvas (or Space / Pan tool). Space works normally
                inside text fields.
              </li>
              <li>
                <strong>Zoom</strong> - scroll or pinch. <strong>Fit</strong> pins (0,0) at
                bottom-left.
              </li>
            </ul>
          </section>

          <section>
            <h3>Library &amp; placement</h3>
            <ul>
              <li>
                Category accordion → pick a type (SVG preview) → click the canvas. Planner shows
                occupied cells only; <strong>Preview</strong> draws SVGs.
              </li>
              <li>
                After place: Copy / Rotate 90° CCW / Delete. Catalog sizes are in a/4 cells.
              </li>
            </ul>
          </section>

          <section>
            <h3>Cells, zones &amp; unusable</h3>
            <ul>
              <li>
                <strong>Ctrl+drag</strong> always selects cells (even over furniture) for zones /
                polygons / unusable. Shift+click for multi-entity select.
              </li>
              <li>
                Zone label prompt uses <strong>team-1</strong> as placeholder only.
              </li>
              <li>
                Mark unusable for irregular floors; optional labels (e.g. pillar). Entities cannot
                sit on unusable cells.
              </li>
            </ul>
          </section>

          <section>
            <h3>JSON &amp; Preview</h3>
            <ul>
              <li>
                Download / copy / load floor JSON. Preview shows floor size as{' '}
                <strong>cols×rows</strong> (e.g. 128×128) in a sticky top bar.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default HowToUseModal;
