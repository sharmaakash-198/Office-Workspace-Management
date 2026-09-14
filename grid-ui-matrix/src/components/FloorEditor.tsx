import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  CellRef,
  EditorTool,
  Entity,
  FloorConfig,
  LibraryItem,
  Point,
  Rect,
} from '../types/geometry';
import type { Viewport } from '../types/viewport';
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
  cellToWorldRect,
  cellsInWorldRect,
  getFloorBaseUnit,
  getGridLevel,
  getLevelCellSize,
  getVisibleWorldBounds,
  worldRectFromPoints,
  worldToCell,
} from '../geometry/grid';
import { snapPointToGrid, snapSize, snapToGrid } from '../geometry/snapping';
import {
  cloneEntity,
  createId,
  entitiesIntersectingRect,
  hitTestEntity,
  resizeEntity,
  translateEntity,
} from '../geometry/entities';
import { cellsToFootprint, footprintToOutline } from '../geometry/footprint';
import {
  generateFloorMatrix,
  matrixToJson,
  matrixToPlainText,
  type FloorMatrix,
} from '../geometry/matrix';
import { useHistory } from '../hooks/useHistory';
import { loadDraft, saveDraft, type DraftDocument } from '../lib/drafts';
import { exportPdf, exportPng, exportSvg } from '../lib/export';
import {
  DEFAULT_ENTITY_LIBRARY,
  colorForEntity,
  nextCustomCode,
  nextCustomColor,
} from '../lib/library';
import type { ResizeHandle } from './ResizeHandles';
import FloorBoundary from './FloorBoundary';
import Grid from './Grid';
import CellHighlight from './CellHighlight';
import EntitiesLayer from './EntitiesLayer';
import SelectionMarquee from './SelectionMarquee';
import SelectionActionMenu from './SelectionActionMenu';
import ResizeHandles from './ResizeHandles';
import EntityLibrary from './EntityLibrary';
import PropertiesPanel from './PropertiesPanel';
import Toolbar from './Toolbar';
import HowToUseModal from './HowToUseModal';

const ZOOM_FACTOR = 1.12;
const MAX_ZOOM = 400;
const CLICK_PX = 4;

const DEFAULT_FLOOR: FloorConfig = {
  width: 64,
  height: 64,
  a: 0.25,
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
  | {
      type: 'marquee';
      startWorld: Point;
      currentWorld: Point;
      additive: boolean;
    }
  | {
      type: 'move';
      startWorld: Point;
      originEntities: Entity[];
      ids: string[];
    }
  | {
      type: 'resize';
      handle: ResizeHandle;
      startWorld: Point;
      originEntities: Entity[];
      entityId: string;
    }
  | null;

function mergeCells(existing: CellRef[], extra: CellRef[], additive: boolean): CellRef[] {
  if (!additive) return extra;
  const map = new Map(existing.map((c) => [`${c.level}:${c.col}:${c.row}`, c]));
  for (const c of extra) {
    const key = `${c.level}:${c.col}:${c.row}`;
    if (map.has(key)) map.delete(key);
    else map.set(key, c);
  }
  return Array.from(map.values());
}

const FloorEditor: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [svgSize, setSvgSize] = useState({ width: 800, height: 600 });
  const [viewport, setViewport] = useState<Viewport>({ zoom: 40, panX: 0, panY: 0 });
  const [floor, setFloor] = useState<FloorConfig>(DEFAULT_FLOOR);
  const [showGrid, setShowGrid] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [includeGridOnExport, setIncludeGridOnExport] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [tool, setTool] = useState<EditorTool>('select');
  const [placeItem, setPlaceItem] = useState<LibraryItem | null>(null);
  const [cursorWorld, setCursorWorld] = useState<Point>({ x: 0, y: 0 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedCells, setSelectedCells] = useState<CellRef[]>([]);
  const [marqueeRect, setMarqueeRect] = useState<Rect | null>(null);
  const [matrix, setMatrix] = useState<FloorMatrix | null>(null);
  const [library, setLibrary] = useState<LibraryItem[]>(() =>
    DEFAULT_ENTITY_LIBRARY.map((i) => ({ ...i })),
  );
  const [customLibrary, setCustomLibrary] = useState<LibraryItem[]>([]);
  const [howToOpen, setHowToOpen] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [clipboard, setClipboard] = useState<Entity[]>([]);

  const {
    present: entities,
    set: setEntities,
    replace: replaceEntities,
    commitDrag,
    undo,
    redo,
    reset: resetEntities,
    canUndo,
    canRedo,
  } = useHistory<Entity[]>([], 5);

  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  useEffect(() => {
    undoRef.current = undo;
    redoRef.current = redo;
  }, [undo, redo]);

  const viewportRef = useRef(viewport);
  const entitiesRef = useRef(entities);
  const floorRef = useRef(floor);
  const dragRef = useRef<DragMode>(null);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const movedRef = useRef(false);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);
  useEffect(() => {
    entitiesRef.current = entities;
  }, [entities]);
  useEffect(() => {
    floorRef.current = floor;
  }, [floor]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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
    setViewport(initialCloseUpViewport(DEFAULT_FLOOR, width, height));
    return () => ro.disconnect();
  }, []);

  const baseUnit = getFloorBaseUnit(floor);
  const gridLevel = getGridLevel(viewport.zoom, baseUnit);
  const gridCellSize = getLevelCellSize(gridLevel, baseUnit);
  const snapSizeWorld = snapEnabled ? gridCellSize : 0;
  const minZoom = minZoomToFitFloor(floor, svgSize.width, svgSize.height);

  const allLibrary = useMemo(() => [...library, ...customLibrary], [library, customLibrary]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedEntities = useMemo(
    () => entities.filter((e) => selectedSet.has(e.id)),
    [entities, selectedSet],
  );

  const hoveredCell: CellRef | null = useMemo(
    () => worldToCell(cursorWorld, gridLevel, baseUnit),
    [cursorWorld, gridLevel, baseUnit],
  );

  const selectionMenuPos = useMemo(() => {
    if (selectedCells.length === 0) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const cell of selectedCells) {
      const r = cellToWorldRect(cell, baseUnit);
      minX = Math.min(minX, r.x);
      maxX = Math.max(maxX, r.x + r.width);
      minY = Math.min(minY, r.y);
      maxY = Math.max(maxY, r.y + r.height);
    }
    const screen = worldToScreen({ x: (minX + maxX) / 2, y: maxY }, viewport);
    return { x: screen.x, y: screen.y, world: { minX, maxX, minY, maxY } };
  }, [selectedCells, baseUnit, viewport]);

  const applyZoom = useCallback(
    (factor: number, anchor: Point) => {
      setViewport((v) => {
        const next = zoomAround(v, factor, anchor);
        return clampZoomAround(next, next.zoom, anchor, minZoom, MAX_ZOOM);
      });
    },
    [minZoom],
  );

  const handleZoomIn = useCallback(() => {
    applyZoom(ZOOM_FACTOR, { x: svgSize.width / 2, y: svgSize.height / 2 });
  }, [applyZoom, svgSize]);

  const handleZoomOut = useCallback(() => {
    applyZoom(1 / ZOOM_FACTOR, { x: svgSize.width / 2, y: svgSize.height / 2 });
  }, [applyZoom, svgSize]);

  const handleFitFloor = useCallback(() => {
    setViewport(fitFloorViewport(floor, svgSize.width, svgSize.height));
  }, [floor, svgSize]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      applyZoom(e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR, cursor);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [applyZoom]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const touchDist = (touches: TouchList) => {
      const a = touches[0];
      const b = touches[1];
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = { dist: touchDist(e.touches), zoom: viewportRef.current.zoom };
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
      setViewport((v) => clampZoomAround(v, desired, mid, minZoom, MAX_ZOOM));
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
      viewportRef.current,
    );
  }, []);

  const placeEntityAt = useCallback(
    (item: LibraryItem, world: Point) => {
      let x = world.x - item.defaultWidth / 2;
      let y = world.y - item.defaultHeight / 2;
      if (snapSizeWorld > 0) {
        const snapped = snapPointToGrid(x, y, snapSizeWorld);
        x = snapped.x;
        y = snapped.y;
      }

      if (item.kind === 'text') {
        const text =
          window.prompt('Enter label text', item.label === 'Text block' ? 'Label' : item.label) ??
          '';
        if (!text.trim()) {
          setPlaceItem(null);
          setTool('select');
          return;
        }
        const fontSize = item.defaultFontSize ?? 0.6;
        const entity: Entity = {
          id: createId('text'),
          kind: 'text',
          code: 0,
          x,
          y,
          width: Math.max(item.defaultWidth, text.length * fontSize * 0.55),
          height: Math.max(item.defaultHeight, fontSize * 1.4),
          label: text.trim(),
          color: item.color,
          fontSize,
        };
        setEntities([...entitiesRef.current, entity]);
        setSelectedIds([entity.id]);
        setSelectedCells([]);
        setPlaceItem(null);
        setTool('select');
        return;
      }

      if (item.footprint && item.footprint.length > 0) {
        const outline = footprintToOutline(x, y, item.footprint);
        const entity: Entity = {
          id: createId('polygon'),
          kind: 'polygon',
          code: item.code,
          x,
          y,
          width: item.defaultWidth,
          height: item.defaultHeight,
          footprint: item.footprint.map((f) => ({ ...f })),
          points: outline,
          label: item.label,
          color: item.color,
        };
        setEntities([...entitiesRef.current, entity]);
        setSelectedIds([entity.id]);
        setSelectedCells([]);
        setPlaceItem(null);
        setTool('select');
        return;
      }

      const entity: Entity = {
        id: createId(item.kind),
        kind: item.kind,
        code: item.code,
        x,
        y,
        width: item.defaultWidth,
        height: item.defaultHeight,
        label: item.label,
        color: item.color,
      };
      setEntities([...entitiesRef.current, entity]);
      setSelectedIds([entity.id]);
      setSelectedCells([]);
      setPlaceItem(null);
      setTool('select');
    },
    [setEntities, snapSizeWorld],
  );

  const handleMarkAsPolygon = useCallback(() => {
    if (selectedCells.length === 0) return;
    const built = cellsToFootprint(selectedCells, baseUnit);
    if (!built) return;

    const code = nextCustomCode();
    const color = nextCustomColor(customLibrary.length);
    const label = `Polygon ${customLibrary.length + 1}`;
    const id = createId('custom-poly');
    const outline = footprintToOutline(built.origin.x, built.origin.y, built.footprint);

    const entity: Entity = {
      id,
      kind: 'polygon',
      code,
      x: built.origin.x,
      y: built.origin.y,
      width: built.width,
      height: built.height,
      footprint: built.footprint,
      points: outline,
      label,
      color,
    };
    const libItem: LibraryItem = {
      id: `lib-${id}`,
      kind: 'custom',
      label,
      code,
      defaultWidth: built.width,
      defaultHeight: built.height,
      color,
      fromSelection: true,
      footprint: built.footprint.map((f) => ({ ...f })),
    };
    setEntities([...entitiesRef.current, entity]);
    setCustomLibrary((prev) => [...prev, libItem]);
    setSelectedCells([]);
    setSelectedIds([id]);
  }, [selectedCells, baseUnit, customLibrary.length, setEntities]);

  const handleCopy = useCallback(() => {
    if (selectedIds.length === 0) return;
    const idSet = new Set(selectedIds);
    const copies = entitiesRef.current
      .filter((e) => idSet.has(e.id))
      .map((e) => cloneEntity(e, e.id));
    setClipboard(copies);
  }, [selectedIds]);

  const handlePaste = useCallback(() => {
    if (clipboard.length === 0) return;

    let anchorX = 0;
    let anchorY = 0;
    if (selectedCells.length > 0) {
      const cell = selectedCells[selectedCells.length - 1];
      const r = cellToWorldRect(cell, baseUnit);
      anchorX = r.x;
      anchorY = r.y;
    } else {
      anchorX = Math.round(cursorWorld.x);
      anchorY = Math.round(cursorWorld.y);
      if (snapSizeWorld > 0) {
        const s = snapPointToGrid(anchorX, anchorY, snapSizeWorld);
        anchorX = s.x;
        anchorY = s.y;
      }
    }

    // Align clipboard group so its AABB min corner lands on the paste anchor
    let minX = Infinity;
    let minY = Infinity;
    for (const e of clipboard) {
      minX = Math.min(minX, e.x);
      minY = Math.min(minY, e.y);
    }
    const dx = anchorX - minX;
    const dy = anchorY - minY;
    const pasted = clipboard.map((e) => {
      const id = createId(e.kind);
      return translateEntity(cloneEntity(e, id), dx, dy);
    });
    setEntities([...entitiesRef.current, ...pasted]);
    setSelectedIds(pasted.map((p) => p.id));
    setSelectedCells([]);
  }, [clipboard, selectedCells, baseUnit, cursorWorld, snapSizeWorld, setEntities]);

  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setSpaceHeld(true);
      }
      if (e.key === 'Escape') {
        setSelectedIds([]);
        setSelectedCells([]);
        setPlaceItem(null);
        setTool('select');
        setMarqueeRect(null);
        dragRef.current = null;
      }
      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redoRef.current();
        else undoRef.current();
      }
      if (meta && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redoRef.current();
      }
      if (meta && e.key.toLowerCase() === 'c') {
        if (typing) return;
        e.preventDefault();
        handleCopy();
      }
      if (meta && e.key.toLowerCase() === 'v') {
        if (typing) return;
        e.preventDefault();
        handlePaste();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdsRef.current.length > 0) {
        if (typing) return;
        e.preventDefault();
        const drop = new Set(selectedIdsRef.current);
        setEntities(entitiesRef.current.filter((ent) => !drop.has(ent.id)));
        setSelectedIds([]);
      }

      // Arrow-key nudge for selected entities
      if (
        !typing &&
        !meta &&
        selectedIdsRef.current.length > 0 &&
        (e.key === 'ArrowUp' ||
          e.key === 'ArrowDown' ||
          e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight')
      ) {
        e.preventDefault();
        const step = snapSizeWorld > 0 ? snapSizeWorld : floorRef.current.a;
        const large = e.shiftKey ? 4 : 1;
        const delta = step * large;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowLeft') dx = -delta;
        if (e.key === 'ArrowRight') dx = delta;
        if (e.key === 'ArrowDown') dy = -delta; // world Y-up
        if (e.key === 'ArrowUp') dy = delta;

        const idSet = new Set(selectedIdsRef.current);
        setEntities(
          entitiesRef.current.map((ent) =>
            idSet.has(ent.id) ? translateEntity(ent, dx, dy) : ent,
          ),
        );
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
  }, [setEntities, handleCopy, handlePaste, snapSizeWorld]);

  const applyResize = (
    origin: Entity,
    handle: ResizeHandle,
    world: Point,
    snap: number,
  ): Entity => {
    let { x, y, width, height } = origin;
    const right = x + width;
    const top = y + height;
    let nx = world.x;
    let ny = world.y;
    if (snap > 0) {
      nx = snapToGrid(nx, snap);
      ny = snapToGrid(ny, snap);
    }
    if (handle.includes('e')) width = Math.max(snap || 0.05, nx - x);
    if (handle.includes('w')) {
      const newX = Math.min(nx, right - (snap || 0.05));
      width = right - newX;
      x = newX;
    }
    if (handle.includes('n')) height = Math.max(snap || 0.05, ny - y);
    if (handle.includes('s')) {
      const newY = Math.min(ny, top - (snap || 0.05));
      height = top - newY;
      y = newY;
    }
    if (snap > 0) {
      width = snapSize(width, snap);
      height = snapSize(height, snap);
    }
    return resizeEntity(origin, { x, y, width, height });
  };

  const handleEntityPointerDown = (id: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (placeItem) return;

    const world = clientToWorld(e.clientX, e.clientY);
    let ids = selectedIds;
    if (e.shiftKey) {
      ids = selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id];
      setSelectedIds(ids);
    } else if (!selectedIds.includes(id)) {
      ids = [id];
      setSelectedIds(ids);
      setSelectedCells([]);
    }

    movedRef.current = false;
    dragRef.current = {
      type: 'move',
      startWorld: world,
      originEntities: entitiesRef.current.map((ent) => ({
        ...ent,
        points: ent.points?.map((p) => ({ ...p })),
      })),
      ids,
    };
  };

  const handleHandleDown = (handle: ResizeHandle, e: React.MouseEvent) => {
    if (selectedEntities.length !== 1) return;
    movedRef.current = false;
    dragRef.current = {
      type: 'resize',
      handle,
      startWorld: clientToWorld(e.clientX, e.clientY),
      originEntities: entitiesRef.current.map((ent) => ({
        ...ent,
        points: ent.points?.map((p) => ({ ...p })),
      })),
      entityId: selectedEntities[0].id,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const world = clientToWorld(e.clientX, e.clientY);
    movedRef.current = false;

    if (placeItem && e.button === 0 && !e.ctrlKey && !e.metaKey) {
      placeEntityAt(placeItem, world);
      return;
    }

    const wantPan =
      e.button === 1 ||
      tool === 'pan' ||
      spaceHeld ||
      (e.button === 0 && !e.ctrlKey && !e.metaKey && !hitTestEntity(entitiesRef.current, world));

    if (e.ctrlKey || e.metaKey) {
      dragRef.current = {
        type: 'marquee',
        startWorld: world,
        currentWorld: world,
        additive: e.shiftKey,
      };
      setMarqueeRect({ x: world.x, y: world.y, width: 0, height: 0 });
      return;
    }

    if (wantPan) {
      e.preventDefault();
      dragRef.current = {
        type: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        panX: viewportRef.current.panX,
        panY: viewportRef.current.panY,
        worldAtStart: world,
        shift: e.shiftKey,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const world = clientToWorld(e.clientX, e.clientY);
    setCursorWorld(world);

    const drag = dragRef.current;
    if (!drag) return;

    if (drag.type === 'pan') {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.hypot(dx, dy) >= CLICK_PX) movedRef.current = true;
      setViewport((v) => ({
        ...v,
        panX: drag.panX + dx,
        panY: drag.panY + dy,
      }));
      return;
    }

    movedRef.current = true;

    if (drag.type === 'marquee') {
      drag.currentWorld = world;
      setMarqueeRect(worldRectFromPoints(drag.startWorld, world));
      return;
    }

    if (drag.type === 'move') {
      let dx = world.x - drag.startWorld.x;
      let dy = world.y - drag.startWorld.y;
      if (snapSizeWorld > 0) {
        dx = snapToGrid(dx, snapSizeWorld);
        dy = snapToGrid(dy, snapSizeWorld);
      }
      const idSet = new Set(drag.ids);
      replaceEntities(
        drag.originEntities.map((ent) =>
          idSet.has(ent.id) ? translateEntity(ent, dx, dy) : ent,
        ),
      );
      return;
    }

    if (drag.type === 'resize') {
      const origin = drag.originEntities.find((ent) => ent.id === drag.entityId);
      if (!origin) return;
      const next = applyResize(origin, drag.handle, world, snapSizeWorld);
      replaceEntities(
        drag.originEntities.map((ent) => (ent.id === next.id ? next : ent)),
      );
    }
  };

  const handleMouseUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;

    if (drag?.type === 'pan') {
      if (!movedRef.current) {
        const cell = worldToCell(drag.worldAtStart, gridLevel, baseUnit);
        if (!drag.shift) setSelectedIds([]);
        setSelectedCells((prev) => mergeCells(prev, [cell], drag.shift));
      }
      return;
    }

    if (drag?.type === 'marquee') {
      const rect = worldRectFromPoints(drag.startWorld, drag.currentWorld);
      setMarqueeRect(null);
      if (rect.width * viewport.zoom < CLICK_PX && rect.height * viewport.zoom < CLICK_PX) {
        return;
      }
      const hit = entitiesIntersectingRect(entitiesRef.current, rect);
      if (hit.length > 0) {
        const ids = hit.map((h) => h.id);
        setSelectedIds((prev) =>
          drag.additive ? Array.from(new Set([...prev, ...ids])) : ids,
        );
        setSelectedCells([]);
      } else {
        const cells = cellsInWorldRect(rect, gridLevel, baseUnit);
        setSelectedCells((prev) => mergeCells(prev, cells, drag.additive));
        if (!drag.additive) setSelectedIds([]);
      }
      return;
    }

    if ((drag?.type === 'move' || drag?.type === 'resize') && movedRef.current) {
      commitDrag(drag.originEntities);
    }
  };

  const handleUpdateSelected = (patch: Partial<Entity>) => {
    if (selectedIds.length !== 1) return;
    const id = selectedIds[0];
    setEntities(entities.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const handleLibraryColor = (id: string, color: string) => {
    setLibrary((prev) => prev.map((i) => (i.id === id ? { ...i, color } : i)));
    setCustomLibrary((prev) => prev.map((i) => (i.id === id ? { ...i, color } : i)));
    // Update placed entities that match this library kind/code colour source
    const item = allLibrary.find((i) => i.id === id);
    if (item) {
      setEntities(
        entitiesRef.current.map((e) =>
          e.kind === item.kind && e.code === item.code && !e.color
            ? { ...e, color }
            : e.color === item.color
              ? { ...e, color }
              : e.label === item.label
                ? { ...e, color }
                : e,
        ),
      );
    }
  };

  const handleSaveDraft = (name: string) => {
    const doc: DraftDocument = {
      version: 1,
      name,
      savedAt: new Date().toISOString(),
      a: floor.a,
      floor,
      viewport,
      entities,
      theme,
    };
    saveDraft(doc);
  };

  const handleLoadDraft = (name: string) => {
    const doc = loadDraft(name);
    if (!doc) return;
    setFloor(doc.floor);
    setViewport(doc.viewport);
    resetEntities(doc.entities);
    setSelectedIds([]);
    setSelectedCells([]);
    if (doc.theme) setTheme(doc.theme);
  };

  const runExport = async (kind: 'png' | 'svg' | 'pdf') => {
    const svg = svgRef.current;
    if (!svg) return;
    const stamp = Date.now();
    if (kind === 'svg') exportSvg(svg, floor, `floor-${stamp}.svg`, includeGridOnExport);
    if (kind === 'png') await exportPng(svg, floor, `floor-${stamp}.png`, includeGridOnExport);
    if (kind === 'pdf') await exportPdf(svg, floor, `floor-${stamp}.pdf`, includeGridOnExport);
  };

  const axisLabels = useMemo(() => {
    const bounds = getVisibleWorldBounds(viewport, svgSize.width, svgSize.height);
    const step = baseUnit;
    const xs: number[] = [];
    const ys: number[] = [];
    const startX = Math.ceil(bounds.minX / step) * step;
    for (let x = startX; x <= bounds.maxX; x += step) xs.push(x);
    const startY = Math.ceil(bounds.minY / step) * step;
    for (let y = startY; y <= bounds.maxY; y += step) ys.push(y);
    return { xs: xs.slice(0, 40), ys: ys.slice(0, 40) };
  }, [viewport, svgSize, baseUnit]);

  const cursorStyle =
    tool === 'pan' || spaceHeld ? 'grab' : placeItem ? 'crosshair' : 'default';

  const singleSelected = selectedEntities.length === 1 ? selectedEntities[0] : null;

  const colorFor = (entity: Entity) =>
    colorForEntity(entity.kind, allLibrary, entity.color);

  return (
    <div className="editor-layout">
      <Toolbar
        viewport={viewport}
        tool={tool === 'place' ? 'select' : tool}
        showGrid={showGrid}
        snapEnabled={snapEnabled}
        includeGridOnExport={includeGridOnExport}
        theme={theme}
        canUndo={canUndo}
        canRedo={canRedo}
        canPaste={clipboard.length > 0}
        onTool={(t) => {
          setTool(t);
          setPlaceItem(null);
        }}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitFloor={handleFitFloor}
        onToggleGrid={() => setShowGrid((g) => !g)}
        onToggleSnap={() => setSnapEnabled((s) => !s)}
        onToggleExportGrid={() => setIncludeGridOnExport((g) => !g)}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onUndo={undo}
        onRedo={redo}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onHowToUse={() => setHowToOpen(true)}
        onSaveDraft={handleSaveDraft}
        onLoadDraft={handleLoadDraft}
        onExportPng={() => void runExport('png')}
        onExportSvg={() => void runExport('svg')}
        onExportPdf={() => void runExport('pdf')}
      />

      <div className="editor-body">
        <EntityLibrary
          items={library}
          customItems={customLibrary}
          activeId={placeItem?.id ?? null}
          onSelect={(item) => {
            setPlaceItem(item);
            setTool('place');
          }}
          onColorChange={handleLibraryColor}
        />

        <div className="editor-canvas-container" ref={containerRef}>
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
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Floor plan editor canvas"
          >
            <defs>
              <clipPath id="floor-clip">
                <rect x={0} y={0} width={floor.width} height={floor.height} />
              </clipPath>
            </defs>

            <rect
              x={0}
              y={0}
              width={svgSize.width}
              height={svgSize.height}
              className="canvas-bg"
            />

            <g id="viewport" transform={getViewportTransform(viewport)}>
              <FloorBoundary floor={floor} />
              <Grid
                floor={floor}
                viewport={viewport}
                showGrid={showGrid}
                svgWidth={svgSize.width}
                svgHeight={svgSize.height}
                clipToFloor={false}
              />
              <CellHighlight
                hoveredCell={hoveredCell}
                selectedCells={selectedCells}
                baseUnit={baseUnit}
              />
              <EntitiesLayer
                entities={entities}
                selectedIds={selectedSet}
                colorFor={colorFor}
                onEntityPointerDown={handleEntityPointerDown}
              />
              {singleSelected && (
                <ResizeHandles
                  entity={singleSelected}
                  zoom={viewport.zoom}
                  onHandleDown={handleHandleDown}
                />
              )}
            </g>

            <SelectionMarquee rect={marqueeRect} viewport={viewport} />

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
                  <text key={`ly-${wy}`} x={sx} y={sy} textAnchor="end" dominantBaseline="middle">
                    {Math.round(wy)}
                  </text>
                );
              })}
            </g>
          </svg>

          {selectionMenuPos && (
            <SelectionActionMenu
              x={selectionMenuPos.x}
              y={selectionMenuPos.y}
              cellCount={selectedCells.length}
              onMarkPolygon={handleMarkAsPolygon}
              onClear={() => setSelectedCells([])}
            />
          )}

          <div className="status-bar">
            <span>
              ({Math.round(cursorWorld.x)}, {Math.round(cursorWorld.y)}) m
            </span>
            <span>
              a={floor.a} m · cell {gridCellSize.toFixed(2)} m · L{gridLevel}
            </span>
            <span>{snapEnabled ? 'Snap ON' : 'Snap OFF'}</span>
            <span>
              {selectedIds.length > 0
                ? `${selectedIds.length} entity(s)`
                : selectedCells.length > 0
                  ? `${selectedCells.length} cell(s)`
                  : 'Nothing selected'}
            </span>
            <span className="status-hint">
              Drag empty to pan · Arrows nudge · Shift+arrow ×4 · Ctrl+drag select · Del delete
            </span>
          </div>
        </div>

        <PropertiesPanel
          floor={floor}
          onFloorChange={setFloor}
          selected={selectedEntities}
          onUpdateSelected={handleUpdateSelected}
          matrix={matrix}
          onGenerateMatrix={() => setMatrix(generateFloorMatrix(entities, floor))}
          onCopyMatrix={() => {
            if (!matrix) return;
            void navigator.clipboard.writeText(matrixToPlainText(matrix));
          }}
          onCopyMatrixJson={() => {
            if (!matrix) return;
            void navigator.clipboard.writeText(matrixToJson(matrix));
          }}
        />
      </div>

      <HowToUseModal open={howToOpen} onClose={() => setHowToOpen(false)} />
    </div>
  );
};

export default FloorEditor;
