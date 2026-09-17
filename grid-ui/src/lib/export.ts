import { jsPDF } from 'jspdf';
import type { FloorConfig } from '../types/geometry';
import { getBaseUnit, getLevelCellSize, MAX_LEVEL } from '../geometry/grid';

export type ExportThemeColors = {
  canvasBg: string;
  floorFill: string;
  floorStroke: string;
  gridMajor: string;
  gridMinor: string;
  gridOrigin: string;
  entityLabel: string;
  axisLabel: string;
};

const LIGHT_DEFAULT: ExportThemeColors = {
  canvasBg: '#f0f1f3',
  floorFill: '#fafafa',
  floorStroke: '#64748b',
  gridMajor: 'rgba(100, 116, 139, 0.4)',
  gridMinor: 'rgba(100, 116, 139, 0.16)',
  gridOrigin: '#64748b',
  entityLabel: '#1e293b',
  axisLabel: 'rgba(71, 85, 105, 0.85)',
};

/** Default raster resolution: pixels per world meter. */
const DEFAULT_PPM = 24;
/** Cap export edge so browsers can still rasterize huge floors. */
const MAX_EXPORT_EDGE_PX = 8000;

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function readThemeColors(root: Element): ExportThemeColors {
  const cs = getComputedStyle(root);
  const pick = (name: string, fallback: string) =>
    cs.getPropertyValue(name).trim() || fallback;
  return {
    canvasBg: pick('--canvas-bg', LIGHT_DEFAULT.canvasBg),
    floorFill: pick('--floor-fill', LIGHT_DEFAULT.floorFill),
    floorStroke: pick('--floor-stroke', LIGHT_DEFAULT.floorStroke),
    gridMajor: pick('--grid-major', LIGHT_DEFAULT.gridMajor),
    gridMinor: pick('--grid-minor', LIGHT_DEFAULT.gridMinor),
    gridOrigin: pick('--grid-origin', LIGHT_DEFAULT.gridOrigin),
    entityLabel: pick('--entity-label', LIGHT_DEFAULT.entityLabel),
    axisLabel: pick('--axis-label', LIGHT_DEFAULT.axisLabel),
  };
}

function bakeColors(clone: SVGSVGElement, colors: ExportThemeColors): void {
  clone.querySelectorAll('.canvas-bg').forEach((el) => {
    el.setAttribute('fill', colors.canvasBg);
  });
  const floor = clone.querySelector('#floor-boundary');
  if (floor) {
    floor.setAttribute('fill', colors.floorFill);
    floor.setAttribute('stroke', colors.floorStroke);
  }
  clone.querySelectorAll('.grid-line.major').forEach((el) => {
    el.setAttribute('stroke', colors.gridMajor);
    el.setAttribute('stroke-width', '1.1');
  });
  clone.querySelectorAll('.grid-line.minor').forEach((el) => {
    el.setAttribute('stroke', colors.gridMinor);
    el.setAttribute('stroke-width', '0.6');
  });
  clone.querySelectorAll('.grid-origin').forEach((el) => {
    el.setAttribute('fill', colors.gridOrigin);
  });
  clone.querySelectorAll('.entity-label').forEach((el) => {
    el.setAttribute('fill', colors.entityLabel);
  });
}

function injectFullFloorGrid(
  grid: Element,
  floor: FloorConfig,
  colors: ExportThemeColors,
): void {
  while (grid.firstChild) grid.removeChild(grid.firstChild);
  const baseUnit = getBaseUnit(floor.a, MAX_LEVEL);
  const minor = getLevelCellSize(MAX_LEVEL, baseUnit); // = a
  const major = baseUnit;

  const ns = 'http://www.w3.org/2000/svg';
  const addLine = (x1: number, y1: number, x2: number, y2: number, majorLine: boolean) => {
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', String(x1));
    line.setAttribute('y1', String(y1));
    line.setAttribute('x2', String(x2));
    line.setAttribute('y2', String(y2));
    line.setAttribute('class', majorLine ? 'grid-line major' : 'grid-line minor');
    line.setAttribute('stroke', majorLine ? colors.gridMajor : colors.gridMinor);
    line.setAttribute('stroke-width', majorLine ? '1.1' : '0.6');
    line.setAttribute('vector-effect', 'non-scaling-stroke');
    grid.appendChild(line);
  };

  const isMajor = (pos: number) => {
    const rem = ((pos % major) + major) % major;
    return rem < 1e-6 || Math.abs(rem - major) < 1e-6;
  };

  for (let x = 0; x <= floor.width + 1e-9; x += minor) {
    addLine(x, 0, x, floor.height, isMajor(x));
  }
  for (let y = 0; y <= floor.height + 1e-9; y += minor) {
    addLine(0, y, floor.width, y, isMajor(y));
  }
}

/**
 * Build an SVG of the entire working floor (not just the current viewport).
 */
export function buildFullFloorSvg(
  liveSvg: SVGSVGElement,
  floor: FloorConfig,
  includeGrid: boolean,
  colors?: ExportThemeColors,
  pixelsPerMeter: number = DEFAULT_PPM,
): { svg: SVGSVGElement; widthPx: number; heightPx: number } {
  const theme =
    colors ??
    (typeof document !== 'undefined'
      ? readThemeColors(document.documentElement)
      : LIGHT_DEFAULT);

  let ppm = pixelsPerMeter;
  const rawW = floor.width * ppm;
  const rawH = floor.height * ppm;
  const scaleDown = Math.min(1, MAX_EXPORT_EDGE_PX / Math.max(rawW, rawH, 1));
  ppm *= scaleDown;
  const widthPx = Math.max(1, Math.round(floor.width * ppm));
  const heightPx = Math.max(1, Math.round(floor.height * ppm));

  const clone = liveSvg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(widthPx));
  clone.setAttribute('height', String(heightPx));
  clone.removeAttribute('style');

  // Drop UI chrome
  clone.querySelector('#selection-marquee')?.remove();
  clone.querySelector('#cell-highlight')?.remove();
  clone.querySelector('#resize-handles')?.remove();
  clone.querySelector('#axis-labels')?.remove();
  clone.querySelector('#polygon-draft')?.remove();

  const canvasBg = clone.querySelector('.canvas-bg');
  if (canvasBg) {
    canvasBg.setAttribute('width', String(widthPx));
    canvasBg.setAttribute('height', String(heightPx));
    canvasBg.setAttribute('fill', theme.canvasBg);
  }

  const viewport = clone.querySelector('#viewport');
  if (viewport) {
    // World Y-up → screen Y-down, covering [0,width]×[0,height]
    viewport.setAttribute(
      'transform',
      `translate(0, ${heightPx}) scale(${ppm}, ${-ppm})`,
    );
  }

  const grid = clone.querySelector('#grid');
  if (!includeGrid) {
    grid?.remove();
  } else if (grid) {
    injectFullFloorGrid(grid, floor, theme);
  }

  bakeColors(clone, theme);
  return { svg: clone, widthPx, heightPx };
}

function serializeFullFloor(
  liveSvg: SVGSVGElement,
  floor: FloorConfig,
  includeGrid: boolean,
  colors?: ExportThemeColors,
): { xml: string; widthPx: number; heightPx: number; theme: ExportThemeColors } {
  const theme =
    colors ??
    (typeof document !== 'undefined'
      ? readThemeColors(document.documentElement)
      : LIGHT_DEFAULT);
  const { svg, widthPx, heightPx } = buildFullFloorSvg(
    liveSvg,
    floor,
    includeGrid,
    theme,
  );
  return {
    xml: new XMLSerializer().serializeToString(svg),
    widthPx,
    heightPx,
    theme,
  };
}

export function exportSvg(
  liveSvg: SVGSVGElement,
  floor: FloorConfig,
  filename: string,
  includeGrid: boolean,
  colors?: ExportThemeColors,
): void {
  const { xml } = serializeFullFloor(liveSvg, floor, includeGrid, colors);
  downloadBlob(filename, new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
}

function fullFloorToPngDataUrl(
  liveSvg: SVGSVGElement,
  floor: FloorConfig,
  includeGrid: boolean,
  colors?: ExportThemeColors,
): Promise<{ dataUrl: string; widthPx: number; heightPx: number }> {
  const { xml, widthPx, heightPx, theme } = serializeFullFloor(
    liveSvg,
    floor,
    includeGrid,
    colors,
  );
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = widthPx;
      canvas.height = heightPx;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas unavailable'));
        return;
      }
      ctx.fillStyle = theme.canvasBg || '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, widthPx, heightPx);
      URL.revokeObjectURL(url);
      resolve({ dataUrl: canvas.toDataURL('image/png'), widthPx, heightPx });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to rasterize SVG'));
    };
    img.src = url;
  });
}

export async function exportPng(
  liveSvg: SVGSVGElement,
  floor: FloorConfig,
  filename: string,
  includeGrid: boolean,
  colors?: ExportThemeColors,
): Promise<void> {
  const { dataUrl } = await fullFloorToPngDataUrl(liveSvg, floor, includeGrid, colors);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export async function exportPdf(
  liveSvg: SVGSVGElement,
  floor: FloorConfig,
  filename: string,
  includeGrid: boolean,
  colors?: ExportThemeColors,
): Promise<void> {
  const { dataUrl, widthPx, heightPx } = await fullFloorToPngDataUrl(
    liveSvg,
    floor,
    includeGrid,
    colors,
  );
  const orientation = widthPx >= heightPx ? 'landscape' : 'portrait';
  const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const scale = Math.min((pageW - margin * 2) / widthPx, (pageH - margin * 2) / heightPx);
  const drawW = widthPx * scale;
  const drawH = heightPx * scale;
  const x = (pageW - drawW) / 2;
  const y = (pageH - drawH) / 2;
  pdf.addImage(dataUrl, 'PNG', x, y, drawW, drawH);
  pdf.save(filename);
}
