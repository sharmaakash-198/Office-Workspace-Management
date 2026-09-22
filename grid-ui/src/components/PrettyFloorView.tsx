import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { FloorDocument } from '../lib/drafts';
import { normalizeUnusableRegions } from '../lib/drafts';
import { assetUrl } from '../lib/catalog';
import { floorWorldHeight, floorWorldWidth } from '../types/geometry';
import { isPolygonEntity } from '../geometry/entities';
import { FINEST_PER_A } from '../geometry/grid';
import { cellsToMergedRects } from '../geometry/cellMerge';

interface PrettyFloorViewProps {
  document: FloorDocument;
  onBack: () => void;
}

type Cam = { zoom: number; panX: number; panY: number };

const PrettyFloorView: React.FC<PrettyFloorViewProps> = ({ document: doc, onBack }) => {
  const a = doc.a;
  const floor = doc.floor;
  const width = floorWorldWidth(floor);
  const height = floorWorldHeight(floor);
  const f = a / FINEST_PER_A;
  const unusable = normalizeUnusableRegions(doc);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [cam, setCam] = useState<Cam>({ zoom: 1, panX: 0, panY: 0 });
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width: w, height: h } = entries[0].contentRect;
      setSize({ w, h });
    });
    ro.observe(el);
    const { width: w, height: h } = el.getBoundingClientRect();
    setSize({ w, h });
    return () => ro.disconnect();
  }, []);

  // Fit floor when canvas size / floor changes
  useEffect(() => {
    if (size.w < 10 || size.h < 10) return;
    const pad = 32;
    const zoom = Math.min((size.w - pad * 2) / width, (size.h - pad * 2) / height);
    setCam({
      zoom: Math.max(zoom, 0.01),
      panX: (size.w - width * zoom) / 2,
      panY: (size.h - height * zoom) / 2,
    });
  }, [size.w, size.h, width, height]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setCam((c) => {
        const worldX = (mx - c.panX) / c.zoom;
        const worldY = (my - c.panY) / c.zoom;
        const zoom = Math.min(80, Math.max(0.02, c.zoom * factor));
        return {
          zoom,
          panX: mx - worldX * zoom,
          panY: my - worldY * zoom,
        };
      });
    };
    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNative);
  }, []);

  const zoneRects = useMemo(
    () =>
      doc.zones.map((z) => ({
        id: z.id,
        color: z.color,
        rects: cellsToMergedRects(z.cells, f),
      })),
    [doc.zones, f],
  );

  const unusableRects = useMemo(
    () =>
      unusable.map((r) => ({
        id: r.id,
        rects: cellsToMergedRects(r.cells, f),
      })),
    [unusable, f],
  );

  return (
    <div className="pretty-layout">
      <header className="toolbar pretty-toolbar fixed-bar">
        <div className="toolbar-brand">
          <span className="brand-mark" aria-hidden />
          <span>Preview</span>
        </div>
        <span className="pretty-size mono">
          {floor.cols}×{floor.rows}
        </span>
        <span className="panel-hint" style={{ marginLeft: 12 }}>
          Scroll to zoom · drag to pan
        </span>
        <div className="toolbar-spacer" />
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => {
            const pad = 32;
            const zoom = Math.min((size.w - pad * 2) / width, (size.h - pad * 2) / height);
            setCam({
              zoom: Math.max(zoom, 0.01),
              panX: (size.w - width * zoom) / 2,
              panY: (size.h - height * zoom) / 2,
            });
          }}
        >
          Fit
        </button>
        <button type="button" className="toolbar-btn" onClick={onBack}>
          Back to planner
        </button>
      </header>
      <div
        className="pretty-canvas"
        ref={wrapRef}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          dragRef.current = {
            x: e.clientX,
            y: e.clientY,
            panX: cam.panX,
            panY: cam.panY,
          };
        }}
        onMouseMove={(e) => {
          const d = dragRef.current;
          if (!d) return;
          setCam((c) => ({
            ...c,
            panX: d.panX + (e.clientX - d.x),
            panY: d.panY + (e.clientY - d.y),
          }));
        }}
        onMouseUp={() => {
          dragRef.current = null;
        }}
        onMouseLeave={() => {
          dragRef.current = null;
        }}
      >
        <svg
          className="pretty-svg-interactive"
          width={size.w}
          height={size.h}
          aria-label="Floor preview"
        >
          <rect x={0} y={0} width={size.w} height={size.h} className="pretty-canvas-bg" />
          <g transform={`translate(${cam.panX}, ${cam.panY}) scale(${cam.zoom})`}>
            <rect x={0} y={0} width={width} height={height} className="pretty-floor" />

            {/* Screen Y-down: flip world Y-up content */}
            <g transform={`translate(0, ${height}) scale(1, -1)`}>
              {unusableRects.map((region) =>
                region.rects.map((r, i) => (
                  <rect
                    key={`${region.id}-${i}`}
                    x={r.x}
                    y={r.y}
                    width={r.width}
                    height={r.height}
                    fill="rgba(100,116,139,0.28)"
                  />
                )),
              )}

              {zoneRects.map((zone) =>
                zone.rects.map((r, i) => (
                  <rect
                    key={`${zone.id}-${i}`}
                    x={r.x}
                    y={r.y}
                    width={r.width}
                    height={r.height}
                    fill={zone.color}
                  />
                )),
              )}

              {doc.entities.map((e) => {
                const x = e.origin.col * f;
                const y = e.origin.row * f;
                const w = Math.max(e.widthCells * f, f);
                const h = Math.max(e.heightCells * f, f);
                const rot = e.rotation ?? 0;
                const cx = x + w / 2;
                const cy = y + h / 2;

                if (e.category === 'text') {
                  return (
                    <g
                      key={e.objectId}
                      transform={`translate(${cx}, ${cy}) scale(1, -1)`}
                    >
                      <text
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={Math.max((e.fontSize ?? 0.5) * a, f * 6)}
                        fill={e.color ?? '#334155'}
                      >
                        {e.label}
                      </text>
                    </g>
                  );
                }

                if (isPolygonEntity(e) && e.svgPath) {
                  return (
                    <g key={e.objectId} transform={`translate(${x}, ${y}) scale(${f})`}>
                      <path
                        d={e.svgPath}
                        fill={e.color ?? '#94a3b8'}
                        fillOpacity={0.15}
                        stroke={e.color ?? '#64748b'}
                        strokeWidth={0.12}
                      />
                    </g>
                  );
                }

                const href = assetUrl(e.svg);
                if (href) {
                  return (
                    <g
                      key={e.objectId}
                      transform={`translate(${cx}, ${cy}) scale(1, -1) rotate(${rot}) translate(${-w / 2}, ${-h / 2})`}
                    >
                      <image
                        href={href}
                        x={0}
                        y={0}
                        width={w}
                        height={h}
                        preserveAspectRatio="xMidYMid meet"
                      />
                    </g>
                  );
                }

                return (
                  <rect
                    key={e.objectId}
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    fill={e.color ?? '#94a3b8'}
                    fillOpacity={0.4}
                    stroke={e.color ?? '#64748b'}
                    strokeWidth={f * 0.5}
                  />
                );
              })}
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
};

export default PrettyFloorView;
