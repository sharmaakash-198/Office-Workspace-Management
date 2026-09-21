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
            <h3>First-quadrant paper</h3>
            <ul>
              <li>
                Origin <strong>(0, 0)</strong> sits at the bottom-left. You can pan up and right
                freely; you cannot go left or down past the axes.
              </li>
              <li>
                The <strong>designated floor</strong> (cols × rows) is where you place objects. Beyond
                it the paper is <strong>grayed</strong> — visible grid, not placeable.
              </li>
              <li>
                <strong>Fit</strong> pins the origin to the bottom-left of the screen.
              </li>
            </ul>
          </section>

          <section>
            <h3>Library &amp; placement</h3>
            <ul>
              <li>
                Open one category accordion, pick a type (SVG preview), click the canvas. The planner
                shows occupied cells only; Pretty view draws the SVGs.
              </li>
              <li>
                After place/select: <strong>Copy</strong>, <strong>Scale up/down</strong>,{' '}
                <strong>Rotate</strong> (90° anticlockwise: 0/90/180/270), <strong>Delete</strong>.
              </li>
              <li>
                Toolbar <strong>Delete</strong> removes the current selection (same as Del key).
              </li>
            </ul>
          </section>

          <section>
            <h3>Irregular floors, polygons &amp; zones</h3>
            <ul>
              <li>
                Select cells (click / Shift+click / Ctrl+drag). Floating menu:{' '}
                <strong>Mark unusable</strong> (carve the floor), <strong>Clear unusable</strong>,{' '}
                <strong>Mark as polygon</strong>, Paste, Copy zone, Mark zone.
              </li>
              <li>
                Polygons can be saved under Custom or a new category, and deleted from the library
                without removing placed copies.
              </li>
            </ul>
          </section>

          <section>
            <h3>Zoom split, JSON &amp; pretty view</h3>
            <ul>
              <li>
                <strong>Split 2x / 4x</strong> controls how cells subdivide when zooming.
              </li>
              <li>
                Right panel: download / copy / load floor JSON (`category`, `elementType`,
                `objectId`, rotation, unusable cells).
              </li>
              <li>
                <strong>Pretty view</strong> keeps your planner state — Back restores the same
                layout. Labels use in-app prompts, not browser dialogs.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default HowToUseModal;
