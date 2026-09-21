# Floor Planner - Features

## Canvas & navigation

- **First-quadrant paper** - Cannot pan into negative X/Y; origin at bottom-left on Fit.
- **Infinite up/right** - Grid continues beyond the floor; exterior is grayed and not placeable.
- **Arbitrary unit `a`** - Finest cell size; no meters/feet in the UI.
- **Zoom split 2x or 4x** - Toolbar toggle for cell subdivision depth.
- **Pan / wheel / pinch / Fit / Snap / Grid** - Standard viewport tools.

## Library

- **Category accordions** - Exclusive open; SVG previews from `public/assets`.
- **Catalog JSON** - `public/library-catalog.json` configures types and sizes.
- **Custom polygons** - Save under Custom or a new category; deletable from library.
- **Mark unusable** - Select cells, then mark unusable to map irregular floors.

## Editing

- **Cell occupancy on planner** - Pretty view draws SVGs.
- **Entity menu** - Copy, Scale up/down, Rotate (0/90/180/270 CCW), Delete.
- **Toolbar Delete** - Removes selection.
- **Zones** - Named tinted regions; copy zone entities.
- **In-app prompts** - No browser alert/prompt for labels and messages.

## JSON & pretty view

- **FloorDocument v2** - Includes rotation and unusableCells.
- **Pretty view** - Catalog SVGs + polygon boundaries; editor state preserved on Back.
- **Drafts / download / load JSON**.
