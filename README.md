## DESK-IT
# Workspace Management System
## Complete AI Handoff Specification

---

# 1. Executive Summary

Build an **office workspace mapping and seating-management platform** with a visual interaction model inspired by:

- Canva/Figma-style 2D editors
- Pudone Office Seating Planner
- Arcada Planner-style floor-plan editors

The system consists of:

```text
                 WORKSPACE MANAGEMENT SYSTEM
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
      FRONTEND 1                  FRONTEND 2
   Workspace Mapper              Workspace Viewer
       / Editor                    / Manager
              │                         │
              │ Layout JSON             │ consumes JSON
              └────────────┬────────────┘
                           ▼
                        BACKEND
                           │
                           ▼
                       DATABASE
```

The most important foundation is **not the UI itself**.

The foundation is a **mathematical, hierarchical, discrete spatial model**.

The mapper frontend edits this model.

The backend persists this model.

The viewer frontend renders this model.

---

# 2. Product Goals

The eventual application should allow an organization to:

- Define office dimensions.
- Define a base spatial unit `a`.
- Build an office floor plan using grid cells.
- Use configurable hierarchical precision.
- Create arbitrary grid-aligned shapes.
- Draw walls and partitions.
- Add desks, seats, plants, rooms and structural objects.
- Zoom and pan smoothly.
- Move and resize objects.
- Rotate objects only by 90° increments.
- Save and load the complete floor plan.
- Publish approved plans.
- Allow HR to assign employees to seats.
- Allow employees to view the workspace.
- Search for employees and locate their seats.
- Visualize teams/zones.
- Track seating changes.
- Support multiple floors.
- Support layout version history.

---

# 3. Most Important Architectural Principle

The system must maintain a strict separation between:

```text
PHYSICAL / LOGICAL WORLD
        and
FRONTEND PRESENTATION
```

The backend stores the **logical world**.

The frontend manages:

- rendering,
- camera,
- zoom,
- pan,
- selection,
- interaction,
- UI state.

The backend must NOT depend on:

- Konva
- browser pixels
- canvas pixels
- screen dimensions
- viewport dimensions
- mouse coordinates
- current zoom
- current pan
- selection state
- hover state

---

# 4. Two Frontends

## Frontend 1 — Workspace Mapper

Used by Admin.

Responsibilities:

- Define office dimensions.
- Configure the grid.
- Map the physical office.
- Create/edit area geometry.
- Draw walls.
- Add physical objects.
- Select cells.
- Move/resize objects.
- Rotate objects.
- Delete objects.
- Undo/redo.
- Save draft.
- Publish.
- Manage multiple floors.

Technology:

```text
React
TypeScript
Vite
React-Konva / Konva
Zustand
```

---

# 5. Frontend 2 — Workspace Viewer / Manager

Used by:

```text
Admin
HR
Employees
```

according to role.

Responsibilities:

- Load published floor plan.
- Render floor plan using Konva.
- Zoom.
- Pan.
- Display seats.
- Display employees.
- Show team colors.
- Hover employee details.
- Search employee.
- Locate employee's seat.
- HR seat assignment/movement.

Technology:

```text
React
TypeScript
React-Konva
Zustand or React Query
```

---

# 6. User's Initial Workflow

The user starts with the physical office.

Example:

```text
Length  = 50
Breadth = 30
Unit    = meter
```

Then the user defines the reference spatial unit:

```text
a = 1 meter
```

The logical office is therefore:

```text
50a × 30a
```

The mapper then lets the user construct the floor layout on the grid.

---

# 7. `a` Is the Reference / Middle Level

`a` is NOT the smallest unit and NOT the largest unit.

It is the reference resolution.

The grid supports levels on both sides of it.

Example:

```text
                 coarser
                    ↑

Level -N
Level ...
Level -2
Level -1
Level  0 = a      ← reference
Level +1
Level +2
Level +3
...
Level +N

                    ↓
                   finer
```

The number of levels must be configurable.

Do NOT hard-code only five levels.

---

# 8. Configurable Hierarchical Grid

Use a configurable subdivision factor.

Recommended initial factor:

```text
subdivisionFactor = 2
```

This means one cell becomes:

```text
2 × 2 = 4 child cells
```

at the next finer level.

Therefore:

```text
a
 ↓
a/2
 ↓
a/4
 ↓
a/8
 ↓
a/16
 ↓
...
```

and moving outward:

```text
a
 ↓
2a
 ↓
4a
 ↓
8a
 ↓
16a
 ↓
...
```

The number of levels is configurable.

---

# 9. General Mathematical Formula

Let:

```text
a = reference cell size
b = subdivision factor
L = logical level
```

where:

```text
L = 0
```

represents `a`.

Then:

```text
cellSize(L) = a × b^(-L)
```

For the recommended initial configuration:

```text
b = 2
```

therefore:

```text
L = -2 → 4a
L = -1 → 2a
L =  0 → a
L = +1 → a/2
L = +2 → a/4
L = +3 → a/8
L = +4 → a/16
...
```

The formula must support any configurable integer subdivision factor greater than 1.

---

# 10. Default Level

When a new workspace opens:

```text
currentLogicalLevel = 0
```

Therefore the user starts at:

```text
a
```

The user can move to coarser or finer levels.

The exact UI mechanism can be decided by the implementation agent, but logical level should remain distinct from camera zoom.

---

# 11. IMPORTANT: Logical Level vs Camera Zoom

These are independent.

## Logical level

Controls spatial resolution.

Example:

```text
Level 0 = a
Level +1 = a/2
Level +2 = a/4
```

## Camera zoom

Controls visual magnification.

Example:

```text
25%
50%
100%
175%
300%
800%
```

Camera zoom is continuous.

Logical resolution is discrete/configurable.

Example valid state:

```text
Logical level = +3
Camera zoom   = 175%
```

Do not use camera zoom as a replacement for logical resolution.

---

# 12. Grid Coordinates

The fundamental grid coordinate is:

```text
(level, x, y)
```

Example:

```json
{
  "level": 2,
  "x": 137,
  "y": 82
}
```

This means:

> Cell `(137,82)` at logical level `+2`.

Coordinate orientation:

```text
(0,0)
   ─────────→ X
   │
   │
   ↓
   Y
```

---

# 13. Parent/Child Relationship

With subdivision factor `b`, a parent cell:

```text
(level, x, y)
```

has:

```text
b × b
```

children.

For `b = 2`:

```text
(level + 1, 2x,     2y)
(level + 1, 2x + 1, 2y)
(level + 1, 2x,     2y + 1)
(level + 1, 2x + 1, 2y + 1)
```

For generalized factor `b`:

```text
(level + 1,
 b*x + dx,
 b*y + dy)
```

where:

```text
dx ∈ [0, b-1]
dy ∈ [0, b-1]
```

Parent/child relations should be derivable mathematically.

Do not require parent IDs unless later performance analysis proves they are useful.

---

# 14. Atomic Cell Rule

The system uses **discrete geometry**.

An object may occupy:

```text
1 complete cell
2 complete cells
N complete cells
```

It may never occupy:

```text
half a cell
quarter of a cell
arbitrary fraction of a cell
```

Every editable area must align to grid boundaries.

At the finest supported level, a cell is the smallest drawable spatial unit.

---

# 15. Arbitrary Shape Support

The mapper should support shapes such as:

```text
Rectangle
L
T
U
C
Irregular grid-aligned regions
```

Do NOT create specialized geometry types such as:

```text
TShape
LShape
UShape
```

Instead:

> Any shape is a set of complete occupied cells.

Example:

```text
XXX
X
X
```

can be represented by:

```json
[
  [0,0],
  [1,0],
  [2,0],
  [0,1],
  [0,2]
]
```

This provides arbitrary grid-aligned shapes without special geometry code.

---

# 16. Sparse Representation

Do NOT persist a giant dense matrix as the canonical backend representation.

Bad:

```text
0 0 0 0 0 0 ...
0 0 1 1 0 0 ...
0 1 1 1 0 0 ...
...
```

Instead, store only occupied cells.

Conceptually:

```text
Set<GridCell>
```

or equivalent sparse database records.

This is particularly important because a large office at deep levels could contain hundreds of thousands or millions of theoretical cells.

---

# 17. Area Geometry

Area-like objects use occupied cells.

Examples:

- Workspace area
- Room
- Seat
- Desk
- Plant
- Zone

Canonical geometry:

```typescript
interface GridCell {
    level: number;
    x: number;
    y: number;
}
```

Area:

```typescript
interface CellGeometry {
    type: "CELLS";
    level: number;
    cells: GridCell[];
}
```

---

# 18. Polygon Generation

The frontend mapper can derive polygon boundaries from occupied cells.

Pipeline:

```text
Occupied Cells
      ↓
Find exposed edges
      ↓
Discard internal edges
      ↓
Join contiguous edges
      ↓
Trace boundary
      ↓
Polygon vertices
```

Example:

```text
XXX
X
X
```

becomes a grid-aligned polygon.

Important principle:

```text
cells
  =
source of truth

polygon
  =
derived geometry
```

The polygon should not be the authoritative editing representation for grid-based areas.

---

# 19. Polygon Export

The serialized model can include both:

```text
cells
polygon
```

if useful.

Purpose:

### `cells`

Used for:

- Editing
- Subdivision
- Collision
- Validation
- Exact spatial reconstruction

### `polygon`

Used for:

- Rendering
- Viewer
- Fast display
- Export/print

Polygon can always be regenerated from cells.

This makes the system resilient to polygon-generation changes.

---

# 20. Walls and Linear Geometry

Walls are fundamentally different from areas.

Wall:

```text
(2,2) → (5,2)
```

should be stored as a polyline:

```json
{
  "type": "WALL",
  "points": [
    [2,2],
    [5,2]
  ]
}
```

L-shaped wall:

```json
{
  "type": "WALL",
  "points": [
    [2,2],
    [2,5],
    [6,5]
  ]
}
```

Walls should initially be grid aligned.

No arbitrary fractional/off-grid points in V1.

---

# 21. Geometry Categories

The physical model can be thought of as:

```text
Geometry
│
├── Area
│    ├── Workspace
│    ├── Room
│    ├── Seat
│    ├── Desk
│    └── Plant
│
└── Line
     ├── Wall
     ├── Partition
     └── Boundary
```

Future point/marker objects such as doors can be introduced as needed.

---

# 22. Rotation

Objects can rotate only by:

```text
0°
90°
180°
270°
```

No arbitrary angles for V1.

Rotation is controlled by the frontend.

Konva can apply:

```text
<Group rotation={rotation}>
```

or equivalent.

The backend does not calculate the rotation.

If persistence is needed, the frontend sends the rotation value and the backend simply stores it.

Important distinction:

```text
Backend stores rotation
```

does NOT mean:

```text
Backend calculates rotation
```

---

# 23. Geometry + Transform

Keep these separate.

Example:

```json
{
  "geometry": {
    "type": "CELLS",
    "level": 0,
    "cells": [
      [0,0],
      [1,0],
      [2,0],
      [0,1],
      [0,2]
    ]
  },

  "transform": {
    "x": 10,
    "y": 5,
    "rotation": 90
  }
}
```

Geometry means:

> What is the object?

Transform means:

> Where is it and how is it oriented?

---

# 24. Coordinate Systems

The implementation must explicitly distinguish:

```text
Logical/Grid Coordinates
        ↓
World Coordinates
        ↓
Screen Coordinates
```

Example:

```text
Logical:
(level=0, x=10, y=20)

        ↓

World:
based on a and logical level

        ↓

Screen:
world × cameraZoom + cameraPan
```

Core utilities:

```text
gridToWorld()
worldToGrid()

worldToScreen()
screenToWorld()
```

These should be centralized in the geometry layer.

---

# 25. Camera Mathematics

The renderer should conceptually use:

```text
screenX = worldX * zoom + cameraX
screenY = worldY * zoom + cameraY
```

Pan changes:

```text
cameraX
cameraY
```

Zoom changes:

```text
zoom
```

The world geometry itself does not change.

---

# 26. Zoom Behavior

Zoom should ideally be **cursor anchored**.

If the mouse is over a particular object/cell:

```text
Zoom in
```

should keep the zoom focus around that point.

Do not always zoom toward the screen center.

Recommended controls:

```text
[ - ]  100%  [ + ]
[ Fit ]
[ Reset ]
```

---

# 27. Pan Behavior

Support:

```text
Middle mouse drag
Right mouse drag
Space + drag
```

Optionally:

```text
Double-click empty canvas → recenter/reset
```

Pan only modifies the camera.

---

# 28. Grid Rendering

The grid is a frontend rendering concern.

The backend should NOT send every grid line.

The frontend calculates visible grid lines from:

```text
workspace dimensions
grid configuration
current level
viewport
camera zoom
camera position
```

Use multiple levels of visual detail.

For example:

```text
Far zoom
→ major grid only

Normal zoom
→ reference grid

Closer zoom
→ finer subdivision grid

Very close zoom
→ deepest visible supported grid
```

This is a rendering/LOD feature.

---

# 29. Grid Visibility

Allow:

```text
Show Grid
Hide Grid
```

Default:

```text
Show Grid = true
```

Optionally:

```text
Show Coordinates
Snap to Grid
```

---

# 30. Mapper Toolset

Initial tools:

```text
SELECT
AREA
WALL
SEAT
DESK
PLANT
ROOM
DELETE / ERASE
```

Later add the complete catalog.

---

# 31. Cell Selection

For an area tool:

User can:

```text
click a cell
```

or:

```text
click + drag across cells
```

Example:

```text
Start = (10,15)
End   = (14,18)
```

The editor determines the complete selected cell set.

The selection is visually highlighted before committing.

---

# 32. Object Creation

Example:

User selects:

```text
AREA
```

Then selects:

```text
XXX
X
X
```

The editor creates an Area object with those cells.

No arbitrary pixel coordinates.

---

# 33. Object Movement

Objects can move, but movement must respect the logical grid.

Dragging:

```text
screen coordinates
      ↓
world coordinates
      ↓
grid coordinates
      ↓
snap
```

Persist logical coordinates, not screen coordinates.

---

# 34. Object Resize

For V1, resizing is in whole grid cells.

Valid:

```text
3 × 2
4 × 2
4 × 3
```

Invalid:

```text
3.27 × 2.61
```

for grid-based objects.

---

# 35. Multi-Select

Support selecting multiple objects.

Moving or manipulating multiple objects must preserve grid alignment.

---

# 36. Duplicate / Copy / Paste

Eventually support:

```text
Ctrl/Cmd + C
Ctrl/Cmd + V
Ctrl/Cmd + X
Ctrl/Cmd + D
```

Duplicated objects should be placed on valid grid positions.

---

# 37. Delete

Support:

```text
Delete
Backspace
Toolbar Erase
```

Use undo rather than excessive confirmation dialogs.

---

# 38. Undo / Redo

Support:

```text
Ctrl/Cmd + Z
Ctrl/Cmd + Shift + Z
```

Operations include:

- Create
- Delete
- Move
- Resize
- Rotate
- Duplicate
- Possibly floor-level changes

Suggested history model:

```typescript
interface HistoryState<T> {
    past: T[];
    present: T;
    future: T[];
}
```

---

# 39. Mapper Editor State

Use Zustand or equivalent.

Example:

```typescript
interface EditorState {
    floors: FloorState[];

    activeFloorId: string;

    viewport: {
        x: number;
        y: number;
        zoom: number;
    };

    currentLevel: number;

    selectedObjectIds: string[];

    activeTool: EditorTool;

    snapGrid: number | null;

    showGrid: boolean;

    showCoordinates: boolean;
}
```

Viewport and interaction state are frontend-only.

---

# 40. Export State vs Editor State

This separation is mandatory.

## Editor State

Contains:

- Current tool
- Selection
- Hover
- Mouse position
- Temporary guides
- Viewport
- Undo/redo state
- UI preferences
- Konva interaction state

## Export State

Contains:

- Workspace dimensions
- Grid configuration
- Floors
- Objects
- Geometry
- Transform
- Walls
- Zones
- Labels
- Seat IDs
- Structural metadata

Only export-state data goes to backend.

---

# 41. Serialization

Implement:

```text
serializeFloorPlan()
```

Pipeline:

```text
Editor State
    ↓
Validation
    ↓
Remove UI-only state
    ↓
Normalize logical geometry
    ↓
Generate polygon representation if needed
    ↓
Generate stable JSON
    ↓
Send to backend
```

Serialization must be deterministic.

---

# 42. Deserialization

Implement:

```text
deserializeFloorPlan()
```

Pipeline:

```text
Backend JSON
    ↓
Validate
    ↓
Reconstruct editor state
    ↓
Reconstruct geometry
    ↓
Render in Konva
```

Must support:

```text
Save → Load → Save
```

without coordinate drift.

---

# 43. Example Canonical JSON

A possible first version:

```json
{
  "version": "1.0",

  "workspace": {
    "id": "office-001",

    "dimensions": {
      "length": 50,
      "breadth": 30,
      "unit": "meter"
    }
  },

  "grid": {
    "baseUnit": {
      "name": "a",
      "value": 1,
      "unit": "meter"
    },

    "referenceLevel": 0,

    "minLevel": -4,
    "maxLevel": 6,

    "subdivisionFactor": 2
  },

  "floors": [
    {
      "id": "floor-1",
      "name": "Ground Floor",

      "objects": [
        {
          "id": "area-001",

          "type": "AREA",

          "geometry": {
            "type": "CELLS",

            "level": 0,

            "cells": [
              [10,20],
              [11,20],
              [12,20],
              [10,21],
              [10,22]
            ]
          },

          "transform": {
            "x": 0,
            "y": 0,
            "rotation": 90
          },

          "label": "Engineering Zone"
        }
      ],

      "walls": [
        {
          "id": "wall-001",

          "geometry": {
            "type": "POLYLINE",

            "level": 0,

            "points": [
              [2,2],
              [5,2]
            ]
          },

          "properties": {
            "exterior": false
          }
        }
      ]
    }
  ]
}
```

`minLevel` and `maxLevel` are examples only. They must be configurable.

---

# 44. Mapper → Backend

The full save flow:

```text
              MAPPER FRONTEND
                     │
             User edits canvas
                     │
                     ▼
               Zustand State
                     │
                 Ctrl+S
                     │
                     ▼
          serializeFloorPlan()
                     │
                     ▼
               FloorPlan JSON
                     │
                     ▼
              Spring Boot API
                     │
                     ▼
                PostgreSQL
```

---

# 45. Backend → Viewer

The viewer flow:

```text
PostgreSQL
    ↓
Spring Boot
    ↓
FloorPlan JSON
    ↓
Viewer
    ↓
Geometry Engine
    ↓
Konva
```

Viewer does not need to know how the mapper originally created the shape.

It only needs to understand the floor-plan contract.

---

# 46. Why This Is Better Than Exporting the Matrix

The matrix is useful as an editing concept, but the final contract should represent:

```text
logical occupied cells
+
logical walls
+
object metadata
+
transform
```

A giant dense matrix is wasteful.

Polygon data alone is not enough for exact discrete editing.

Therefore the preferred representation is:

```text
Cells = canonical area geometry
Polygon = derived geometry
```

and:

```text
Points = canonical wall geometry
```

---

# 47. Frontend 2 Rendering

For areas:

```text
cells
 ↓
boundary extraction
 ↓
polygon
 ↓
world coordinates
 ↓
Konva
```

For walls:

```text
points
 ↓
world coordinates
 ↓
Konva Line
```

For seats:

```text
seat geometry
 ↓
Konva seat renderer
```

---

# 48. Viewer-Side Camera

Frontend 2 can have a completely different viewport:

```text
Mapper:
zoom = 400%

Viewer:
zoom = 80%
```

Both can render exactly the same logical office.

That is because:

```text
logical geometry
```

is independent of:

```text
camera state
```

---

# 49. Workspace Resizing

There are two completely separate things.

## Resize the viewport

Example:

```text
Browser:
1200 × 800
```

No layout data changes.

## Resize the logical workspace

Example:

```text
50a × 30a
```

becomes:

```text
80a × 40a
```

This is a genuine data modification.

Existing objects retain their logical coordinates.

Never scale all existing objects merely because the workspace becomes larger.

---

# 50. Fit-to-Screen

If the office is larger than the viewport:

```text
Calculate world bounds
        ↓
Calculate viewport bounds
        ↓
Calculate appropriate zoom
        ↓
Center the workspace
```

Do not mutate:

```text
object coordinates
object geometry
grid definition
```

---

# 51. Collision Detection

For cell-based areas:

```text
occupiedCells(A)
        ∩
occupiedCells(B)
```

If intersection is non-empty:

```text
collision
```

This is simpler and more reliable than arbitrary polygon collision for the grid geometry.

---

# 52. Future Business Layer

After the geometry editor is stable, add:

```text
Employee
Team
Seat
SeatAssignment
MovementHistory
```

Relationship:

```text
Employee
    ↓
SeatAssignment
    ↓
Seat
    ↓
Physical Workspace
```

Team remains independent:

```text
Employee
    ↓
Team
```

---

# 53. Employee Seating Rule

Changing an employee's seat does NOT change the physical geometry.

Example:

```text
Akash
Team = Engineering
Seat = A12
```

Move employee:

```text
Akash
Team = Engineering
Seat = B05
```

Only the assignment changes.

---

# 54. Team Visualization

Teams may have configurable colors.

Example:

```text
Engineering → Blue
Product     → Green
HR          → Yellow
Finance     → Orange
```

Colors are visual/business metadata.

They do not alter geometry.

---

# 55. Employee Hover

Occupied seat:

```text
Akash Sharma
Software Engineer
Engineering
Seat A12
```

Empty seat:

```text
Seat A12
Available
```

Employee information should preferably already exist on the client when rendering.

Do not make an API request on every hover.

---

# 56. Employee Search

Search:

```text
Akash
```

should:

```text
Find employee
    ↓
Find assignment
    ↓
Find seat
    ↓
Pan camera
    ↓
Highlight seat
    ↓
Show profile
```

---

# 57. HR Workflow

HR:

```text
Open published map
      ↓
Click seat
      ↓
Assign employee
      ↓
Save
```

HR can later:

- Assign
- Unassign
- Move employees
- Search employees
- View empty seats

---

# 58. Admin Workflow

Admin:

```text
Create/edit layout
      ↓
Save Draft
      ↓
Review
      ↓
Publish
```

Published plan becomes available to HR/Employees.

---

# 59. Multiple Floors

Support:

```text
Floor 1
Floor 2
Floor 3
...
```

Each floor has:

```text
its own geometry
its own objects
its own walls
its own zones
```

But all floors can share a workspace/grid configuration where appropriate.

---

# 60. Version History

Eventually:

```text
Floor Plan v1
Floor Plan v2
Floor Plan v3
```

Support:

```text
Restore previous version
```

Version history should be treated at the floor-plan/layout level.

---

# 61. Existing Arcada-Inspired Requirements

The mapper is conceptually inspired by Arcada Planner and should retain useful interactions from the existing frontend specification:

### Toolbar

- Select
- Wall
- Erase
- Floor Up
- Floor Down
- Delete Floor
- Snap Grid
- Labels
- Save
- Load
- Print
- Help

### Canvas

- Infinite/pannable feeling
- Visible grid
- Cursor-anchored zoom
- Right/middle mouse pan
- Space + drag
- Optional double-click reset/recenter
- Snap guides

### Selection

- Selection bounding box
- Resize handles
- Rotation control
- Floating properties bar

### Keyboard

```text
Escape
Ctrl/Cmd + S
Ctrl/Cmd + Z
Ctrl/Cmd + Shift + Z
Ctrl/Cmd + C
Ctrl/Cmd + V
Ctrl/Cmd + X
Delete
Backspace
```

The existing spec may be adapted where it conflicts with the discrete grid model.

---

# 62. Important Change from the Existing Arcada-Inspired Spec

The previous concept allowed:

```text
free rotation
pixel width
pixel height
arbitrary positions
```

The new mathematical workspace model changes this.

For V1:

```text
Rotation:
0/90/180/270

Position:
grid aligned

Size:
whole grid cells

Area shape:
complete grid cells

Wall:
grid-aligned vertices
```

This constraint is intentional.

---

# 63. Geometry Engine

Create a standalone geometry module that has no dependency on React or Konva.

Suggested responsibilities:

```text
coordinates.ts
grid.ts
subdivision.ts
polygon.ts
transform.ts
collision.ts
bounds.ts
```

Examples:

```text
gridToWorld()
worldToGrid()
parentCell()
childCells()
cellsToPolygon()
rotateGridCells()
getBounds()
checkCollision()
```

These should be unit-testable without a browser.

---

# 64. Rendering Layer

React-Konva should consume geometry-engine output.

Recommended conceptual structure:

```text
WorkspaceEditor
│
├── Toolbar
├── Sidebar
├── WorkspaceCanvas
│
└── Canvas
    │
    ├── GridLayer
    ├── MajorGridLayer
    ├── SubGridLayer
    ├── ObjectLayer
    ├── SelectionLayer
    └── OverlayLayer
```

---

# 65. Performance Requirements

The office may become large.

Do NOT:

- create millions of React components for invisible cells,
- send every grid line from backend,
- serialize empty cells,
- recalculate the entire workspace on every mouse movement unnecessarily.

Use:

```text
viewport culling
visible-grid calculation
Konva layers
batch drawing where appropriate
memoization
spatial indexing if later required
```

The implementation agent should profile before introducing unnecessary complexity.

---

# 66. Important Performance Consideration for Hierarchical Grids

Because levels can be configurable and potentially deep:

```text
a/2
a/4
a/8
a/16
a/32
a/64
...
```

do NOT materialize the entire hierarchy.

Only create/refine cells that are actually needed by geometry.

This is effectively a sparse hierarchical spatial structure.

A quadtree-like implementation may be useful internally, but the backend data contract does not have to expose a literal quadtree.

---

# 67. Potential Internal Representation

The implementation agent should evaluate whether to use:

```text
flat sparse cells
```

or:

```text
quadtree / hierarchical sparse structure
```

internally.

The API contract should remain stable regardless of which representation is chosen.

---

# 68. Do Not Automatically Assume Polygon Vertices Are Canonical

For grid-based areas:

```text
occupied cells → polygon
```

is deterministic.

Therefore polygon vertices can be regenerated.

Do not create two independent sources of truth that can diverge.

Preferred:

```text
Cells
  ↓
Polygon
```

rather than:

```text
Cells + Polygon independently editable
```

---

# 69. Rotation and Cell Geometry

Rotation should be treated as a transformation.

However, the implementation agent must explicitly handle the interaction between:

```text
local occupied cells
+
90° rotation
+
translation
+
grid snapping
```

After a rotation, the rendered footprint must remain grid aligned.

The agent should define the pivot/origin behavior carefully.

---

# 70. Open Technical Questions for the AI Agent

Before implementation, reason about:

1. Should object rotation be around the object's center, origin, or another grid anchor?
2. How should negative coordinates be handled?
3. Should the world allow coordinates outside the initial office boundary?
4. How should holes inside an occupied-cell shape be represented?
5. How should disconnected cell groups inside one object be treated?
6. Should a shape be allowed to span multiple logical levels?
7. Can adjacent objects exist at different levels?
8. What exactly happens when a parent cell is refined?
9. Should parent occupancy disappear when child occupancy is created?
10. Should partially refined areas be allowed?
11. How should polygon boundary extraction handle holes?
12. How should rotated objects interact with collision detection?
13. What should happen when an object is moved across levels?
14. Should walls have thickness, or should V1 model them as zero-width lines?
15. How should doors/openings interact with walls?
16. How should workspace resize work when an existing object is outside the new boundary?
17. What is the most efficient persistence strategy for very large sparse layouts?
18. Should polygon geometry be persisted or generated on demand?
19. How should the viewer cache large floor plans?
20. How should level-of-detail be chosen from camera zoom?

These should be resolved before locking the implementation details.

---

# 71. Recommended First Milestone

Do NOT build the complete system immediately.

First build a standalone mapper prototype:

```text
React
+
TypeScript
+
React-Konva
+
Zustand
```

with:

```text
Office dimensions
        ↓
Reference unit a
        ↓
Configurable hierarchical grid
        ↓
Default level = 0
        ↓
Visible grid
        ↓
Zoom
        ↓
Pan
        ↓
Grid coordinate conversion
        ↓
Cell selection
        ↓
Area creation
        ↓
Wall drawing
        ↓
Snap to grid
        ↓
Move
        ↓
Resize
        ↓
90° rotation
        ↓
Undo / Redo
        ↓
Serialization
        ↓
Deserialization
```

No employee or team functionality is needed for this milestone.

---

# 72. Milestone 1 Success Criteria

The first milestone passes when:

### Grid

- Grid is mathematically correct.
- `a` is the reference level.
- Number of hierarchy levels is configurable.
- Parent/child relationships are correct.
- Grid supports coarser and finer resolutions.
- Grid lines remain aligned after zoom/pan.

### Camera

- Zoom works.
- Zoom is cursor anchored.
- Pan works.
- Fit-to-screen works.
- Reset works.
- Camera changes do not modify logical geometry.

### Selection

- Single cell selection works.
- Rectangle/multi-cell selection works.
- Selection works correctly when zoomed/panned.
- Coordinate readout is accurate.

### Objects

- Area objects can be created from cells.
- Arbitrary shapes work.
- Walls can be created from grid vertices.
- Objects snap to grid.
- Objects can move.
- Objects can resize in cell units.
- Objects can rotate 90° at a time.
- Objects stay grid aligned.

### Persistence

- Editor can serialize.
- Editor can deserialize.
- Save/load preserves exact logical geometry.
- Save → load → save is deterministic.

---

# 73. Final Technology Direction

## Mapper

```text
React
TypeScript
Vite
React-Konva
Konva
Zustand
```

## Backend

```text
Java
Spring Boot
Spring Security
Spring Data JPA
PostgreSQL
```

## Optional future

```text
React Query
Spatial indexing
Caching
Object storage
```

Do not introduce unnecessary microservices during the first implementation.

---

# 74. Final Mental Model

The entire system should be understood as:

```text
                         USER
                           │
                           ▼
                  WORKSPACE MAPPER
                           │
                           ▼
                 HIERARCHICAL GRID
                           │
                    ┌──────┴──────┐
                    │             │
                  CELLS          WALLS
                    │             │
                    ▼             ▼
                 AREAS         POLYLINES
                    │             │
                    └──────┬──────┘
                           ▼
                    FLOOR-PLAN MODEL
                           │
                     serialize JSON
                           │
                           ▼
                        BACKEND
                           │
                       DATABASE
                           │
                       JSON API
                           │
                           ▼
                  WORKSPACE VIEWER
                           │
                    Geometry Engine
                           │
                           ▼
                        Konva
                           │
                           ▼
                   INTERACTIVE MAP
                           │
               ┌───────────┴───────────┐
               ▼                       ▼
            Employee                  Team
               │                       │
               └──────────┬────────────┘
                          ▼
                     Seat Assignment
```

---

# 75. Final Core Principle

The entire project should follow this rule:

> **The mapper creates a logical spatial model. The backend persists that model. The viewer renders that model.**

More specifically:

```text
GRID
    ↓
defines spatial resolution

CELLS
    ↓
define area occupancy

POINTS / POLYLINES
    ↓
define linear structures

POLYGONS
    ↓
derived rendering geometry

TRANSFORM
    ↓
frontend positioning/orientation

CAMERA
    ↓
frontend zoom/pan

BUSINESS DATA
    ↓
employees/teams/seat assignments
```

The system should remain mathematically stable regardless of:

```text
browser size
screen resolution
canvas size
zoom
pan
frontend implementation
Konva rendering scale
```

The logical floor plan must remain unchanged.

---

# 76. Guiding Principle for Future AI Agents

Before changing the architecture, always ask:

> Does this belong to the **logical spatial model**, the **geometry engine**, the **renderer/editor**, or the **business layer**?

Do not mix those concerns.

The most important contract is:

```text
Logical Floor Plan JSON
```

Everything else is an implementation detail around that contract.

The system should be designed so that another rendering technology could replace Konva in the future without requiring the backend database model to change.
