# Floor Planner — Features

## Grid
- Fixed levels: 2a (zoom-out), a (default), a/4 (placement), a/16 (finest storage)
- First-quadrant paper; grayed non-floor area; (0,0) bottom-left with gutter
- Units of arbitrary `a` only (no meters/feet)
- Zoom nav bars (bottom + right) when zoomed in

## Library & entities
- Category accordion + SVG previews from catalog JSON
- Catalog sizes in a/4 cells; placed as a/16 finest cells
- Fixed footprint (no scale up/down); rotate 0/90/180/270 CCW
- Labels non-selectable on canvas; Space works in property inputs

## Zones & unusable
- Ctrl+drag selects cells over furniture
- Named zones with light tints; placeholder labels
- Labeled unusable regions (e.g. pillar); blocks placement/move

## Preview & JSON
- Preview route with sticky bar and cols×rows size
- FloorDocument JSON export/import (no occupancy matrix)
- Drafts in localStorage
