# Image Shape Annotator

Local, offline tooling for generating reference annotations for a catalog of floor-plan and UI assets. The source images are never modified. The intended result is metadata that another application can use to position or reason about each asset.

## Goal

Process SVG, PNG, and JPEG assets and automatically create one labeled footprint per file:

- Label: the filename without its extension.
- Geometry: a closed rectangle or orthogonal polygon.
- Geometry rules: only horizontal/vertical line segments, 90-degree corners, no curves, no diagonal edges, normalized coordinates, positive area, and no self-intersections.
- Default intent: use a simple rectangle when it represents the object adequately; use an orthogonal outer silhouette when a tighter shape is useful.
- Output: a catalog JSON file plus per-asset svg-shape files for CLI processing.

This is a catalog preprocessing utility, not a floor-plan editor, database, cloud service, or collaboration product.

## Current implementation

### Local UI

Run `npm run dev` and open the URL Vite prints. The app provides:

- Individual-file and folder selection for `.svg`, `.png`, `.jpg`, and `.jpeg`.
- Sequential processing with visible progress, which avoids allocating many image canvases concurrently.
- Asset navigation and a generated JSON view.
- A red labeled overlay showing the generated geometry.
- Geometry modes: `auto`, `bounding rectangle`, and `orthogonal contour` using minimum number of required edges possible .
- Per-asset regeneration using the selected mode.
- `catalog.json`  and filename.svg for each image-annotated shape  inside folder catalog' download.

Images are reduced to a maximum working dimension of 768 pixels before raster analysis. The displayed image is a generated PNG preview, rather than a second direct render of the uploaded SVG. This reduces the chance that complex SVG exports destabilize the browser renderer.

### Image processing

For PNG and JPEG, the browser-side analyzer:

1. Renders one bounded working image.
2. Detects foreground using alpha and distance from the four corner colours.
3. Retains the largest connected foreground component.
4. Traces its grid-cell outer boundary.
5. Removes collinear vertices.
6. Validates the resulting rectangle or orthogonal polygon.

PNG transparency is respected. JPEG background estimation assumes that the corners are background-like; busy backgrounds can therefore require review.

### SVG and CLI processing

The CLI recursively scans SVG directories and uses deterministic SVG bounds extraction for common primitives and basic path data. It creates:

```text
output/
├── catalog.json
├── report.json
└── shapes/
    └── <input-relative-path>.svg
```

The SVG analyzer supports common shapes, basic paths, element transforms, viewBox fallback, and hidden-element filtering. In CLI auto mode, SVG output is currently rectangle-first.

The supplied `assets/2d` SVG catalog was checked with the CLI: 51 assets processed, 50 successful, 1 review-required, and 0 failures.

## Installation and commands

```bash
npm install
npm run dev
npm run build
npm test
```

Run the SVG batch generator:

```bash
npm run generate -- ./input ./output --mode auto
```

Available CLI modes:

```text
--mode rectangle
--mode orthogonal
--mode auto
```

Use `npm run generate -- --help` for CLI help.

### Linux watcher limit

If Vite reports `ENOSPC: System limit for number of file watchers reached`, this project is configured to use polling. Stop stale Vite processes and start the current server again:

```bash
fuser -k 5173/tcp
npm run dev
```

Always use the exact local URL printed by Vite; it may choose a port other than `5173` if that port is occupied.

## Output format

Each asset includes a stable ID, source path, filename label, generated geometry, and processing status.

```json
{
  "id": "chairs/chair-01",
  "source": "chairs/chair-01.png",
  "label": "chair-01",
  "geometry": {
    "type": "orthogonal-polygon",
    "points": [[0.1, 0.2], [0.8, 0.2], [0.8, 0.6], [0.5, 0.6], [0.5, 0.9], [0.1, 0.9]]
  },
  "metadata": {
    "automatic": true,
    "status": "AUTO_ORTHOGONAL"
  }
}
```

Statuses are `AUTO_BOUNDS`, `AUTO_ORTHOGONAL`, `REVIEW_REQUIRED`, or `FAILED`. A failed asset should not stop a batch.

## What remains to do

The current app is a functional prototype. These are the most important remaining items:

1. **Improve SVG contours.** The CLI is rectangle-first and does not yet create a true SVG-path silhouette for irregular vectors. It needs a full SVG DOM/transform resolver, path flattening, fill/stroke handling, clip-path support, and robust unioning before it can reliably derive tight orthogonal SVG polygons.
2. **Improve image segmentation.** The current corner-colour heuristic works best for isolated objects on transparent or plain backgrounds. Add user-adjustable threshold/background controls, component selection, inversion, and morphology to handle photographs or busy JPEG backgrounds.
3. **Manual annotation tools.** Add CVAT-style editing: draw, move, add/remove orthogonal vertices, undo/redo, and explicitly mark an asset reviewed. Manual edits should be persisted separately from automatic output.
4. **Visual inspection controls.** Add pan/zoom, fit-to-image, grid, vertex handles, fill toggle, and clearer geometry statistics.
5. **Batch support for raster files in the CLI.** The UI supports PNG/JPEG; the Node CLI currently processes SVG only. Add a server-safe raster decoder and use the same contour pipeline in both environments.
6. **Caching and scalability.** Cache results by source-content hash, add configurable worker limits/progress reporting, and avoid regenerating unchanged files.
7. **Better validation.** Add explicit polygon intersection testing for every orthogonal contour and fixtures for holes, disconnected objects, rotated transforms, strokes, masks, and malformed image files.
8. **Tests.** Expand automated fixtures to cover the real `assets/2d` patterns and representative PNG/JPEG examples, including expected contour snapshots.

## Important limitations

- Automatic annotation is a starting point, not a guarantee of semantic correctness.
- The UI generates a rasterized preview of SVG files; it does not alter the source file.
- A shape with a white opaque background can be interpreted as foreground. Transparent PNGs and plain-background images produce the best results today.
- The current UI is designed for local use only and stores no edits once the page is refreshed.
