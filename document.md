# Floor Mapping Application (`grid-ui`) - Technical Feature Documentation

## 1. Core Architecture & World Coordinate System

### 1.1 First-Quadrant Y-Up World Space vs. Screen Space

The application separates **World Space** (mathematical coordinates of the room) from **Screen Space** (pixels rendered in the browser SVG).

- **World Space**:
    - 1st quadrant Cartesian coordinate system where $(0, 0)$ is at the **bottom-left** of the floor.
    - $X$ increases to the **right** ($+X$).
    - $Y$ increases **upward** ($+Y$).
    - Unit length $a$ represents 1 base world unit (e.g., 1 meter).
- **Screen (SVG) Space**:
    - $X$ increases to the **right** ($+X$).
    - $Y$ increases **downward** ($+Y$), with $(0, 0)$ at the top-left of the browser window.

### 1.2 Coordinate Conversion Formulas

Coordinate transformations are defined in [`coordinates.ts`](file:///home/vinay-dhiman/problems/floor_mapping/grid-ui/src/geometry/coordinates.ts):

- **World to Screen**:
  $$\text{screen.x} = \text{world.x} \cdot \text{zoom} + \text{panX}$$
  $$\text{screen.y} = -\text{world.y} \cdot \text{zoom} + \text{panY}$$

- **Screen to World (Inverse)**:
  $$\text{world.x} = \frac{\text{screen.x} - \text{panX}}{\text{zoom}}$$
  $$\text{world.y} = \frac{\text{panY} - \text{screen.y}}{\text{zoom}}$$

- **SVG Matrix Transform String**:
    ```ts
    `translate(${viewport.panX}, ${viewport.panY}) scale(${viewport.zoom}, ${-viewport.zoom})`;
    ```
    _(Note the negative scaling factor `-zoom` which flips the $Y$-axis so world $+Y$ points up)._

---

## 2. Multi-Tier Grid Hierarchy

The grid operates across 4 named levels defined in [`grid.ts`](file:///home/vinay-dhiman/problems/floor_mapping/grid-ui/src/geometry/grid.ts):

| Named Level  | Grid Size | Purpose                                                                                                                   |
| :----------- | :-------- | :------------------------------------------------------------------------------------------------------------------------ |
| **Level -1** | $2a$      | Coarse major grid lines (visualization emphasis).                                                                         |
| **Level 0**  | $a$       | Base floor unit (working floor dimensions = $\text{cols} \cdot a \times \text{rows} \cdot a$).                            |
| **Level 1**  | $a / 4$   | Placement grid (items snap to $a/4$ cell boundaries when dropped).                                                        |
| **Level 2**  | $a / 16$  | **Finest resolution grid**. All storage coordinates (`origin`, `widthCells`, `heightCells`) are saved in units of $a/16$. |

### 2.1 Finest Grid Storage Math

- 1 Base Unit $a = 16$ Finest Cells.
- 1 Placement Cell $(a/4) = 4$ Finest Cells (`FINEST_PER_PLACE = 4`).
- Floor size in finest cells:
  $$\text{finestCols} = \text{floor.cols} \times 16$$
  $$\text{finestRows} = \text{floor.rows} \times 16$$

---

## 3. Zooming & Panning Engine

### 3.1 Fixed Anchor Zooming (`zoomAround`)

When a user zooms using the mouse wheel, the point under the mouse cursor must remain stationary on screen (CAD / Figma style zooming).

- **Algorithm**:
    1. Given current `viewport`, zoom multiplier `factor`, and screen cursor anchor point $(A_x, A_y)$.
    2. Compute world point under cursor before zoom:
       $$W = \text{screenToWorld}(A, \text{viewport})$$
    3. Calculate new zoom level:
       $$\text{newZoom} = \text{viewport.zoom} \times \text{factor}$$
    4. Compute updated pan offsets to keep $W$ fixed at screen position $A$:
       $$\text{panX} = A_x - W_x \cdot \text{newZoom}$$
       $$\text{panY} = A_y + W_y \cdot \text{newZoom}$$

### 3.2 Viewport Boundary Clamping (`clampViewportToFirstQuadrant`)

Prevents the camera from panning into negative void space past the bottom-left axis gutter:
$$\text{panX} \le \text{AXIS\_GUTTER\_PX}$$
$$\text{panY} \ge \text{svgHeight} - \text{AXIS\_GUTTER\_PX}$$

### 3.3 Dynamic Adaptive Grid Levels (`getGridLevel`)

As the user zooms in or out, the active visible grid level adjusts automatically so grid lines do not become overly dense or invisible:

- Selects the finest named grid level where cell size in screen pixels $\ge 24\text{px}$.

---

## 4. Document Persistence & JSON Schema (`FloorDocument` v2)

Floor plans are saved and restored as JSON documents formatted according to `FloorDocument` v2 ([`drafts.ts`](file:///home/vinay-dhiman/problems/floor_mapping/grid-ui/src/lib/drafts.ts)).

### 4.1 Schema Specification

```typescript
export type FloorDocument = {
	version: 2;
	name?: string;
	savedAt?: string;
	a: number; // Base unit size (1.0)
	floor: {
		cols: number; // Number of base level-0 columns
		rows: number; // Number of base level-0 rows
		a: number;
	};
	entities: Entity[];
	zones: FloorZone[];
	customLibrary: CustomLibraryEntry[];
	unusableRegions?: UnusableRegion[];
	viewport?: Viewport;
	theme?: "dark" | "light";
};
```

### 4.2 Entity Mapping Schema (`Entity`)

Every placed furniture item or custom polygon is stored inside `doc.entities`:

```typescript
export type Entity = {
	objectId: string; // Unique string ID e.g. "computer-187xp6kg"
	category: string; // e.g. "workstation"
	elementType: string; // Catalog type key e.g. "computer"
	origin: {
		// Origin in finest (a/16) cells
		col: number;
		row: number;
	};
	widthCells: number; // Width in finest (a/16) cells
	heightCells: number; // Height in finest (a/16) cells
	rotation?: 0 | 90 | 180 | 270; // CCW Rotation degrees
	color?: string; // Render fill / accent color
	label?: string; // Display text
	svg?: string; // Asset graphic filename
	cells?: GridCell[]; // Relative (a/16) cells for freeform custom polygons
	svgPath?: string; // Pre-computed SVG path boundary string
	fontSize?: number; // Label font scale factor
};
```

### 4.3 JSON Export & Loading Workflow

1. **Sanitization (`sanitizeDocument`)**: Strip deprecated fields (`subdivision`, legacy `unusableCells`).
2. **Normalization (`normalizeUnusableRegions`)**: Converts legacy v1 `unusableCells` array into structured `UnusableRegion` objects.
3. **Draft Storage (`saveDraft` / `loadDraft`)**: Persists up to 40 floor plan snapshots in browser `localStorage` under `floor-planner-drafts-v2`.
4. **Download JSON (`downloadFloorJson`)**: Serializes sanitized JSON and triggers a browser blob download (`.json`).

---

## 5. Entity Operations & Geometry Math

### 5.1 Hit Testing (`hitTestEntity`)

- Iterates backward through `entities` array (top-to-bottom visual order).
- **Rectangular Entities**: Tests if world point $(x, y)$ falls within entity bounds rect.
- **Polygon Entities**: Translates world point to relative finest cell $(col, row)$ and checks if cell is present in `entity.cells`.

### 5.2 90° Counter-Clockwise Rotation (`rotateEntity90CCW`)

- **Rectangles**: Swaps `widthCells` and `heightCells`, adjusting origin around bounding center $(C_x, C_y)$:
  $$\text{newWidth} = \text{oldHeight}, \quad \text{newHeight} = \text{oldWidth}$$
  $$\text{newOrigin.col} = \text{round}(C_x - \text{newWidth} / 2)$$
  $$\text{newOrigin.row} = \text{round}(C_y - \text{newHeight} / 2)$$
- **Polygons**: Transforms relative cell coordinates $(c, r)$ via:
  $$c' = r, \quad r' = w - 1 - c$$
  Re-normalizes coordinates and recalculates the outline SVG path using [`cellsToSvgPath`](file:///home/vinay-dhiman/problems/floor_mapping/grid-ui/src/geometry/footprint.ts).

### 5.3 Boundary Tracing Algorithm (`outlineGridCells`)

Generates a clean vector boundary string around arbitrary contiguous finest grid cells:

1. Constructs directed square edges for every cell.
2. Cancels shared internal edges (edges with duplicate counter-directional entries).
3. Connects remaining outer edges in perimeter order to construct closed polygon vertices.
4. Generates an SVG path string (`M x0,y0 L x1,y1 ... Z`).

---

## 6. Selection, Drawing & Interaction Modes

### 6.1 Placement Mode

- Snaps mouse cursor world position to $a/4$ placement grid using `worldToPlacementFinest`.
- Displays interactive placement ghost preview.

### 6.2 Polygon Drawing Mode

- Users can click-and-drag across cells to form multi-cell polygons.
- Formed polygons can be converted into **Zones**, **Unusable Regions**, or saved into **Custom Furniture Palette** (`SavePolygonDialog`).

### 6.3 Resizing Handles (`ResizeHandles.tsx`)

- Renders bounding-box handles (N, S, E, W, NE, NW, SE, SW).
- Dragging handles scales entity dimensions while enforcing minimum 1 finest cell constraint.
- Polygon entities scale internal cells proportionally (`resizePolygonEntity`).

---

## 7. High-Resolution Export Engine

Defined in [`export.ts`](file:///home/vinay-dhiman/problems/floor_mapping/grid-ui/src/lib/export.ts):

### 7.1 Export Formats

1. **SVG Export (`exportSvg`)**: Clones live DOM SVG tree, strips UI overlay elements (selection marquees, handles, highlights), injects grid lines, bakes inline theme colors, and serializes XML string.
2. **PNG Export (`exportPng`)**: Rasterizes full-floor SVG onto an off-screen HTML5 `<canvas>` element at 24 pixels per world unit resolution (capped at 8000px max edge) and outputs PNG data URL.
3. **PDF Export (`exportPdf`)**: Generates an A4 PDF document using `jsPDF`, scaling the rasterized floor preview to fit page dimensions with standard margins.

---

## 8. State History (Undo / Redo)

Managed via custom hook [`useHistory`](file:///home/vinay-dhiman/problems/floor_mapping/grid-ui/src/hooks/useHistory.ts):

- Stores undo/redo state stacks of `FloorDocument`.
- Implements `undo()` and `redo()` with keyboard shortcuts (`Ctrl+Z`, `Ctrl+Y` / `Cmd+Shift+Z`).

---

## 9. Summary of Key File Locations

- **Document Types & Schemas**: [`drafts.ts`](file:///home/vinay-dhiman/problems/floor_mapping/grid-ui/src/lib/drafts.ts), [`geometry.ts`](file:///home/vinay-dhiman/problems/floor_mapping/grid-ui/src/types/geometry.ts)
- **Coordinate & Camera Math**: [`coordinates.ts`](file:///home/vinay-dhiman/problems/floor_mapping/grid-ui/src/geometry/coordinates.ts)
- **Grid Hierarchy**: [`grid.ts`](file:///home/vinay-dhiman/problems/floor_mapping/grid-ui/src/geometry/grid.ts)
- **Entity Geometry & Polygon Algorithms**: [`entities.ts`](file:///home/vinay-dhiman/problems/floor_mapping/grid-ui/src/geometry/entities.ts), [`footprint.ts`](file:///home/vinay-dhiman/problems/floor_mapping/grid-ui/src/geometry/footprint.ts)
- **Export Pipeline**: [`export.ts`](file:///home/vinay-dhiman/problems/floor_mapping/grid-ui/src/lib/export.ts)
- **Main Canvas Editor UI**: [`FloorEditor.tsx`](file:///home/vinay-dhiman/problems/floor_mapping/grid-ui/src/components/FloorEditor.tsx)
