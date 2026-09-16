import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Entity, GridCell, LibraryItem } from '../types/floorplan';
import type { Point, Rect } from '../types/geometry';
import {
  clampZoomAround,
  fitFloorViewport,
  getViewportTransform,
  initialCloseUpViewport,
  minZoomToFitFloor,
  screenToWorld,
  worldToScreen,
  zoomAround,
} from '../geometry/coordinates';
import {
  getBaseUnit,
  getGridLevel,
  getLevelCellSize,
  getVisibleWorldBounds,
  worldRectFromPoints,
} from '../geometry/grid';
import {
  absoluteCells,
  cellRange,
  entityWorldBounds,
  footprintFromCells,
  resizeEntity,
  translateEntity,
  worldToCell,
  worldToVertex,
} from '../geometry/cells';
import { findCollisions } from '../geometry/collision';
import { constrainToAxis, findWallAt, translateWall } from '../geometry/walls';
import {
  useEditorStore,
  selectActiveFloor,
  selectCanRedo,
  selectCanUndo,
} from '../store/editorStore';
import { createId, findFloor, floorConfigOf, setEntities, setWalls } from '../lib/document';
import { loadDraft, saveDraft, type DraftDocument } from '../lib/drafts';
import { exportPdf, exportPng, exportSvg } from '../lib/export';
import {
  deserializeFloorPlan,
  deserializeFloorPlanFromString,
  serializeFloorPlan,
  serializeFloorPlanToString,
} from '../lib/serialization';
import { colorForEntity, nextCustomCode, nextCustomColor } from '../lib/library';
import type { ResizeHandle } from './ResizeHandles';
import FloorBoundary from './FloorBoundary';
import Grid from './Grid';
import CellHighlight from './CellHighlight';
import EntitiesLayer from './EntitiesLayer';
import WallsLayer from './WallsLayer';
import SelectionMarquee from './SelectionMarquee';
import SelectionActionMenu from './SelectionActionMenu';
import ResizeHandles from './ResizeHandles';
import EntityLibrary, { LIBRARY_DND_MIME } from './EntityLibrary';
import PropertiesPanel from './PropertiesPanel';
import Toolbar from './Toolbar';
import FloorSwitcher from './FloorSwitcher';
import HowToUseModal from './HowToUseModal';
import EntityContextPanel from './EntityContextPanel';

const ZOOM_FACTOR = 1.12;
const MAX_ZOOM = 400;
const CLICK_PX = 4;

/** Tools that drop a fixed-size object with a single click. */
const STAMP_TOOLS: Record<string, string> = {
  seat: 'seat',
  desk: 'desk',
  plant: 'plant',
};
/** Tools that build an object by dragging across cells. */
const PAINT_TOOLS: Record<string, string> = {
  area: 'area',
  room: 'room',
};

type DragMode =
  | {
      type: 'pan';
      startX: number;
      startY: number;
      panX: number;
      panY: number;
      worldAtStart: Point;
      shift: boolean;
    }
  | { type: 'marquee'; startWorld: Point; currentWorld: Point; additive: boolean }
  | { type: 'move'; startCell: GridCell; ids: string[]; wallIds: string[] }
  | { type: 'resize'; handle: ResizeHandle; entityId: string }
  | { type: 'paint'; startCell: GridCell; currentCell: GridCell }
  | null;

const FloorEditor: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const store = useEditorStore();
  const {
    doc,
    viewport,
    tool,
    placeItem,
    selectedIds,
    selectedWallIds,
    selectedCells,
    cursorCell,
    wallDraft,
    showGrid,
    snapEnabled,
    showCoordinates,
    theme,
    clipboard,
    cellClipboard,
    library,
    customLibrary,
    activeFloorId,
  } = store;

  const canUndo = useEditorStore(selectCanUndo);
  const canRedo = useEditorStore(selectCanRedo);
  const activeFloor = useEditorStore(selectActiveFloor);

  const [svgSize, setSvgSize] = useState({ width: 800, height: 600 });
  const [includeGridOnExport, setIncludeGridOnExport] = useState(true);
  const [howToOpen, setHowToOpen] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<Rect | null>(null);
  /** Show the Canva-style entity actions panel when entities are selected. */
  const [showEntityPanel, setShowEntityPanel] = useState(false);
  /** Pending text entity placement — shows an inline toast input instead of window.prompt(). */
  const [pendingTextPlacement, setPendingTextPlacement] = useState<{
    item: LibraryItem;
    cell: GridCell;
  } | null>(null);
  const [pendingTextValue, setPendingTextValue] = useState('Label');

  const dragRef = useRef<DragMode>(null);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const movedRef = useRef(false);
  const docBeforeDragRef = useRef(doc);
  const storeRef = useRef(store);
  storeRef.current = store;

  const floorConfig = useMemo(() => floorConfigOf(doc), [doc]);
  const a = doc.grid.a;
  const baseUnit = getBaseUnit(a);
  const gridLevel = getGridLevel(viewport.zoom, baseUnit);
  const gridCellSize = getLevelCellSize(gridLevel, baseUnit);
  /** Snap step measured in canonical cells. */
  const snapStep = snapEnabled ? Math.max(1, Math.round(gridCellSize / a)) : 1;
  const minZoom = minZoomToFitFloor(floorConfig, svgSize.width, svgSize.height);

  const allLibrary = useMemo(
    () => [...library, ...customLibrary],
    [library, customLibrary],
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedWallSet = useMemo(() => new Set(selectedWallIds), [selectedWallIds]);
  const selectedEntities = useMemo(
    () => activeFloor.entities.filter((e) => selectedSet.has(e.id)),
    [activeFloor, selectedSet],
  );
  const selectedWalls = useMemo(
    () => activeFloor.walls.filter((w) => selectedWallSet.has(w.id)),
    [activeFloor, selectedWallSet],
  );
  const collisions = useMemo(
    () => findCollisions(activeFloor.entities),
    [activeFloor.entities],
  );

  const snapCell = useCallback(
    (cell: GridCell): GridCell => {
      if (snapStep <= 1) return cell;
      return {
        x: Math.floor(cell.x / snapStep) * snapStep,
        y: Math.floor(cell.y / snapStep) * snapStep,
      };
    },
    [snapStep],
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Show context panel when entities become selected; hide when deselected.
  useEffect(() => {
    if (selectedIds.length > 0) setShowEntityPanel(true);
    else setShowEntityPanel(false);
  }, [selectedIds]);

  /**
   * Screen position used to anchor the entity context panel.
   *
   * worldToScreen maps:  screenY = -worldY * zoom + panY
   * → higher world Y   = smaller screen Y = visually higher on screen.
   *
   * So the TOPMOST screen edge of the selection is at MAX world Y.
   * We pin the panel there; the CSS transform then lifts it fully above
   * the selection bounding box with a small gap.
   */
  const entityPanelPos = useMemo(() => {
    if (!showEntityPanel || selectedEntities.length === 0) return null;
    let minX = Infinity, maxX = -Infinity;
    let maxY = -Infinity; // max world Y = top of screen
    for (const e of selectedEntities) {
      minX = Math.min(minX, e.origin.x * a);
      maxX = Math.max(maxX, (e.origin.x + e.size.w) * a);
      maxY = Math.max(maxY, (e.origin.y + e.size.h) * a);
    }
    // Horizontal centre, topmost screen edge of the selection.
    return worldToScreen({ x: (minX + maxX) / 2, y: maxY }, viewport);
  }, [showEntityPanel, selectedEntities, a, viewport]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSvgSize({ width, height });
    });
    ro.observe(el);
    const { width, height } = el.getBoundingClientRect();
    setSvgSize({ width, height });
    storeRef.current.setViewport(
      initialCloseUpViewport(floorConfigOf(storeRef.current.doc), width, height),
    );
    return () => ro.disconnect();
    // Runs once: the initial camera should not chase later document edits.
  }, []);

  const applyZoom = useCallback(
    (factor: number, anchor: Point) => {
      storeRef.current.setViewport((v) => {
        const next = zoomAround(v, factor, anchor);
        return clampZoomAround(next, next.zoom, anchor, minZoom, MAX_ZOOM);
      });
    },
    [minZoom],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      applyZoom(e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR, {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [applyZoom]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const touchDist = (touches: TouchList) =>
      Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY,
      );
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = {
          dist: touchDist(e.touches),
          zoom: storeRef.current.viewport.zoom,
        };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const mid = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top,
      };
      const desired = pinchRef.current.zoom * (touchDist(e.touches) / pinchRef.current.dist);
      storeRef.current.setViewport((v) =>
        clampZoomAround(v, desired, mid, minZoom, MAX_ZOOM),
      );
    };
    const onTouchEnd = () => {
      pinchRef.current = null;
    };
    svg.addEventListener('touchstart', onTouchStart, { passive: true });
    svg.addEventListener('touchmove', onTouchMove, { passive: false });
    svg.addEventListener('touchend', onTouchEnd);
    return () => {
      svg.removeEventListener('touchstart', onTouchStart);
      svg.removeEventListener('touchmove', onTouchMove);
      svg.removeEventListener('touchend', onTouchEnd);
    };
  }, [minZoom]);

  const clientToWorld = useCallback((clientX: number, clientY: number): Point => {
    const rect = svgRef.current!.getBoundingClientRect();
    return screenToWorld(
      { x: clientX - rect.left, y: clientY - rect.top },
      storeRef.current.viewport,
    );
  }, []);

  const clientToCell = useCallback(
    (clientX: number, clientY: number): GridCell =>
      worldToCell(clientToWorld(clientX, clientY), storeRef.current.doc.grid.a),
    [clientToWorld],
  );

  /* ------------------------------- placing ------------------------------ */

  const placeItemAt = useCallback((item: LibraryItem, cell: GridCell) => {
    const s = storeRef.current;
    if (item.kind === 'text') {
      // Show inline toast input instead of blocking window.prompt()
      setPendingTextPlacement({ item, cell });
      setPendingTextValue('Label');
      return;
    }
    s.placeFromLibrary(item, cell);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const itemId = e.dataTransfer.getData(LIBRARY_DND_MIME);
      if (!itemId) return;
      const s = storeRef.current;
      const item = [...s.library, ...s.customLibrary].find((i) => i.id === itemId);
      if (!item) return;
      placeItemAt(item, snapCell(clientToCell(e.clientX, e.clientY)));
    },
    [clientToCell, placeItemAt, snapCell],
  );

  /* ------------------------------ selection ----------------------------- */

  const hitTestEntity = useCallback(
    (world: Point): Entity | null => {
      const cell = worldToCell(world, a);
      const entities = activeFloor.entities;
      for (let i = entities.length - 1; i >= 0; i--) {
        const e = entities[i];
        if (e.kind === 'text') {
          const b = entityWorldBounds(e, a);
          if (
            world.x >= b.x &&
            world.x <= b.x + b.width &&
            world.y >= b.y &&
            world.y <= b.y + b.height
          ) {
            return e;
          }
          continue;
        }
        for (const c of absoluteCells(e)) {
          if (c.x === cell.x && c.y === cell.y) return e;
        }
      }
      return null;
    },
    [activeFloor.entities, a],
  );

  /* ------------------------------- pointer ------------------------------ */

  const handleEntityPointerDown = (id: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const s = storeRef.current;
    if (s.tool === 'delete') {
      e.stopPropagation();
      s.deleteEntity(id);
      return;
    }
    if (s.tool !== 'select' || s.placeItem) return;
    e.stopPropagation();

    let ids = s.selectedIds;
    if (e.shiftKey) {
      s.toggleEntitySelection(id);
      ids = s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id];
    } else if (!s.selectedIds.includes(id)) {
      ids = [id];
      s.selectEntities(ids);
    }

    movedRef.current = false;
    docBeforeDragRef.current = s.doc;
    dragRef.current = {
      type: 'move',
      startCell: clientToCell(e.clientX, e.clientY),
      ids,
      wallIds: s.selectedWallIds,
    };
  };

  const handleWallPointerDown = (id: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const s = storeRef.current;
    if (s.tool === 'delete') {
      e.stopPropagation();
      s.deleteEntity(id);
      return;
    }
    if (s.tool !== 'select') return;
    e.stopPropagation();

    if (e.shiftKey) s.toggleWallSelection(id);
    else if (!s.selectedWallIds.includes(id)) s.selectWalls([id]);

    movedRef.current = false;
    docBeforeDragRef.current = s.doc;
    dragRef.current = {
      type: 'move',
      startCell: clientToCell(e.clientX, e.clientY),
      ids: [],
      wallIds: s.selectedWallIds.includes(id) ? s.selectedWallIds : [id],
    };
  };

  const handleHandleDown = (handle: ResizeHandle) => {
    if (selectedEntities.length !== 1) return;
    movedRef.current = false;
    docBeforeDragRef.current = storeRef.current.doc;
    dragRef.current = { type: 'resize', handle, entityId: selectedEntities[0].id };
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const s = storeRef.current;
    const world = clientToWorld(e.clientX, e.clientY);
    const cell = worldToCell(world, s.doc.grid.a);
    movedRef.current = false;

    if (s.tool === 'wall' && e.button === 0) {
      const vertex = snapCell(worldToVertex(world, s.doc.grid.a));
      if (!s.wallDraft) s.beginWall(vertex);
      else {
        const last = s.wallDraft[s.wallDraft.length - 1];
        s.extendWall(constrainToAxis(last, vertex));
      }
      return;
    }

    if (s.tool === 'delete' && e.button === 0) {
      const wall = findWallAt(activeFloor.walls, world, s.doc.grid.a, s.doc.grid.a);
      if (wall) {
        s.deleteEntity(wall.id);
        return;
      }
      const hit = hitTestEntity(world);
      if (hit) s.deleteEntity(hit.id);
      return;
    }

    if (s.placeItem && e.button === 0 && !e.ctrlKey && !e.metaKey) {
      const hit = hitTestEntity(world);
      if (!hit) {
        // Empty canvas → stamp a new copy; keep the tool armed for more clicks.
        placeItemAt(s.placeItem, snapCell(cell));
        return;
      }
      // Clicked an existing entity → select + start a move drag (same as
      // handleEntityPointerDown, but that bails early when placeItem is set).
      let ids = s.selectedIds;
      if (e.shiftKey) {
        s.toggleEntitySelection(hit.id);
        ids = s.selectedIds.includes(hit.id)
          ? s.selectedIds.filter((x) => x !== hit.id)
          : [...s.selectedIds, hit.id];
      } else if (!s.selectedIds.includes(hit.id)) {
        ids = [hit.id];
        s.selectEntities(ids);
      }
      movedRef.current = false;
      docBeforeDragRef.current = s.doc;
      dragRef.current = {
        type: 'move',
        startCell: clientToCell(e.clientX, e.clientY),
        ids,
        wallIds: s.selectedWallIds,
      };
      return;
    }

    if (STAMP_TOOLS[s.tool] && e.button === 0) {
      const item = allLibrary.find((i) => i.kind === s.tool);
      if (item) placeItemAt(item, snapCell(cell));
      return;
    }

    if (PAINT_TOOLS[s.tool] && e.button === 0) {
      const start = snapCell(cell);
      dragRef.current = { type: 'paint', startCell: start, currentCell: start };
      s.setSelectedCells(cellRange(start, start));
      return;
    }

    // Middle-button or spacebar → always pan.
    if (e.button === 1 || spaceHeld) {
      e.preventDefault();
      dragRef.current = {
        type: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        panX: s.viewport.panX,
        panY: s.viewport.panY,
        worldAtStart: world,
        shift: e.shiftKey,
      };
      return;
    }

    // Ctrl/Meta + drag → additive marquee (works in any tool).
    // Select tool + left-button drag on empty space → rubber-band marquee.
    // This lets users drag a region over already-placed elements to select them.
    const hitEntity = hitTestEntity(world);
    const wallUnder = findWallAt(activeFloor.walls, world, s.doc.grid.a, s.doc.grid.a * 0.5);
    const wantMarquee =
      e.button === 0 &&
      (e.ctrlKey || e.metaKey || (s.tool === 'select' && !hitEntity && !wallUnder));

    if (wantMarquee) {
      dragRef.current = {
        type: 'marquee',
        startWorld: world,
        currentWorld: world,
        additive: e.shiftKey,
      };
      setMarqueeRect(worldRectFromPoints(world, world));
      return;
    }

    const wall = findWallAt(activeFloor.walls, world, s.doc.grid.a, s.doc.grid.a * 0.5);
    if (s.tool === 'select' && wall) {
      handleWallPointerDown(wall.id, e);
      return;
    }

    const wantPan = s.tool === 'pan' || (e.button === 0 && !hitTestEntity(world));

    if (wantPan) {
      e.preventDefault();
      dragRef.current = {
        type: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        panX: s.viewport.panX,
        panY: s.viewport.panY,
        worldAtStart: world,
        shift: e.shiftKey,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const s = storeRef.current;
    const world = clientToWorld(e.clientX, e.clientY);
    const cell = worldToCell(world, s.doc.grid.a);
    s.setCursorCell(cell);

    const drag = dragRef.current;
    if (!drag) return;

    if (drag.type === 'pan') {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.hypot(dx, dy) >= CLICK_PX) movedRef.current = true;
      s.setViewport((v) => ({ ...v, panX: drag.panX + dx, panY: drag.panY + dy }));
      return;
    }

    movedRef.current = true;

    if (drag.type === 'marquee') {
      drag.currentWorld = world;
      setMarqueeRect(worldRectFromPoints(drag.startWorld, world));
      return;
    }

    if (drag.type === 'paint') {
      drag.currentCell = snapCell(cell);
      s.setSelectedCells(cellRange(drag.startCell, drag.currentCell));
      return;
    }

    if (drag.type === 'move') {
      let dx = cell.x - drag.startCell.x;
      let dy = cell.y - drag.startCell.y;
      if (snapStep > 1) {
        dx = Math.round(dx / snapStep) * snapStep;
        dy = Math.round(dy / snapStep) * snapStep;
      }
      if (dx === 0 && dy === 0) return;
      const before = docBeforeDragRef.current;
      const floor = findFloor(before, s.activeFloorId);
      if (!floor) return;
      const ids = new Set(drag.ids);
      const wallIds = new Set(drag.wallIds);
      s.preview(() => {
        const moved = setEntities(
          before,
          s.activeFloorId,
          floor.entities.map((ent) => (ids.has(ent.id) ? translateEntity(ent, dx, dy) : ent)),
        );
        return setWalls(
          moved,
          s.activeFloorId,
          floor.walls.map((w) => (wallIds.has(w.id) ? translateWall(w, dx, dy) : w)),
        );
      });
      return;
    }

    if (drag.type === 'resize') {
      const before = docBeforeDragRef.current;
      const floor = findFloor(before, s.activeFloorId);
      const origin = floor?.entities.find((ent) => ent.id === drag.entityId);
      if (!floor || !origin) return;

      const vertex = worldToVertex(world, s.doc.grid.a);
      const step = Math.max(1, snapStep);
      const snapV = (v: number) => Math.round(v / step) * step;
      let x0 = origin.origin.x;
      let y0 = origin.origin.y;
      let x1 = x0 + origin.size.w;
      let y1 = y0 + origin.size.h;

      if (drag.handle.includes('e')) x1 = Math.max(x0 + step, snapV(vertex.x));
      if (drag.handle.includes('w')) x0 = Math.min(snapV(vertex.x), x1 - step);
      if (drag.handle.includes('n')) y1 = Math.max(y0 + step, snapV(vertex.y));
      if (drag.handle.includes('s')) y0 = Math.min(snapV(vertex.y), y1 - step);

      const next = resizeEntity(origin, { x: x0, y: y0 }, { w: x1 - x0, h: y1 - y0 });
      s.preview(() =>
        setEntities(
          before,
          s.activeFloorId,
          floor.entities.map((ent) => (ent.id === next.id ? next : ent)),
        ),
      );
    }
  };

  const handleMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    const s = storeRef.current;
    const drag = dragRef.current;
    dragRef.current = null;

    if (drag?.type === 'pan') {
      if (!movedRef.current && s.tool === 'select') {
        const cell = snapCell(worldToCell(drag.worldAtStart, s.doc.grid.a));
        if (!drag.shift) s.selectEntities([]);
        const existing = s.selectedCells;
        const key = `${cell.x},${cell.y}`;
        const has = existing.some((c) => `${c.x},${c.y}` === key);
        s.setSelectedCells(
          drag.shift
            ? has
              ? existing.filter((c) => `${c.x},${c.y}` !== key)
              : [...existing, cell]
            : [cell],
        );
      }
      return;
    }

    if (drag?.type === 'marquee') {
      const world = clientToWorld(e.clientX, e.clientY);
      setMarqueeRect(null);
      const minX = Math.min(drag.startWorld.x, world.x);
      const maxX = Math.max(drag.startWorld.x, world.x);
      const minY = Math.min(drag.startWorld.y, world.y);
      const maxY = Math.max(drag.startWorld.y, world.y);
      if (
        (maxX - minX) * s.viewport.zoom < CLICK_PX &&
        (maxY - minY) * s.viewport.zoom < CLICK_PX
      ) {
        // Treat as a single-cell click rather than a drag.
        const cell = snapCell(worldToCell(drag.startWorld, s.doc.grid.a));
        const key = `${cell.x},${cell.y}`;
        const has = s.selectedCells.some((c) => `${c.x},${c.y}` === key);
        if (!drag.additive) s.selectEntities([]);
        s.setSelectedCells(
          drag.additive
            ? has
              ? s.selectedCells.filter((c) => `${c.x},${c.y}` !== key)
              : [...s.selectedCells, cell]
            : [cell],
        );
        return;
      }
      const hit = activeFloor.entities.filter((ent) => {
        const b = entityWorldBounds(ent, s.doc.grid.a);
        return !(
          b.x + b.width < minX ||
          maxX < b.x ||
          b.y + b.height < minY ||
          maxY < b.y
        );
      });
      if (hit.length > 0) {
        const ids = hit.map((h) => h.id);
        s.selectEntities(
          drag.additive ? Array.from(new Set([...s.selectedIds, ...ids])) : ids,
        );
      } else {
        const from = worldToCell({ x: minX, y: minY }, s.doc.grid.a);
        const to = worldToCell({ x: maxX, y: maxY }, s.doc.grid.a);
        const cells = cellRange(from, to);
        s.setSelectedCells(drag.additive ? [...s.selectedCells, ...cells] : cells);
      }
      return;
    }

    if (drag?.type === 'paint') {
      const cells = cellRange(drag.startCell, drag.currentCell);
      const kind = s.tool === 'room' ? 'room' : 'area';
      const item = allLibrary.find((i) => i.kind === kind);
      s.createAreaFromCells(cells, kind, item);
      return;
    }

    if ((drag?.type === 'move' || drag?.type === 'resize') && movedRef.current) {
      s.commitPreview(docBeforeDragRef.current);
    }
  };

  const handleDoubleClick = () => {
    const s = storeRef.current;
    if (s.tool === 'wall' && s.wallDraft) s.finishWall();
  };

  /* ------------------------------ keyboard ------------------------------ */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const s = storeRef.current;
      const meta = e.ctrlKey || e.metaKey;
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';

      if (e.code === 'Space' && !e.repeat && !typing) {
        e.preventDefault();
        setSpaceHeld(true);
      }

      if (e.key === 'Escape') {
        s.clearSelection();
        s.setPlaceItem(null);
        s.setTool('select');
        dragRef.current = null;
        return;
      }

      if (e.key === 'Enter' && s.tool === 'wall' && s.wallDraft) {
        e.preventDefault();
        s.finishWall();
        return;
      }

      if (typing) return;

      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (meta && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        s.redo();
        return;
      }
      if (meta && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        if (e.shiftKey && s.selectedCells.length > 0) {
          // Ctrl+Shift+C → copy entities in selected cells
          s.copyCellEntities(s.selectedCells);
        } else {
          s.copySelection();
        }
        return;
      }
      if (meta && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        s.copySelection();
        s.deleteSelection();
        return;
      }
      if (meta && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        if (e.shiftKey && s.selectedCells.length > 0 && s.cellClipboard) {
          // Ctrl+Shift+V → paste cell entities at the selected cell bounding box origin
          const minX = Math.min(...s.selectedCells.map((c) => c.x));
          const minY = Math.min(...s.selectedCells.map((c) => c.y));
          s.pasteCellEntities({ x: minX, y: minY });
        } else {
          s.pasteAt(s.cursorCell ?? { x: 0, y: 0 });
        }
        return;
      }
      if (meta && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        s.duplicateSelection();
        return;
      }
      if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault();
        downloadJson();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        s.deleteSelection();
        return;
      }

      if (!meta && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        s.rotateSelection(e.shiftKey ? -1 : 1);
        return;
      }

      if (!meta) {
        const shortcuts: Record<string, () => void> = {
          v: () => s.setTool('select'),
          h: () => s.setTool('pan'),
          a: () => s.setTool('area'),
          w: () => s.setTool('wall'),
          s: () => s.setTool('seat'),
          d: () => s.setTool('desk'),
          p: () => s.setTool('plant'),
          e: () => s.setTool('delete'),
        };
        const action = shortcuts[e.key.toLowerCase()];
        if (action) {
          e.preventDefault();
          action();
          return;
        }
      }

      if (
        !meta &&
        (e.key === 'ArrowUp' ||
          e.key === 'ArrowDown' ||
          e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight')
      ) {
        e.preventDefault();
        const step = e.shiftKey ? Math.max(1, snapStep) * 4 : Math.max(1, snapStep);
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowDown' ? -step : e.key === 'ArrowUp' ? step : 0;
        s.nudgeSelection(dx, dy);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapStep]);

  /* --------------------------- persistence ----------------------------- */

  const downloadJson = useCallback(() => {
    const s = storeRef.current;
    const text = serializeFloorPlanToString(s.doc);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `floor-plan-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Floor plan JSON downloaded');
  }, []);

  const copyJson = useCallback(() => {
    void navigator.clipboard.writeText(
      serializeFloorPlanToString(storeRef.current.doc),
    );
    setNotice('Floor plan JSON copied to clipboard');
  }, []);

  const importJson = useCallback((text: string) => {
    try {
      storeRef.current.loadDoc(deserializeFloorPlanFromString(text));
      setNotice('Floor plan imported');
    } catch (error) {
      setNotice(
        `Import failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, []);

  const handleSaveDraft = (name: string) => {
    const s = storeRef.current;
    const draft: DraftDocument = {
      version: 2,
      name,
      savedAt: new Date().toISOString(),
      plan: serializeFloorPlan(s.doc),
      viewport: s.viewport,
      theme: s.theme,
    };
    saveDraft(draft);
    setNotice(`Draft "${name}" saved`);
  };

  const handleLoadDraft = (name: string) => {
    const draft = loadDraft(name);
    if (!draft) return;
    try {
      storeRef.current.loadDoc(deserializeFloorPlan(draft.plan));
      storeRef.current.setViewport(draft.viewport);
      setNotice(`Draft "${name}" loaded`);
    } catch (error) {
      setNotice(
        `Draft could not be loaded: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };

  const runExport = async (kind: 'png' | 'svg' | 'pdf') => {
    const svg = svgRef.current;
    if (!svg) return;
    const stamp = Date.now();
    if (kind === 'svg') exportSvg(svg, floorConfig, `floor-${stamp}.svg`, includeGridOnExport);
    if (kind === 'png')
      await exportPng(svg, floorConfig, `floor-${stamp}.png`, includeGridOnExport);
    if (kind === 'pdf')
      await exportPdf(svg, floorConfig, `floor-${stamp}.pdf`, includeGridOnExport);
  };

  /* ------------------------------ overlays ------------------------------ */

  const selectionMenuPos = useMemo(() => {
    if (selectedCells.length === 0) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const cell of selectedCells) {
      minX = Math.min(minX, cell.x * a);
      maxX = Math.max(maxX, (cell.x + 1) * a);
      maxY = Math.max(maxY, (cell.y + 1) * a);
    }
    const screen = worldToScreen({ x: (minX + maxX) / 2, y: maxY }, viewport);
    return { x: screen.x, y: screen.y };
  }, [selectedCells, a, viewport]);

  const axisLabels = useMemo(() => {
    if (!showCoordinates) return { xs: [], ys: [] };
    const bounds = getVisibleWorldBounds(viewport, svgSize.width, svgSize.height);
    const step = baseUnit;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let x = Math.ceil(bounds.minX / step) * step; x <= bounds.maxX; x += step) {
      xs.push(x);
    }
    for (let y = Math.ceil(bounds.minY / step) * step; y <= bounds.maxY; y += step) {
      ys.push(y);
    }
    return { xs: xs.slice(0, 40), ys: ys.slice(0, 40) };
  }, [viewport, svgSize, baseUnit, showCoordinates]);

  const cursorStyle =
    tool === 'pan' || spaceHeld
      ? 'grab'
      : placeItem || tool === 'wall' || PAINT_TOOLS[tool] || STAMP_TOOLS[tool]
        ? 'crosshair'
        : tool === 'delete'
          ? 'not-allowed'
          : 'default';

  const singleSelected = selectedEntities.length === 1 ? selectedEntities[0] : null;
  const hasSelection = selectedIds.length > 0 || selectedWallIds.length > 0;

  const wallDraftCursor =
    tool === 'wall' && wallDraft && wallDraft.length > 0 && cursorCell
      ? constrainToAxis(
          wallDraft[wallDraft.length - 1],
          snapCell({ x: cursorCell.x, y: cursorCell.y }),
        )
      : null;

  return (
    <div className="editor-layout">
      <Toolbar
        viewport={viewport}
        tool={tool}
        showGrid={showGrid}
        snapEnabled={snapEnabled}
        showCoordinates={showCoordinates}
        includeGridOnExport={includeGridOnExport}
        theme={theme}
        canUndo={canUndo}
        canRedo={canRedo}
        canPaste={clipboard.entities.length > 0 || clipboard.walls.length > 0}
        hasSelection={hasSelection}
        onTool={store.setTool}
        onZoomIn={() =>
          applyZoom(ZOOM_FACTOR, { x: svgSize.width / 2, y: svgSize.height / 2 })
        }
        onZoomOut={() =>
          applyZoom(1 / ZOOM_FACTOR, { x: svgSize.width / 2, y: svgSize.height / 2 })
        }
        onFitFloor={() =>
          store.setViewport(fitFloorViewport(floorConfig, svgSize.width, svgSize.height))
        }
        onResetView={() =>
          store.setViewport(
            initialCloseUpViewport(floorConfig, svgSize.width, svgSize.height),
          )
        }
        onToggleGrid={store.toggleGrid}
        onToggleSnap={store.toggleSnap}
        onToggleCoordinates={store.toggleCoordinates}
        onToggleExportGrid={() => setIncludeGridOnExport((g) => !g)}
        onToggleTheme={store.toggleTheme}
        onUndo={store.undo}
        onRedo={store.redo}
        onCopy={store.copySelection}
        onPaste={() => store.pasteAt(cursorCell ?? { x: 0, y: 0 })}
        onDuplicate={store.duplicateSelection}
        onRotate={store.rotateSelection}
        onDelete={store.deleteSelection}
        onHowToUse={() => setHowToOpen(true)}
        onSaveDraft={handleSaveDraft}
        onLoadDraft={handleLoadDraft}
        onExportPng={() => void runExport('png')}
        onExportSvg={() => void runExport('svg')}
        onExportPdf={() => void runExport('pdf')}
        onExportJson={downloadJson}
        onCopyJson={copyJson}
        onImportJson={importJson}
      />

      <div className="editor-body">
        <EntityLibrary
          items={library}
          customItems={customLibrary}
          activeId={placeItem?.id ?? null}
          a={a}
          onSelect={(item) =>
            store.setPlaceItem(placeItem?.id === item.id ? null : item)
          }
          onColorChange={store.setLibraryColor}
        />

        <div className="editor-canvas-container" ref={containerRef}>
          <FloorSwitcher
            floors={doc.floors}
            activeFloorId={activeFloorId}
            onSelect={store.setActiveFloor}
            onAdd={() => store.addFloor()}
            onDuplicate={store.duplicateActiveFloor}
            onRemove={store.removeActiveFloor}
            onRename={store.renameFloor}
            onMove={store.moveActiveFloor}
          />

          <svg
            ref={svgRef}
            id="floor-editor-svg"
            className="editor-svg"
            width={svgSize.width}
            height={svgSize.height}
            style={{ cursor: cursorStyle }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={handleDrop}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Floor plan editor canvas"
          >
            <rect
              x={0}
              y={0}
              width={svgSize.width}
              height={svgSize.height}
              className="canvas-bg"
            />

            <g id="viewport" transform={getViewportTransform(viewport)}>
              <FloorBoundary floor={floorConfig} />
              <Grid
                floor={floorConfig}
                viewport={viewport}
                showGrid={showGrid}
                svgWidth={svgSize.width}
                svgHeight={svgSize.height}
                clipToFloor={false}
              />
              <CellHighlight
                hoveredCell={cursorCell ? snapCell(cursorCell) : null}
                selectedCells={selectedCells}
                a={a}
                hoverSpan={snapStep}
              />
              <EntitiesLayer
                entities={activeFloor.entities}
                selectedIds={selectedSet}
                a={a}
                colorFor={(entity) => colorForEntity(entity.kind, allLibrary, entity.color)}
                onEntityPointerDown={handleEntityPointerDown}
              />
              <WallsLayer
                walls={activeFloor.walls}
                selectedIds={selectedWallSet}
                a={a}
                draft={wallDraft}
                draftThickness={store.wallThickness}
                draftCursor={wallDraftCursor}
                onWallPointerDown={handleWallPointerDown}
              />
              {singleSelected && (
                <ResizeHandles
                  entity={singleSelected}
                  zoom={viewport.zoom}
                  a={a}
                  onHandleDown={handleHandleDown}
                />
              )}
            </g>

            <SelectionMarquee rect={marqueeRect} viewport={viewport} />

            {showCoordinates && (
              <g
                id="axis-labels"
                fontSize={10}
                fontFamily="ui-monospace, monospace"
                className="axis-labels"
              >
                {axisLabels.xs.map((wx) => {
                  const sx = wx * viewport.zoom + viewport.panX;
                  const sy = Math.min(svgSize.height - 6, Math.max(12, viewport.panY + 14));
                  if (sx < 20 || sx > svgSize.width - 10) return null;
                  return (
                    <text key={`lx-${wx}`} x={sx} y={sy} textAnchor="middle">
                      {Math.round(wx)}
                    </text>
                  );
                })}
                {axisLabels.ys.map((wy) => {
                  const sx = Math.max(4, Math.min(svgSize.width - 8, viewport.panX - 8));
                  const sy = -wy * viewport.zoom + viewport.panY;
                  if (sy < 10 || sy > svgSize.height - 4) return null;
                  return (
                    <text
                      key={`ly-${wy}`}
                      x={sx}
                      y={sy}
                      textAnchor="end"
                      dominantBaseline="middle"
                    >
                      {Math.round(wy)}
                    </text>
                  );
                })}
              </g>
            )}
          </svg>

          {/* Canva-style floating panel for entity selections */}
          {entityPanelPos && showEntityPanel && (
            <EntityContextPanel
              x={entityPanelPos.x}
              y={entityPanelPos.y}
              count={selectedEntities.length}
              onDuplicate={store.duplicateSelection}
              onMultiDuplicate={(times, dir) => store.multiDuplicate(times, dir)}
              onRotateCW={() => store.rotateSelection(1)}
              onRotateCCW={() => store.rotateSelection(-1)}
              onDelete={() => {
                store.deleteSelection();
                setShowEntityPanel(false);
              }}
              onClose={() => {
                store.clearSelection();
                setShowEntityPanel(false);
              }}
            />
          )}

          {selectionMenuPos && (
            <SelectionActionMenu
              x={selectionMenuPos.x}
              y={selectionMenuPos.y}
              cellCount={selectedCells.length}
              hasCellClipboard={!!cellClipboard}
              onCreateArea={() =>
                store.createAreaFromCells(
                  selectedCells,
                  'area',
                  allLibrary.find((i) => i.kind === 'area'),
                )
              }
              onCreateRoom={() =>
                store.createAreaFromCells(
                  selectedCells,
                  'room',
                  allLibrary.find((i) => i.kind === 'room'),
                )
              }
              onSaveAsShape={() => {
                const footprint = footprintFromCells(selectedCells);
                if (!footprint) return;
                const color = nextCustomColor(customLibrary.length);
                store.addCustomLibraryItem({
                  id: createId('lib'),
                  kind: 'custom',
                  label: `Shape ${customLibrary.length + 1}`,
                  code: nextCustomCode(),
                  footprint: { widthCells: footprint.size.w, heightCells: footprint.size.h, level: 0 as const },
                  allowedRotations: [0, 90, 180, 270] as const,
                  cells: footprint.cells,
                  color,
                  fromSelection: true,
                });
                store.setSelectedCells([]);
                setNotice('Shape added to the library');
              }}
              onCopyCells={() => {
                store.copyCellEntities(selectedCells);
                setNotice('Entities in selection copied');
              }}
              onPasteCells={() => {
                if (!cellClipboard) return;
                const minX = Math.min(...selectedCells.map((c) => c.x));
                const minY = Math.min(...selectedCells.map((c) => c.y));
                store.pasteCellEntities({ x: minX, y: minY });
                setNotice('Entities pasted at selected cells');
              }}
              onClear={() => store.setSelectedCells([])}
            />
          )}

          <div className="status-bar">
            {showCoordinates && cursorCell && (
              <span className="mono">
                cell ({cursorCell.x}, {cursorCell.y}) · {(cursorCell.x * a).toFixed(2)},{' '}
                {(cursorCell.y * a).toFixed(2)} m
              </span>
            )}
            <span>
              a={a} m · level L{gridLevel} · step {snapStep} cell{snapStep === 1 ? '' : 's'}
            </span>
            <span>{snapEnabled ? 'Snap ON' : 'Snap OFF'}</span>
            <span>
              {hasSelection
                ? `${selectedIds.length} object(s), ${selectedWallIds.length} wall(s)`
                : selectedCells.length > 0
                  ? `${selectedCells.length} cell(s)`
                  : 'Nothing selected'}
            </span>
            {collisions.length > 0 && (
              <span className="status-warn">{collisions.length} overlap(s)</span>
            )}
            <span className="status-hint">
              {tool === 'wall'
                ? 'Click vertices · Enter or double-click to finish · Esc cancels'
                : 'Drag empty to pan · R rotates · Ctrl+drag marquee · Del deletes'}
            </span>
          </div>

          {notice && <div className="editor-notice">{notice}</div>}

          {/* ── Inline toast input for text label (replaces window.prompt) ── */}
          {pendingTextPlacement && (
            <div
              className="text-label-toast-backdrop"
              onClick={() => setPendingTextPlacement(null)}
            >
              <div
                className="text-label-toast"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-label-toast-icon">T</span>
                <input
                  className="text-label-toast-input"
                  autoFocus
                  placeholder="Enter label text…"
                  value={pendingTextValue}
                  onChange={(e) => setPendingTextValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = pendingTextValue.trim();
                      if (val && pendingTextPlacement) {
                        storeRef.current.placeFromLibrary(
                          pendingTextPlacement.item,
                          pendingTextPlacement.cell,
                          val,
                        );
                      }
                      setPendingTextPlacement(null);
                    }
                    if (e.key === 'Escape') {
                      setPendingTextPlacement(null);
                    }
                  }}
                />
                <button
                  type="button"
                  className="text-label-toast-btn confirm"
                  onClick={() => {
                    const val = pendingTextValue.trim();
                    if (val && pendingTextPlacement) {
                      storeRef.current.placeFromLibrary(
                        pendingTextPlacement.item,
                        pendingTextPlacement.cell,
                        val,
                      );
                    }
                    setPendingTextPlacement(null);
                  }}
                >
                  Place
                </button>
                <button
                  type="button"
                  className="text-label-toast-btn cancel"
                  onClick={() => setPendingTextPlacement(null)}
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </div>

        <PropertiesPanel
          doc={doc}
          onWorkspaceResize={store.resizeWorkspace}
          onBaseUnitChange={store.setBaseUnit}
          selected={selectedEntities}
          selectedWalls={selectedWalls}
          onUpdateSelected={(patch) => {
            if (singleSelected) store.updateEntity(singleSelected.id, patch);
          }}
          onUpdateWall={(patch) => {
            if (selectedWalls.length === 1) store.updateWall(selectedWalls[0].id, patch);
          }}
          onResizeSelected={(w, h) => {
            if (!singleSelected) return;
            const next = resizeEntity(singleSelected, singleSelected.origin, { w, h });
            store.updateEntity(singleSelected.id, { size: next.size, cells: next.cells });
          }}
          onMoveSelected={(x, y) => {
            if (singleSelected) store.updateEntity(singleSelected.id, { origin: { x, y } });
          }}
          collisions={collisions}
        />
      </div>

      <HowToUseModal open={howToOpen} onClose={() => setHowToOpen(false)} />
    </div>
  );
};

export default FloorEditor;
