import type { Asset } from '../types/geometry.js';

/** Serialize an asset footprint to a standalone annotation SVG (grid coordinates). */
export function renderAnnotationSvg(asset: Asset): string {
  const grid = asset.metadata.unitGrid;
  const columns = grid?.columns ?? 64;
  const rows = grid?.rows ?? 64;
  const label = asset.label ?? asset.id;
  const geometry = asset.geometry;
  let shape = '';
  if (geometry?.type === 'rectangle') {
    shape = `<rect x="${geometry.x}" y="${geometry.y}" width="${geometry.width}" height="${geometry.height}" class="annotation"/>`;
  } else if (geometry?.type === 'orthogonal-polygon') {
    shape = `<polygon points="${geometry.points.map(p => p.join(',')).join(' ')}" class="annotation"/>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${columns} ${rows}" width="${columns}" height="${rows}" data-source="${escapeXml(asset.source)}" data-label="${escapeXml(label)}" data-status="${asset.metadata.status}">
  <title>${escapeXml(label)}</title>
  <style>.annotation{fill:rgba(220,38,38,.25);stroke:#dc2626;stroke-width:0.4;stroke-linejoin:miter}</style>
  ${shape}
</svg>
`;
}

export function annotationOutputPath(source: string): string {
  return source.replace(/\\/g, '/').replace(/\.[^/.]+$/, '.svg');
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
