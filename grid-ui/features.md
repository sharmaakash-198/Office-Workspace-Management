# Floor Planner - Features

## Canvas & navigation
- **Infinite grid canvas** - FigJam-style paper with hierarchical grid lines that refine as you zoom in.
- **World coordinates** - Objects live in real meters (Y-up); zoom never changes their logical size.
- **Close-up start view** - Opens zoomed in so fine cells fill the screen instead of fitting the whole floor.
- **Left-drag pan** - Drag empty canvas to pan (also Space+drag or Pan tool / middle-mouse).
- **Wheel zoom** - Scroll to zoom toward the pointer.
- **Pinch zoom** - Two-finger pinch zooms toward the pinch midpoint on touch devices.
- **Fit** - Zooms out so the entire working floor fills the viewport (max zoom-out).
- **Zoom clamps** - Zoom cannot go coarser than fitting the floor or finer than a sensible ceiling.
- **Configurable cell size `a`** - Finest grid cell size in meters; coarser levels are `a × 4^n`.
- **Configurable floor size** - Working floor width/height in meters (default 64×64).
- **Grid toggle** - Show or hide grid lines.
- **Snap toggle** - Snap placement and moves to the current grid level.
- **Integer status coords** - Cursor position in the status bar is shown as nearest integers.
- **Axis labels** - Meter labels along the view update as you pan/zoom.

## Selection
- **Click cell** - Select a single grid cell.
- **Shift+click cells** - Add or remove cells from a multi-cell selection.
- **Ctrl/⌘+drag marquee** - Box-select cells or entities.
- **Shift+click entities** - Add/remove shapes from a multi-entity selection.
- **Floating selection menu** - Appears near selected cells with count, Mark as polygon, and Clear.
- **Esc** - Clear selection and cancel place mode.

## Shapes & editing
- **Entity library** - Place workstation, plant, meeting room, cafeteria, custom block, or text.
- **Library colours** - Change colour of each library item with a colour picker.
- **Click-to-place** - Pick a library item, then click the canvas to place it.
- **Drag to move** - Drag placed shapes; multi-select moves together.
- **Resize handles** - Corner/edge handles resize the selected shape (with snap when enabled).
- **Delete** - Delete/Backspace removes selected entities.
- **Mark as polygon** - Turns an exact cell selection (L, T, etc.) into one draggable footprint shape.
- **Custom shapes library** - Marked polygons are added under Custom shapes with their own colour and code.
- **Text block** - Place label text with no border and no matrix code; font size is editable.
- **Properties panel** - Edit label, code, colour, size, and text font size for the selection.
- **Global label font scale** - Slider scales shape label text size across the canvas.
- **Copy / Paste** - Copy selected shapes and paste them onto a selected cell (toolbar or Ctrl+C / Ctrl+V).

## History
- **Undo / Redo** - Up to 5 edit steps via toolbar or Ctrl+Z / Ctrl+Shift+Z (Ctrl+Y redo).

## Matrix
- **Generate matrix** - Builds a full-floor occupancy grid at cell size `a` (empty = 0).
- **Visual Y orientation** - Matrix row 0 is the top of the floor (matches on-screen view).
- **Copy matrix** - Copies the plain numeric matrix to the clipboard.
- **Copy JSON** - Copies structured `{ cellSize, rows, cols, matrix }` JSON.
- **Matrix preview** - Shows the generated matrix in the right panel.

## Drafts & export
- **Save draft** - Enter a name and save layout (entities, floor, viewport, theme) to localStorage.
- **Load draft** - Open a previously saved draft from the Drafts list.
- **Export PNG** - Downloads the entire working floor as PNG (not just the viewport).
- **Export SVG** - Downloads the entire working floor as SVG.
- **Export PDF** - Embeds the full-floor render in a PDF.
- **Export grid option** - Include or omit grid lines in exports.
- **Theme-aware export background** - Export backgrounds follow the current theme (not a black void).

## UI & help
- **Three-pane layout** - Library (left), canvas (center), properties (right), plus top toolbar.
- **Light theme (default)** - Grey / off-white light UI.
- **Dark theme** - Lighter mid-grey dark mode toggle.
- **How to use** - In-app modal explaining navigation, selection, polygon marking, tools, and sidebars.
- **Status bar** - Shows world coords, cell size, snap state, and selection summary.
