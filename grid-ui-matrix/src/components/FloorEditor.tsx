import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  CatalogCategory,
  CellRef,
  CustomLibraryEntry,
  EditorTool,
  Entity,
  FloorConfig,
  FloorZone,
  GridCell,
  LibraryItem,
  Point,
  Rect,
  SubdivisionMode,
} from '../types/geometry';
import { floorWorldHeight, floorWorldWidth } from '../types/geometry';
import type { Viewport } from '../types/viewport';
import {
  clampViewportToFirstQuadrant,
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
  getMaxLevel,
  getVisibleWorldBounds,
  worldRectFromPoints,
  worldToCell,
  worldToFinestCell,
} from '../geometry/grid';
import { snapPointToGrid, snapToGrid } from '../geometry/snapping';
import {
  cloneEntity,
  createId,
  entitiesInCells,
  entitiesIntersectingRect,
  entityWorldRect,
  hitTestEntity,
  isPolygonEntity,
  resizePolygonEntity,
  rotateEntity90CCW,
  scaleEntityDown,
  scaleEntityUp,
  translateEntity,
} from '../geometry/entities';
import {
  cellsToRelativeFinest,
  cellsToSvgPath,
} from '../geometry/footprint';
import { useHistory } from '../hooks/useHistory';
import {
  downloadFloorJson,
  floorDocumentToJson,
  loadDraft,
  saveDraft,
  type FloorDocument,
} from '../lib/drafts';
import { exportPdf, exportPng, exportSvg } from '../lib/export';
import { catalogToLibraryItems, loadCatalog } from '../lib/catalog';
import {
  colorForEntity,
  deleteCustomLibraryEntry,
  nextCustomColor,
} from '../lib/library';
import type { ResizeHandle } from './ResizeHandles';
import FloorBoundary from './FloorBoundary';
import Grid from './Grid';
import CellHighlight from './CellHighlight';
import EntitiesLayer from './EntitiesLayer';
import ZonesLayer from './ZonesLayer';
import OutsideFloorOverlay from './OutsideFloorOverlay';
import UnusableLayer from './UnusableLayer';
import SelectionMarquee from './SelectionMarquee';
import SelectionActionMenu from './SelectionActionMenu';
import EntityActionMenu from './EntityActionMenu';
import SavePolygonDialog from './SavePolygonDialog';
import ResizeHandles from './ResizeHandles';
import EntityLibrary from './EntityLibrary';
import PropertiesPanel from './PropertiesPanel';
import Toolbar from './Toolbar';
import HowToUseModal from './HowToUseModal';
import { MessageToast, PromptToast, type PromptRequest } from './PromptToast';

const ZOOM_FACTOR = 1.12;
const MAX_ZOOM = 400;
const CLICK_PX = 4;

const DEFAULT_FLOOR: FloorConfig = {
  cols: 64,
  rows: 64,
  a: 0.25,
};

const ZONE_COLORS = [
  'rgba(59, 130, 246, 0.14)',
  'rgba(34, 197, 94, 0.14)',
  'rgba(168, 85, 247, 0.14)',
  'rgba(245, 158, 11, 0.14)',
  'rgba(239, 68, 68, 0.14)',
  'rgba(20, 184, 166, 0.14)',
];

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

function selectedCellsToFinest(
  cells: CellRef[],
  baseUnit: number,
  a: number,
  subdivision: SubdivisionMode,
): GridCell[] {
  const built = cellsToRelativeFinest(cells, baseUnit, a, subdivision);
  if (!built) return [];
  return built.cells.map((c) => ({
    col: built.origin.col + c.col,
    row: built.origin.row + c.row,
  }));
}


function askText(
  setPromptReq: React.Dispatch<React.SetStateAction<PromptRequest | null>>,
  setPromptResolve: React.Dispatch<React.SetStateAction<((v: string | null) => void) | null>>,
  req: PromptRequest,
): Promise<string | null> {
  return new Promise((resolve) => {
    setPromptReq(req);
    setPromptResolve(() => resolve);
  });
}

interface FloorEditorProps {
  onOpenPretty: (doc: FloorDocument) => void;
}

const FloorEditor: React.FC<FloorEditorProps> = ({ onOpenPretty }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [svgSize, setSvgSize] = useState({ width: 800, height: 600 });
  const [viewport, setViewport] = useState<Viewport>({ zoom: 40, panX: 0, panY: 0 });
  const [floor, setFloor] = useState<FloorConfig>(DEFAULT_FLOOR);
  const [subdivision, setSubdivision] = useState<SubdivisionMode>(4);
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
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [customLibrary, setCustomLibrary] = useState<CustomLibraryEntry[]>([]);
  const [zones, setZones] = useState<FloorZone[]>([]);
  const [unusableCells, setUnusableCells] = useState<GridCell[]>([]);
  const [promptReq, setPromptReq] = useState<PromptRequest | null>(null);
  const [promptResolve, setPromptResolve] = useState<((v: string | null) => void) | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [howToOpen, setHowToOpen] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [clipboard, setClipboard] = useState<Entity[]>([]);
  const [showEntityMenu, setShowEntityMenu] = useState(false);
  const [polygonPending, setPolygonPending] = useState<ReturnType<
    typeof cellsToRelativeFinest
  > | null>(null);

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
  const subdivisionRef = useRef(subdivision);
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
    subdivisionRef.current = subdivision;
  }, [subdivision]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    void loadCatalog().then((cat) => setCategories(cat.categories));
  }, []);

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
    setViewport(
      clampViewportToFirstQuadrant(
        initialCloseUpViewport(DEFAULT_FLOOR, width, height),
        width,
        height,
      ),
    );
    return () => ro.disconnect();
  }, []);

  const baseUnit = getFloorBaseUnit(floor, subdivision);
  const maxLevel = getMaxLevel(subdivision);
  const gridLevel = getGridLevel(viewport.zoom, baseUnit, maxLevel, subdivision);
  const gridCellSize = getLevelCellSize(gridLevel, baseUnit, subdivision);
  const snapSizeWorld = snapEnabled ? gridCellSize : 0;
  const minZoom = minZoomToFitFloor(floor, svgSize.width, svgSize.height);
  const a = floor.a;

  const allLibrary = useMemo(
    () => [...catalogToLibraryItems({ categories }), ...customLibrary],
    [categories, customLibrary],
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedEntities = useMemo(
    () => entities.filter((e) => selectedSet.has(e.objectId)),
    [entities, selectedSet],
  );

  const hoveredCell: CellRef | null = useMemo(() => {
    const cell = worldToCell(cursorWorld, gridLevel, baseUnit, subdivision);
    if (cell.col < 0 || cell.row < 0) return null;
    return cell;
  }, [cursorWorld, gridLevel, baseUnit, subdivision]);

  const selectionMenuPos = useMemo(() => {
    if (selectedCells.length === 0) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const cell of selectedCells) {
      const r = cellToWorldRect(cell, baseUnit, subdivision);
      minX = Math.min(minX, r.x);
      maxX = Math.max(maxX, r.x + r.width);
      minY = Math.min(minY, r.y);
      maxY = Math.max(maxY, r.y + r.height);
    }
    const screen = worldToScreen({ x: (minX + maxX) / 2, y: maxY }, viewport);
    return { x: screen.x, y: screen.y };
  }, [selectedCells, baseUnit, subdivision, viewport]);

  const entityMenuPos = useMemo(() => {
    if (!showEntityMenu || selectedEntities.length !== 1) return null;
    const e = selectedEntities[0];
    const b = entityWorldRect(e, a);
    const screen = worldToScreen({ x: b.x + b.width / 2, y: b.y + b.height }, viewport);
    return { x: screen.x, y: screen.y };
  }, [showEntityMenu, selectedEntities, a, viewport]);

  const buildDocument = useCallback((): FloorDocument => {
    return {
      version: 2,
      a: floor.a,
      subdivision,
      floor,
      entities,
      zones,
      customLibrary,
      unusableCells,
      viewport,
      theme,
    };
  }, [floor, subdivision, entities, zones, customLibrary, unusableCells, viewport, theme]);

  const showToast = useCallback((msg: string) => setToastMsg(msg), []);

  const requestPrompt = useCallback((req: PromptRequest) => {
    return askText(setPromptReq, setPromptResolve, req);
  }, []);

  const setClampedViewport = useCallback(
    (updater: Viewport | ((v: Viewport) => Viewport)) => {
      setViewport((v) => {
        const next = typeof updater === 'function' ? updater(v) : updater;
        return clampViewportToFirstQuadrant(next, svgSize.width, svgSize.height);
      });
    },
    [svgSize.width, svgSize.height],
  );

  const unusableSet = useMemo(
    () => new Set(unusableCells.map((c) => `${c.col},${c.row}`)),
    [unusableCells],
  );

  const cellBlocked = useCallback(
    (col: number, row: number) => {
      if (col < 0 || row < 0 || col >= floor.cols || row >= floor.rows) return true;
      return unusableSet.has(`${col},${row}`);
    },
    [floor.cols, floor.rows, unusableSet],
  );

  const entityFitsFloor = useCallback(
    (ent: Entity) => {
      if (isPolygonEntity(ent) && ent.cells) {
        return ent.cells.every(
          (c) => !cellBlocked(ent.origin.col + c.col, ent.origin.row + c.row),
        );
      }
      for (let r = 0; r < ent.heightCells; r++) {
        for (let c = 0; c < ent.widthCells; c++) {
          if (cellBlocked(ent.origin.col + c, ent.origin.row + r)) return false;
        }
      }
      return true;
    },
    [cellBlocked],
  );

  const applyZoom = useCallback(
    (factor: number, anchor: Point) => {
      setClampedViewport((v) => {
        const next = zoomAround(v, factor, anchor);
        return clampZoomAround(next, next.zoom, anchor, minZoom, MAX_ZOOM);
      });
    },
    [minZoom, setClampedViewport],
  );

  const handleZoomIn = useCallback(() => {
    applyZoom(ZOOM_FACTOR, { x: svgSize.width / 2, y: svgSize.height / 2 });
  }, [applyZoom, svgSize]);

  const handleZoomOut = useCallback(() => {
    applyZoom(1 / ZOOM_FACTOR, { x: svgSize.width / 2, y: svgSize.height / 2 });
  }, [applyZoom, svgSize]);

  const handleFitFloor = useCallback(() => {
    setClampedViewport(fitFloorViewport(floor, svgSize.width, svgSize.height));
  }, [floor, svgSize, setClampedViewport]);

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
      const aT = touches[0];
      const b = touches[1];
      return Math.hypot(aT.clientX - b.clientX, aT.clientY - b.clientY);
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
      setClampedViewport((v) => clampZoomAround(v, desired, mid, minZoom, MAX_ZOOM));
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
  }, [minZoom, setClampedViewport]);

  const clientToWorld = useCallback((clientX: number, clientY: number): Point => {
    const rect = svgRef.current!.getBoundingClientRect();
    return screenToWorld(
      { x: clientX - rect.left, y: clientY - rect.top },
      viewportRef.current,
    );
  }, []);

  const placeEntityAt = useCallback(
    async (item: LibraryItem, world: Point) => {
      let cell = worldToFinestCell(world, a);
      if (snapSizeWorld > 0) {
        const snapped = snapPointToGrid(world.x, world.y, snapSizeWorld);
        cell = worldToFinestCell(snapped, a);
      }
      cell = { col: Math.max(0, cell.col), row: Math.max(0, cell.row) };

      const finishPlace = (entity: Entity) => {
        if (!entityFitsFloor(entity)) {
          showToast('Cannot place outside the floor or on unusable cells.');
          return;
        }
        setEntities([...entitiesRef.current, entity]);
        setSelectedIds([entity.objectId]);
        setSelectedCells([]);
        setPlaceItem(null);
        setTool('select');
        setShowEntityMenu(true);
      };

      if (item.category === 'text') {
        const text = await requestPrompt({
          title: 'Label text',
          defaultValue: item.label === 'Text block' ? 'Label' : item.label,
          confirmLabel: 'Place',
        });
        if (!text?.trim()) {
          setPlaceItem(null);
          setTool('select');
          return;
        }
        const fontSize = item.defaultFontSize ?? 0.6;
        finishPlace({
          objectId: createId('text'),
          category: 'text',
          elementType: 'text',
          origin: cell,
          widthCells: Math.max(item.widthCells, Math.ceil(text.length * 0.4)),
          heightCells: item.heightCells,
          scaleLevel: 0,
          rotation: 0,
          label: text.trim(),
          color: item.color,
          fontSize,
        });
        return;
      }

      if (item.cells && item.cells.length > 0) {
        finishPlace({
          objectId: createId('polygon'),
          category: item.category,
          elementType: item.elementType,
          origin: cell,
          widthCells: item.widthCells,
          heightCells: item.heightCells,
          scaleLevel: 0,
          rotation: 0,
          cells: item.cells.map((c) => ({ ...c })),
          svgPath: item.svgPath ?? cellsToSvgPath(item.cells),
          label: item.label,
          color: item.color,
        });
        return;
      }

      finishPlace({
        objectId: createId(item.elementType),
        category: item.category,
        elementType: item.elementType,
        origin: cell,
        widthCells: item.widthCells,
        heightCells: item.heightCells,
        scaleLevel: 0,
        rotation: 0,
        svg: item.svg,
        label: item.label,
        color: item.color,
      });
    },
    [setEntities, snapSizeWorld, a, entityFitsFloor, showToast, requestPrompt],
  );

  const handleMarkAsPolygon = useCallback(() => {
    if (selectedCells.length === 0) return;
    const built = cellsToRelativeFinest(selectedCells, baseUnit, a, subdivision);
    if (!built) return;
    setPolygonPending(built);
  }, [selectedCells, baseUnit, a, subdivision]);

  const confirmPolygonSave = useCallback(
    (opts: { label: string; category: string }) => {
      if (!polygonPending) return;
      const color = nextCustomColor(customLibrary.length);
      const objectId = createId('poly');
      const elementType = `polygon_${customLibrary.length + 1}`;
      const svgPath = cellsToSvgPath(polygonPending.cells);

      const entity: Entity = {
        objectId,
        category: opts.category,
        elementType,
        origin: polygonPending.origin,
        widthCells: polygonPending.widthCells,
        heightCells: polygonPending.heightCells,
        scaleLevel: 0,
        cells: polygonPending.cells,
        svgPath,
        label: opts.label,
        color,
      };

      const libItem: CustomLibraryEntry = {
        id: `lib-${objectId}`,
        category: opts.category,
        elementType,
        label: opts.label,
        widthCells: polygonPending.widthCells,
        heightCells: polygonPending.heightCells,
        color,
        cells: polygonPending.cells.map((c) => ({ ...c })),
        svgPath,
        fromSelection: true,
      };

      setEntities([...entitiesRef.current, entity]);
      setCustomLibrary((prev) => [...prev, libItem]);
      setSelectedCells([]);
      setSelectedIds([objectId]);
      setPolygonPending(null);
      setShowEntityMenu(true);
    },
    [polygonPending, customLibrary.length, setEntities],
  );

  const handleCopy = useCallback(() => {
    if (selectedIds.length === 0) return;
    const idSet = new Set(selectedIds);
    const copies = entitiesRef.current
      .filter((e) => idSet.has(e.objectId))
      .map((e) => cloneEntity(e, e.objectId));
    setClipboard(copies);
  }, [selectedIds]);

  const handlePaste = useCallback(() => {
    if (clipboard.length === 0) return;

    let anchorCol = 0;
    let anchorRow = 0;
    if (selectedCells.length > 0) {
      const finest = selectedCellsToFinest(selectedCells, baseUnit, a, subdivision);
      if (finest.length > 0) {
        anchorCol = Math.min(...finest.map((c) => c.col));
        anchorRow = Math.min(...finest.map((c) => c.row));
      }
    } else {
      const c = worldToFinestCell(cursorWorld, a);
      anchorCol = Math.max(0, c.col);
      anchorRow = Math.max(0, c.row);
    }

    let minCol = Infinity;
    let minRow = Infinity;
    for (const e of clipboard) {
      minCol = Math.min(minCol, e.origin.col);
      minRow = Math.min(minRow, e.origin.row);
    }
    const dCol = anchorCol - minCol;
    const dRow = anchorRow - minRow;
    const pasted = clipboard.map((e) => {
      const id = createId(e.elementType);
      return translateEntity(cloneEntity(e, id), dCol, dRow);
    });
    setEntities([...entitiesRef.current, ...pasted]);
    setSelectedIds(pasted.map((p) => p.objectId));
    setSelectedCells([]);
    setShowEntityMenu(false);
  }, [clipboard, selectedCells, baseUnit, a, subdivision, cursorWorld, setEntities]);

  const handleCopyZone = useCallback(() => {
    if (selectedCells.length === 0) return;
    const finest = selectedCellsToFinest(selectedCells, baseUnit, a, subdivision);
    const hit = entitiesInCells(entitiesRef.current, finest, a);
    if (hit.length === 0) {
      showToast('No entities in the selected zone.');
      return;
    }
    setClipboard(hit.map((e) => cloneEntity(e, e.objectId)));
  }, [selectedCells, baseUnit, a, subdivision, showToast]);

  const handleMarkZone = useCallback(async () => {
    if (selectedCells.length === 0) return;
    const label = await requestPrompt({
      title: 'Zone label',
      defaultValue: 'team-1',
      confirmLabel: 'Mark zone',
    });
    if (!label?.trim()) return;
    const finest = selectedCellsToFinest(selectedCells, baseUnit, a, subdivision);
    const zone: FloorZone = {
      id: createId('zone'),
      label: label.trim(),
      cells: finest,
      color: ZONE_COLORS[zones.length % ZONE_COLORS.length],
    };
    setZones((prev) => [...prev, zone]);
    setSelectedCells([]);
  }, [selectedCells, baseUnit, a, subdivision, zones.length, requestPrompt]);

  const handleMarkUnusable = useCallback(() => {
    if (selectedCells.length === 0) return;
    const finest = selectedCellsToFinest(selectedCells, baseUnit, a, subdivision);
    setUnusableCells((prev) => {
      const map = new Map(prev.map((c) => [`${c.col},${c.row}`, c]));
      for (const c of finest) {
        if (c.col >= 0 && c.row >= 0 && c.col < floor.cols && c.row < floor.rows) {
          map.set(`${c.col},${c.row}`, c);
        }
      }
      return Array.from(map.values());
    });
    setSelectedCells([]);
  }, [selectedCells, baseUnit, a, subdivision, floor.cols, floor.rows]);

  const handleClearUnusable = useCallback(() => {
    if (selectedCells.length === 0) {
      setUnusableCells([]);
      return;
    }
    const finest = selectedCellsToFinest(selectedCells, baseUnit, a, subdivision);
    const drop = new Set(finest.map((c) => `${c.col},${c.row}`));
    setUnusableCells((prev) => prev.filter((c) => !drop.has(`${c.col},${c.row}`)));
    setSelectedCells([]);
  }, [selectedCells, baseUnit, a, subdivision]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIdsRef.current.length === 0) return;
    const drop = new Set(selectedIdsRef.current);
    setEntities(entitiesRef.current.filter((ent) => !drop.has(ent.objectId)));
    setSelectedIds([]);
    setShowEntityMenu(false);
  }, [setEntities]);

  const handleScaleUp = useCallback(() => {
    if (selectedEntities.length !== 1) return;
    const e = selectedEntities[0];
    if (isPolygonEntity(e)) return;
    const next = scaleEntityUp(e, subdivision);
    if (!next) return;
    if (!entityFitsFloor(next)) {
      showToast('Scaled entity would leave the floor or hit unusable cells.');
      return;
    }
    setEntities(
      entitiesRef.current.map((ent) => (ent.objectId === e.objectId ? next : ent)),
    );
  }, [selectedEntities, subdivision, setEntities, entityFitsFloor, showToast]);

  const handleScaleDown = useCallback(() => {
    if (selectedEntities.length !== 1) return;
    const e = selectedEntities[0];
    if (isPolygonEntity(e)) return;
    const next = scaleEntityDown(e, subdivision);
    if (!next) return;
    setEntities(
      entitiesRef.current.map((ent) => (ent.objectId === e.objectId ? next : ent)),
    );
  }, [selectedEntities, subdivision, setEntities]);

  const handleRotate = useCallback(() => {
    if (selectedEntities.length !== 1) return;
    const e = selectedEntities[0];
    if (e.category === 'text') return;
    const next = rotateEntity90CCW(e);
    if (!entityFitsFloor(next)) {
      showToast('Rotated entity would leave the floor or hit unusable cells.');
      return;
    }
    setEntities(
      entitiesRef.current.map((ent) => (ent.objectId === e.objectId ? next : ent)),
    );
  }, [selectedEntities, setEntities, entityFitsFloor, showToast]);

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
        setShowEntityMenu(false);
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
        setEntities(entitiesRef.current.filter((ent) => !drop.has(ent.objectId)));
        setSelectedIds([]);
        setShowEntityMenu(false);
      }

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
        const stepCells = snapSizeWorld > 0 ? Math.max(1, Math.round(snapSizeWorld / a)) : 1;
        const large = e.shiftKey ? 4 : 1;
        const delta = stepCells * large;
        let dCol = 0;
        let dRow = 0;
        if (e.key === 'ArrowLeft') dCol = -delta;
        if (e.key === 'ArrowRight') dCol = delta;
        if (e.key === 'ArrowDown') dRow = -delta;
        if (e.key === 'ArrowUp') dRow = delta;

        const idSet = new Set(selectedIdsRef.current);
        setEntities(
          entitiesRef.current.map((ent) =>
            idSet.has(ent.objectId) ? translateEntity(ent, dCol, dRow) : ent,
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
  }, [setEntities, handleCopy, handlePaste, snapSizeWorld, a]);

  const applyPolygonResize = (
    origin: Entity,
    handle: ResizeHandle,
    world: Point,
    snap: number,
  ): Entity => {
    const b = entityWorldRect(origin, a);
    let { x, y, width, height } = b;
    const right = x + width;
    const top = y + height;
    let nx = world.x;
    let ny = world.y;
    if (snap > 0) {
      nx = snapToGrid(nx, snap);
      ny = snapToGrid(ny, snap);
    }
    if (handle.includes('e')) width = Math.max(a, nx - x);
    if (handle.includes('w')) {
      const newX = Math.min(nx, right - a);
      width = right - newX;
      x = newX;
    }
    if (handle.includes('n')) height = Math.max(a, ny - y);
    if (handle.includes('s')) {
      const newY = Math.min(ny, top - a);
      height = top - newY;
      y = newY;
    }
    const widthCells = Math.max(1, Math.round(width / a));
    const heightCells = Math.max(1, Math.round(height / a));
    const originCell = {
      col: Math.max(0, Math.round(x / a)),
      row: Math.max(0, Math.round(y / a)),
    };
    return resizePolygonEntity(origin, { origin: originCell, widthCells, heightCells });
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
    setShowEntityMenu(true);

    movedRef.current = false;
    dragRef.current = {
      type: 'move',
      startWorld: world,
      originEntities: entitiesRef.current.map((ent) => cloneEntity(ent, ent.objectId)),
      ids,
    };
  };

  const handleHandleDown = (handle: ResizeHandle, e: React.MouseEvent) => {
    if (selectedEntities.length !== 1) return;
    const ent = selectedEntities[0];
    if (!isPolygonEntity(ent)) return;
    movedRef.current = false;
    dragRef.current = {
      type: 'resize',
      handle,
      startWorld: clientToWorld(e.clientX, e.clientY),
      originEntities: entitiesRef.current.map((x) => cloneEntity(x, x.objectId)),
      entityId: ent.objectId,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const world = clientToWorld(e.clientX, e.clientY);
    movedRef.current = false;

    if (placeItem && e.button === 0 && !e.ctrlKey && !e.metaKey) {
      void placeEntityAt(placeItem, world);
      return;
    }

    const hit = hitTestEntity(entitiesRef.current, world, a);
    const wantPan =
      e.button === 1 ||
      tool === 'pan' ||
      spaceHeld ||
      (e.button === 0 && !e.ctrlKey && !e.metaKey && !hit);

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
      setClampedViewport({
        zoom: viewportRef.current.zoom,
        panX: drag.panX + dx,
        panY: drag.panY + dy,
      });
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
      const dCol = Math.round(dx / a);
      const dRow = Math.round(dy / a);
      const idSet = new Set(drag.ids);
      replaceEntities(
        drag.originEntities.map((ent) =>
          idSet.has(ent.objectId) ? translateEntity(ent, dCol, dRow) : ent,
        ),
      );
      return;
    }

    if (drag.type === 'resize') {
      const origin = drag.originEntities.find((ent) => ent.objectId === drag.entityId);
      if (!origin) return;
      const next = applyPolygonResize(origin, drag.handle, world, snapSizeWorld);
      replaceEntities(
        drag.originEntities.map((ent) => (ent.objectId === next.objectId ? next : ent)),
      );
    }
  };

  const handleMouseUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;

    if (drag?.type === 'pan') {
      if (!movedRef.current) {
        const cell = worldToCell(drag.worldAtStart, gridLevel, baseUnit, subdivision);
        if (cell.col >= 0 && cell.row >= 0) {
          if (!drag.shift) setSelectedIds([]);
          setSelectedCells((prev) => mergeCells(prev, [cell], drag.shift));
          setShowEntityMenu(false);
        }
      }
      return;
    }

    if (drag?.type === 'marquee') {
      const rect = worldRectFromPoints(drag.startWorld, drag.currentWorld);
      setMarqueeRect(null);
      if (rect.width * viewport.zoom < CLICK_PX && rect.height * viewport.zoom < CLICK_PX) {
        return;
      }
      const hit = entitiesIntersectingRect(entitiesRef.current, rect, a);
      if (hit.length > 0) {
        const ids = hit.map((h) => h.objectId);
        setSelectedIds((prev) =>
          drag.additive ? Array.from(new Set([...prev, ...ids])) : ids,
        );
        setSelectedCells([]);
        setShowEntityMenu(ids.length === 1);
      } else {
        const cells = cellsInWorldRect(rect, gridLevel, baseUnit, subdivision).filter(
          (c) => c.col >= 0 && c.row >= 0,
        );
        setSelectedCells((prev) => mergeCells(prev, cells, drag.additive));
        if (!drag.additive) setSelectedIds([]);
        setShowEntityMenu(false);
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
    setEntities(entities.map((e) => (e.objectId === id ? { ...e, ...patch } : e)));
  };

  const handleSaveDraft = (name: string) => {
    saveDraft({ ...buildDocument(), name });
  };

  const applyDocument = (doc: FloorDocument) => {
    setFloor(doc.floor);
    setSubdivision(doc.subdivision);
    if (doc.viewport) setClampedViewport(doc.viewport);
    resetEntities(doc.entities);
    setZones(doc.zones ?? []);
    setCustomLibrary(doc.customLibrary ?? []);
    setUnusableCells(doc.unusableCells ?? []);
    setSelectedIds([]);
    setSelectedCells([]);
    if (doc.theme) setTheme(doc.theme);
  };

  const handleLoadDraft = (name: string) => {
    const doc = loadDraft(name);
    if (!doc) return;
    applyDocument(doc);
  };

  const handleImportJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const doc = JSON.parse(String(reader.result)) as FloorDocument;
        if (doc.version !== 2) {
          showToast('Unsupported floor JSON version.');
          return;
        }
        applyDocument(doc);
      } catch {
        showToast('Failed to parse floor JSON.');
      }
    };
    reader.readAsText(file);
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
    const fw = floorWorldWidth(floor);
    const fh = floorWorldHeight(floor);
    // Label every current grid cell (e.g. 4,8,12… in cell units), not only major baseUnit.
    // If labels would be denser than ~36px, thin to every 2nd/4th tick.
    const minLabelPx = 36;
    let step = gridCellSize;
    while (step * viewport.zoom < minLabelPx && step < baseUnit * 4) {
      step *= 2;
    }
    const xs: number[] = [];
    const ys: number[] = [];
    const startX = Math.max(0, Math.ceil(bounds.minX / step - 1e-9) * step);
    for (let x = startX; x <= Math.min(bounds.maxX, fw) + 1e-9; x += step) xs.push(x);
    const startY = Math.max(0, Math.ceil(bounds.minY / step - 1e-9) * step);
    for (let y = startY; y <= Math.min(bounds.maxY, fh) + 1e-9; y += step) ys.push(y);
    // Always include origin when visible
    if (bounds.minX <= 0 && bounds.maxX >= 0 && !xs.includes(0)) xs.unshift(0);
    if (bounds.minY <= 0 && bounds.maxY >= 0 && !ys.includes(0)) ys.unshift(0);
    return { xs: xs.slice(0, 60), ys: ys.slice(0, 60) };
  }, [viewport, svgSize, gridCellSize, baseUnit, floor]);

  const cursorStyle =
    tool === 'pan' || spaceHeld ? 'grab' : placeItem ? 'crosshair' : 'default';

  const singleSelected = selectedEntities.length === 1 ? selectedEntities[0] : null;
  const canScaleUp = Boolean(
    singleSelected && !isPolygonEntity(singleSelected) && singleSelected.category !== 'text',
  );
  const canScaleDown = Boolean(
    singleSelected &&
      !isPolygonEntity(singleSelected) &&
      singleSelected.category !== 'text' &&
      singleSelected.scaleLevel > 0 &&
      singleSelected.widthCells % subdivision === 0 &&
      singleSelected.heightCells % subdivision === 0,
  );

  const colorFor = (entity: Entity) => colorForEntity(entity, allLibrary);

  const cursorCell = worldToFinestCell(cursorWorld, a);

  return (
    <div className="editor-layout">
      <Toolbar
        viewport={viewport}
        tool={tool === 'place' ? 'select' : tool}
        showGrid={showGrid}
        snapEnabled={snapEnabled}
        includeGridOnExport={includeGridOnExport}
        theme={theme}
        subdivision={subdivision}
        canUndo={canUndo}
        canRedo={canRedo}
        canPaste={clipboard.length > 0}
        canDelete={selectedIds.length > 0}
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
        onSubdivisionChange={setSubdivision}
        onUndo={undo}
        onRedo={redo}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onDelete={handleDeleteSelected}
        onHowToUse={() => setHowToOpen(true)}
        onSaveDraft={handleSaveDraft}
        onLoadDraft={handleLoadDraft}
        onExportPng={() => void runExport('png')}
        onExportSvg={() => void runExport('svg')}
        onExportPdf={() => void runExport('pdf')}
        onOpenPretty={() => onOpenPretty(buildDocument())}
      />

      <div className="editor-body">
        <EntityLibrary
          categories={categories}
          customItems={customLibrary}
          activeId={placeItem?.id ?? null}
          onSelect={(item) => {
            setPlaceItem(item);
            setTool('place');
          }}
          onDeleteCustom={(id) =>
            setCustomLibrary((prev) => deleteCustomLibraryEntry(prev, id))
          }
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
                <rect
                  x={0}
                  y={0}
                  width={floorWorldWidth(floor)}
                  height={floorWorldHeight(floor)}
                />
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
                subdivision={subdivision}
              />
              <OutsideFloorOverlay
                floor={floor}
                viewport={viewport}
                svgWidth={svgSize.width}
                svgHeight={svgSize.height}
              />
              <UnusableLayer cells={unusableCells} a={a} />
              <ZonesLayer zones={zones} a={a} />
              <CellHighlight
                hoveredCell={hoveredCell}
                selectedCells={selectedCells}
                baseUnit={baseUnit}
                subdivision={subdivision}
              />
              <EntitiesLayer
                entities={entities}
                selectedIds={selectedSet}
                a={a}
                colorFor={colorFor}
                onEntityPointerDown={handleEntityPointerDown}
              />
              {singleSelected && isPolygonEntity(singleSelected) && (
                <ResizeHandles
                  entity={singleSelected}
                  a={a}
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
                const sy = svgSize.height - 10;
                if (sx < 2 || sx > svgSize.width - 8) return null;
                return (
                  <text key={`lx-${wx}`} x={sx} y={sy} textAnchor="middle">
                    {Math.round(wx / a)}
                  </text>
                );
              })}
              {axisLabels.ys.map((wy) => {
                const sx = 10;
                const sy = -wy * viewport.zoom + viewport.panY;
                if (sy < 10 || sy > svgSize.height - 14) return null;
                return (
                  <text key={`ly-${wy}`} x={sx} y={sy} textAnchor="start" dominantBaseline="middle">
                    {Math.round(wy / a)}
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
              canPaste={clipboard.length > 0}
              onMarkPolygon={handleMarkAsPolygon}
              onPaste={handlePaste}
              onCopyZone={handleCopyZone}
              onMarkZone={() => void handleMarkZone()}
              onMarkUnusable={handleMarkUnusable}
              onClearUnusable={handleClearUnusable}
              onClear={() => setSelectedCells([])}
            />
          )}

          {entityMenuPos && (
            <EntityActionMenu
              x={entityMenuPos.x}
              y={entityMenuPos.y}
              canScaleUp={canScaleUp}
              canScaleDown={canScaleDown}
              onCopy={handleCopy}
              onScaleUp={handleScaleUp}
              onScaleDown={handleScaleDown}
              onRotate={handleRotate}
              onDelete={handleDeleteSelected}
              onClose={() => setShowEntityMenu(false)}
            />
          )}

          <div className="status-bar">
            <span>
              cell ({Math.max(0, cursorCell.col)}, {Math.max(0, cursorCell.row)})
            </span>
            <span>
              a={floor.a} · cell {gridCellSize.toFixed(2)} · L{gridLevel} · split {subdivision}x
            </span>
            <span>{snapEnabled ? 'Snap ON' : 'Snap OFF'}</span>
            <span>
              {selectedIds.length > 0
                ? `${selectedIds.length} entity(s)`
                : selectedCells.length > 0
                  ? `${selectedCells.length} cell(s)`
                  : 'Nothing selected'}
            </span>
          </div>
        </div>

        <PropertiesPanel
          floor={floor}
          subdivision={subdivision}
          onFloorChange={setFloor}
          onSubdivisionChange={setSubdivision}
          selected={selectedEntities}
          onUpdateSelected={handleUpdateSelected}
          zones={zones}
          onDeleteZone={(id) => setZones((prev) => prev.filter((z) => z.id !== id))}
          onExportJson={() => downloadFloorJson(buildDocument())}
          onCopyJson={() => {
            void navigator.clipboard.writeText(floorDocumentToJson(buildDocument()));
          }}
          onImportJson={handleImportJson}
        />
      </div>

      <HowToUseModal open={howToOpen} onClose={() => setHowToOpen(false)} />
      <SavePolygonDialog
        open={Boolean(polygonPending)}
        defaultLabel={`Polygon ${customLibrary.length + 1}`}
        onCancel={() => setPolygonPending(null)}
        onSave={confirmPolygonSave}
      />
      <PromptToast
        request={promptReq}
        onCancel={() => {
          promptResolve?.(null);
          setPromptResolve(null);
          setPromptReq(null);
        }}
        onSubmit={(value) => {
          promptResolve?.(value);
          setPromptResolve(null);
          setPromptReq(null);
        }}
      />
      <MessageToast message={toastMsg} onClose={() => setToastMsg(null)} />
    </div>
  );
};

export default FloorEditor;
