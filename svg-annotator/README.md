# Image Shape Annotator

Local, offline tooling for generating reference annotations for a catalog of floor-plan and UI assets. Source images are never modified.

## Goal

Process SVG, PNG, and JPEG assets and create one labeled footprint per file:

- Label: filename without extension.
- Geometry: a closed rectangle **or** orthogonal polygon.
- Rules: horizontal/vertical edges only, 90° corners, no curves/diagonals, integer grid coordinates.
- **Minimal sides:** use a 4-sided rectangle whenever that fits (solid or curved shapes). Use an orthogonal polygon only when the silhouette needs more than 4 edges (L / U / notched footprints), with collinear vertices removed.
- Output: `catalog.json` plus one annotation SVG per asset under `svg annotations/`.

## Geometry modes

| Mode | Behavior |
|------|----------|
| `auto` (default) | **Full square-grid rectangle** (same coverage as the unit grid) for normal/curved shapes; orthogonal polygon only for clear **L** / **U** footprints |
| `rectangle` | Always bounding rectangle |
| `orthogonal` | Always detailed orthogonal contour (curves still forced to rectangle for SVG) |

## Installation and commands

```bash
npm install
npm run dev
npm run build
npm test
npm run generate -- ./input ./output --mode auto
```

```bash
npm run generate -- /path/to/Desk-it/assets/assets/2d ./output --mode auto --grid 64
```

### Output layout

```text
output/
├── catalog.json
├── report.json
└── svg annotations/
    └── <input-relative-path>.svg
```

Each annotation SVG uses integer grid coordinates (`viewBox="0 0 columns rows"`) and contains a `<rect>` or `<polygon>` for the footprint.

### UI export

`Export catalog + SVG annotations` downloads `catalog.zip` containing `catalog.json` and the `svg annotations/` folder.

## Processing notes

- **SVG:** vector fills are scanline-rasterized onto the square grid, then traced. Circles/ellipses/arc-heavy paths are treated as curved → rectangle.
- **PNG/JPEG:** foreground from alpha + corner-colour distance; largest component; outer orthogonal trace.
- Images are previewed at a max working dimension of 768px in the UI.

## Important limitations

- Automatic annotation is a starting point for review, not guaranteed semantic correctness.
- Diagonal artwork is approximated by orthogonal grid cells.
- Busy JPEG backgrounds may need sensitivity adjustment or manual review.
