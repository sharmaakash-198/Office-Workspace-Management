/**
 * Editor state.
 *
 * Split deliberately into two halves that must never mix:
 *
 *   doc  - the logical floor plan. Undoable, serialized, sent downstream.
 *   ui   - camera, tool, selection, hover, clipboard. Never leaves the browser.
 *
 * Every document edit goes through `commit`, which snapshots the previous
 * document for undo. Snapshots are cheap because updates are structurally
 * shared: moving one object allocates a new entity, floor and document, and
 * reuses everything else.
 */

import { create } from 'zustand';
import type {
  Entity,
  EntityKind,
  FloorPlanDoc,
  GridCell,
  LibraryItem,
  Wall,
} from '../types/floorplan';
import type { EditorTool } from '../types/floorplan';
import type { Viewport } from '../types/viewport';
import { DEFAULT_VIEWPORT } from '../types/viewport';
import {
  absoluteCells,
  cloneEntity,
  footprintFromCells,
  rectCells,
  rotateEntity,
  translateEntity,
} from '../geometry/cells';
import { cloneWall, simplifyWallPoints, translateWall } from '../geometry/walls';
import {
  createEmptyDoc,
  createId,
  findFloor,
  addFloor as docAddFloor,
  duplicateFloor as docDuplicateFloor,
  moveFloor as docMoveFloor,
  removeFloor as docRemoveFloor,
  renameFloor as docRenameFloor,
  resizeWorkspace as docResizeWorkspace,
  setBaseUnit as docSetBaseUnit,
  setEntities,
  setWalls,
} from '../lib/document';
import { DEFAULT_ENTITY_LIBRARY } from '../lib/library';

const MAX_HISTORY = 50;

export type Theme = 'dark' | 'light';

export type Clipboard = {
  entities: Entity[];
  walls: Wall[];
};

export type EditorState = {
  doc: FloorPlanDoc;
  past: FloorPlanDoc[];
  future: FloorPlanDoc[];

  activeFloorId: string;
  viewport: Viewport;
  tool: EditorTool;
  placeItem: LibraryItem | null;
  selectedIds: string[];
  selectedWallIds: string[];
  selectedCells: GridCell[];
  cursorCell: GridCell | null;
  /** Vertices of the wall currently being drawn, if any. */
  wallDraft: GridCell[] | null;
  wallThickness: number;
  showGrid: boolean;
  snapEnabled: boolean;
  showCoordinates: boolean;
  theme: Theme;
  clipboard: Clipboard;
  library: LibraryItem[];
  customLibrary: LibraryItem[];
};

export type EditorActions = {
  commit: (fn: (doc: FloorPlanDoc) => FloorPlanDoc) => void;
  preview: (fn: (doc: FloorPlanDoc) => FloorPlanDoc) => void;
  commitPreview: (before: FloorPlanDoc) => void;
  undo: () => void;
  redo: () => void;
  loadDoc: (doc: FloorPlanDoc) => void;
  newDoc: () => void;

  setViewport: (next: Viewport | ((v: Viewport) => Viewport)) => void;
  setTool: (tool: EditorTool) => void;
  setPlaceItem: (item: LibraryItem | null) => void;
  setCursorCell: (cell: GridCell | null) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  toggleCoordinates: () => void;
  toggleTheme: () => void;
  setWallThickness: (thickness: number) => void;

  selectEntities: (ids: string[]) => void;
  toggleEntitySelection: (id: string) => void;
  selectWalls: (ids: string[]) => void;
  toggleWallSelection: (id: string) => void;
  setSelectedCells: (cells: GridCell[]) => void;
  clearSelection: () => void;

  setActiveFloor: (floorId: string) => void;
  addFloor: (name?: string) => void;
  duplicateActiveFloor: () => void;
  removeActiveFloor: () => void;
  renameFloor: (floorId: string, name: string) => void;
  moveActiveFloor: (direction: -1 | 1) => void;

  addEntity: (entity: Entity) => void;
  placeFromLibrary: (item: LibraryItem, at: GridCell, label?: string) => Entity | null;
  createAreaFromCells: (cells: GridCell[], kind: EntityKind, item?: LibraryItem) => void;
  updateEntity: (id: string, patch: Partial<Entity>) => void;
  updateWall: (id: string, patch: Partial<Wall>) => void;
  deleteSelection: () => void;
  deleteEntity: (id: string) => void;
  rotateSelection: (quarterTurns: number) => void;
  nudgeSelection: (dx: number, dy: number) => void;

  beginWall: (vertex: GridCell) => void;
  extendWall: (vertex: GridCell) => void;
  finishWall: () => void;
  cancelWall: () => void;

  copySelection: () => void;
  pasteAt: (cell: GridCell) => void;
  duplicateSelection: () => void;

  setLibraryColor: (id: string, color: string) => void;
  addCustomLibraryItem: (item: LibraryItem) => void;

  resizeWorkspaceCells: (width: number, height: number) => void;
  setBaseUnit: (a: number) => void;
};

export type EditorStore = EditorState & EditorActions;

function pushHistory(past: FloorPlanDoc[], entry: FloorPlanDoc): FloorPlanDoc[] {
  const next = [...past, entry];
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
}

const initialDoc = createEmptyDoc();

export const useEditorStore = create<EditorStore>((set, get) => ({
  doc: initialDoc,
  past: [],
  future: [],

  activeFloorId: initialDoc.floors[0].id,
  viewport: DEFAULT_VIEWPORT,
  tool: 'select',
  placeItem: null,
  selectedIds: [],
  selectedWallIds: [],
  selectedCells: [],
  cursorCell: null,
  wallDraft: null,
  wallThickness: 1,
  showGrid: true,
  snapEnabled: true,
  showCoordinates: true,
  theme: 'light',
  clipboard: { entities: [], walls: [] },
  library: DEFAULT_ENTITY_LIBRARY.map((i) => ({ ...i })),
  customLibrary: [],

  commit: (fn) =>
    set((s) => {
      const next = fn(s.doc);
      if (next === s.doc) return s;
      return { doc: next, past: pushHistory(s.past, s.doc), future: [] };
    }),

  preview: (fn) =>
    set((s) => {
      const next = fn(s.doc);
      return next === s.doc ? s : { doc: next };
    }),

  commitPreview: (before) =>
    set((s) =>
      before === s.doc ? s : { past: pushHistory(s.past, before), future: [] },
    ),

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return s;
      const previous = s.past[s.past.length - 1];
      return {
        doc: previous,
        past: s.past.slice(0, -1),
        future: [s.doc, ...s.future].slice(0, MAX_HISTORY),
        activeFloorId: previous.floors.some((f) => f.id === s.activeFloorId)
          ? s.activeFloorId
          : previous.floors[0].id,
        selectedIds: [],
        selectedWallIds: [],
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0];
      return {
        doc: next,
        past: pushHistory(s.past, s.doc),
        future: s.future.slice(1),
        activeFloorId: next.floors.some((f) => f.id === s.activeFloorId)
          ? s.activeFloorId
          : next.floors[0].id,
        selectedIds: [],
        selectedWallIds: [],
      };
    }),

  loadDoc: (doc) =>
    set({
      doc,
      past: [],
      future: [],
      activeFloorId: doc.floors[0].id,
      selectedIds: [],
      selectedWallIds: [],
      selectedCells: [],
      wallDraft: null,
    }),

  newDoc: () => {
    const doc = createEmptyDoc();
    get().loadDoc(doc);
  },

  setViewport: (next) =>
    set((s) => ({
      viewport: typeof next === 'function' ? next(s.viewport) : next,
    })),

  setTool: (tool) =>
    set((s) => ({
      tool,
      placeItem: tool === 'select' ? s.placeItem : null,
      wallDraft: tool === 'wall' ? s.wallDraft : null,
    })),

  setPlaceItem: (placeItem) => set({ placeItem, tool: placeItem ? 'select' : 'select' }),
  setCursorCell: (cursorCell) => set({ cursorCell }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  toggleCoordinates: () => set((s) => ({ showCoordinates: !s.showCoordinates })),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
  setWallThickness: (wallThickness) =>
    set({ wallThickness: Math.max(1, Math.round(wallThickness)) }),

  selectEntities: (ids) => set({ selectedIds: ids, selectedWallIds: [], selectedCells: [] }),
  toggleEntitySelection: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id],
      selectedCells: [],
    })),
  selectWalls: (ids) => set({ selectedWallIds: ids, selectedIds: [], selectedCells: [] }),
  toggleWallSelection: (id) =>
    set((s) => ({
      selectedWallIds: s.selectedWallIds.includes(id)
        ? s.selectedWallIds.filter((x) => x !== id)
        : [...s.selectedWallIds, id],
    })),
  setSelectedCells: (selectedCells) => set({ selectedCells }),
  clearSelection: () =>
    set({ selectedIds: [], selectedWallIds: [], selectedCells: [], wallDraft: null }),

  setActiveFloor: (activeFloorId) =>
    set({ activeFloorId, selectedIds: [], selectedWallIds: [], selectedCells: [] }),

  addFloor: (name) => {
    const { doc } = get();
    const result = docAddFloor(doc, name);
    set((s) => ({
      doc: result.doc,
      past: pushHistory(s.past, doc),
      future: [],
      activeFloorId: result.floor.id,
      selectedIds: [],
      selectedWallIds: [],
    }));
  },

  duplicateActiveFloor: () => {
    const { doc, activeFloorId } = get();
    const result = docDuplicateFloor(doc, activeFloorId);
    if (!result) return;
    set((s) => ({
      doc: result.doc,
      past: pushHistory(s.past, doc),
      future: [],
      activeFloorId: result.floor.id,
    }));
  },

  removeActiveFloor: () => {
    const { doc, activeFloorId } = get();
    const next = docRemoveFloor(doc, activeFloorId);
    if (next === doc) return;
    set((s) => ({
      doc: next,
      past: pushHistory(s.past, doc),
      future: [],
      activeFloorId: next.floors[0].id,
      selectedIds: [],
      selectedWallIds: [],
    }));
  },

  renameFloor: (floorId, name) => get().commit((d) => docRenameFloor(d, floorId, name)),

  moveActiveFloor: (direction) =>
    get().commit((d) => docMoveFloor(d, get().activeFloorId, direction)),

  addEntity: (entity) => {
    const floorId = get().activeFloorId;
    get().commit((d) => {
      const floor = findFloor(d, floorId);
      if (!floor) return d;
      return setEntities(d, floorId, [...floor.entities, entity]);
    });
    set({ selectedIds: [entity.id], selectedWallIds: [], selectedCells: [] });
  },

  placeFromLibrary: (item, at, label) => {
    const entity: Entity = {
      id: createId(item.kind),
      kind: item.kind,
      code: item.code,
      // Centre the footprint on the click, then keep it on integer cells.
      origin: {
        x: at.x - Math.floor(item.defaultSize.w / 2),
        y: at.y - Math.floor(item.defaultSize.h / 2),
      },
      size: { ...item.defaultSize },
      cells: item.cells ? item.cells.map((c) => ({ ...c })) : undefined,
      rotation: 0,
      label: label ?? item.label,
      color: item.color,
    };
    if (item.kind === 'text') entity.fontSize = item.defaultFontSize ?? 0.6;
    get().addEntity(entity);
    return entity;
  },

  createAreaFromCells: (cells, kind, item) => {
    const footprint = footprintFromCells(cells);
    if (!footprint) return;
    const entity: Entity = {
      id: createId(kind),
      kind,
      code: item?.code ?? 8,
      origin: footprint.origin,
      size: footprint.size,
      cells: footprint.cells,
      rotation: 0,
      label: item?.label ?? kind,
      color: item?.color,
    };
    get().addEntity(entity);
    set({ selectedCells: [] });
  },

  updateEntity: (id, patch) => {
    const floorId = get().activeFloorId;
    get().commit((d) => {
      const floor = findFloor(d, floorId);
      if (!floor) return d;
      return setEntities(
        d,
        floorId,
        floor.entities.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      );
    });
  },

  updateWall: (id, patch) => {
    const floorId = get().activeFloorId;
    get().commit((d) => {
      const floor = findFloor(d, floorId);
      if (!floor) return d;
      return setWalls(
        d,
        floorId,
        floor.walls.map((w) => (w.id === id ? { ...w, ...patch } : w)),
      );
    });
  },

  deleteSelection: () => {
    const { activeFloorId, selectedIds, selectedWallIds } = get();
    if (selectedIds.length === 0 && selectedWallIds.length === 0) return;
    const dropEntities = new Set(selectedIds);
    const dropWalls = new Set(selectedWallIds);
    get().commit((d) => {
      const floor = findFloor(d, activeFloorId);
      if (!floor) return d;
      const withEntities = setEntities(
        d,
        activeFloorId,
        floor.entities.filter((e) => !dropEntities.has(e.id)),
      );
      const updated = findFloor(withEntities, activeFloorId)!;
      return setWalls(
        withEntities,
        activeFloorId,
        updated.walls.filter((w) => !dropWalls.has(w.id)),
      );
    });
    set({ selectedIds: [], selectedWallIds: [] });
  },

  deleteEntity: (id) => {
    const floorId = get().activeFloorId;
    get().commit((d) => {
      const floor = findFloor(d, floorId);
      if (!floor) return d;
      const entities = floor.entities.filter((e) => e.id !== id);
      if (entities.length !== floor.entities.length) {
        return setEntities(d, floorId, entities);
      }
      return setWalls(
        d,
        floorId,
        floor.walls.filter((w) => w.id !== id),
      );
    });
    set((s) => ({
      selectedIds: s.selectedIds.filter((x) => x !== id),
      selectedWallIds: s.selectedWallIds.filter((x) => x !== id),
    }));
  },

  rotateSelection: (quarterTurns) => {
    const { activeFloorId, selectedIds } = get();
    if (selectedIds.length === 0) return;
    const ids = new Set(selectedIds);
    get().commit((d) => {
      const floor = findFloor(d, activeFloorId);
      if (!floor) return d;
      return setEntities(
        d,
        activeFloorId,
        floor.entities.map((e) => (ids.has(e.id) ? rotateEntity(e, quarterTurns) : e)),
      );
    });
  },

  nudgeSelection: (dx, dy) => {
    const { activeFloorId, selectedIds, selectedWallIds } = get();
    if (selectedIds.length === 0 && selectedWallIds.length === 0) return;
    const ids = new Set(selectedIds);
    const wallIds = new Set(selectedWallIds);
    get().commit((d) => {
      const floor = findFloor(d, activeFloorId);
      if (!floor) return d;
      const moved = setEntities(
        d,
        activeFloorId,
        floor.entities.map((e) => (ids.has(e.id) ? translateEntity(e, dx, dy) : e)),
      );
      const updated = findFloor(moved, activeFloorId)!;
      return setWalls(
        moved,
        activeFloorId,
        updated.walls.map((w) => (wallIds.has(w.id) ? translateWall(w, dx, dy) : w)),
      );
    });
  },

  beginWall: (vertex) => set({ wallDraft: [vertex], tool: 'wall' }),

  extendWall: (vertex) =>
    set((s) => {
      if (!s.wallDraft) return { wallDraft: [vertex] };
      const last = s.wallDraft[s.wallDraft.length - 1];
      if (last.x === vertex.x && last.y === vertex.y) return s;
      return { wallDraft: [...s.wallDraft, vertex] };
    }),

  finishWall: () => {
    const { wallDraft, activeFloorId, wallThickness } = get();
    if (!wallDraft || wallDraft.length < 2) {
      set({ wallDraft: null });
      return;
    }
    const points = simplifyWallPoints(wallDraft);
    if (points.length < 2) {
      set({ wallDraft: null });
      return;
    }
    const wall: Wall = {
      id: createId('wall'),
      points,
      thickness: wallThickness,
      exterior: false,
    };
    get().commit((d) => {
      const floor = findFloor(d, activeFloorId);
      if (!floor) return d;
      return setWalls(d, activeFloorId, [...floor.walls, wall]);
    });
    set({ wallDraft: null, selectedWallIds: [wall.id], selectedIds: [] });
  },

  cancelWall: () => set({ wallDraft: null }),

  copySelection: () => {
    const { doc, activeFloorId, selectedIds, selectedWallIds } = get();
    const floor = findFloor(doc, activeFloorId);
    if (!floor) return;
    const ids = new Set(selectedIds);
    const wallIds = new Set(selectedWallIds);
    set({
      clipboard: {
        entities: floor.entities.filter((e) => ids.has(e.id)).map((e) => cloneEntity(e, e.id)),
        walls: floor.walls.filter((w) => wallIds.has(w.id)).map((w) => cloneWall(w, w.id)),
      },
    });
  },

  pasteAt: (cell) => {
    const { clipboard, activeFloorId } = get();
    if (clipboard.entities.length === 0 && clipboard.walls.length === 0) return;

    // Align the clipboard's bounding-box corner to the paste target.
    let minX = Infinity;
    let minY = Infinity;
    for (const e of clipboard.entities) {
      minX = Math.min(minX, e.origin.x);
      minY = Math.min(minY, e.origin.y);
    }
    for (const w of clipboard.walls) {
      for (const p of w.points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
      }
    }
    if (!Number.isFinite(minX)) return;

    const dx = cell.x - minX;
    const dy = cell.y - minY;
    const entities = clipboard.entities.map((e) =>
      translateEntity(cloneEntity(e, createId(e.kind)), dx, dy),
    );
    const walls = clipboard.walls.map((w) =>
      translateWall(cloneWall(w, createId('wall')), dx, dy),
    );

    get().commit((d) => {
      const floor = findFloor(d, activeFloorId);
      if (!floor) return d;
      const withEntities = setEntities(d, activeFloorId, [...floor.entities, ...entities]);
      const updated = findFloor(withEntities, activeFloorId)!;
      return setWalls(withEntities, activeFloorId, [...updated.walls, ...walls]);
    });
    set({
      selectedIds: entities.map((e) => e.id),
      selectedWallIds: walls.map((w) => w.id),
      selectedCells: [],
    });
  },

  duplicateSelection: () => {
    const { doc, activeFloorId, selectedIds, selectedWallIds } = get();
    const floor = findFloor(doc, activeFloorId);
    if (!floor) return;
    const ids = new Set(selectedIds);
    const wallIds = new Set(selectedWallIds);
    // Offset by one cell so the copy is visible and clickable.
    const entities = floor.entities
      .filter((e) => ids.has(e.id))
      .map((e) => translateEntity(cloneEntity(e, createId(e.kind)), 1, -1));
    const walls = floor.walls
      .filter((w) => wallIds.has(w.id))
      .map((w) => translateWall(cloneWall(w, createId('wall')), 1, -1));
    if (entities.length === 0 && walls.length === 0) return;

    get().commit((d) => {
      const target = findFloor(d, activeFloorId);
      if (!target) return d;
      const withEntities = setEntities(d, activeFloorId, [...target.entities, ...entities]);
      const updated = findFloor(withEntities, activeFloorId)!;
      return setWalls(withEntities, activeFloorId, [...updated.walls, ...walls]);
    });
    set({
      selectedIds: entities.map((e) => e.id),
      selectedWallIds: walls.map((w) => w.id),
    });
  },

  setLibraryColor: (id, color) => {
    set((s) => ({
      library: s.library.map((i) => (i.id === id ? { ...i, color } : i)),
      customLibrary: s.customLibrary.map((i) => (i.id === id ? { ...i, color } : i)),
    }));
  },
  addCustomLibraryItem: (item) => set((s) => ({ customLibrary: [...s.customLibrary, item] })),

  resizeWorkspaceCells: (width, height) =>
    get().commit((d) => docResizeWorkspace(d, width, height)),

  setBaseUnit: (a) => get().commit((d) => docSetBaseUnit(d, a)),
}));

/* ------------------------------ selectors ------------------------------ */

export const selectActiveFloor = (s: EditorStore) =>
  findFloor(s.doc, s.activeFloorId) ?? s.doc.floors[0];

export const selectEntities = (s: EditorStore) => selectActiveFloor(s).entities;
export const selectWalls = (s: EditorStore) => selectActiveFloor(s).walls;
export const selectCanUndo = (s: EditorStore) => s.past.length > 0;
export const selectCanRedo = (s: EditorStore) => s.future.length > 0;

export const selectSelectedEntities = (s: EditorStore): Entity[] => {
  const ids = new Set(s.selectedIds);
  return selectActiveFloor(s).entities.filter((e) => ids.has(e.id));
};

export const selectSelectedWalls = (s: EditorStore): Wall[] => {
  const ids = new Set(s.selectedWallIds);
  return selectActiveFloor(s).walls.filter((w) => ids.has(w.id));
};

/** Occupied cell count on the active floor, shown in the status bar. */
export const selectOccupiedCellCount = (s: EditorStore): number => {
  let total = 0;
  for (const entity of selectActiveFloor(s).entities) {
    total += entity.cells ? entity.cells.length : entity.size.w * entity.size.h;
  }
  return total;
};

export { absoluteCells, rectCells };
