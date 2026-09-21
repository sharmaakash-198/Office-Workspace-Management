import React, { useMemo } from 'react';
import type { FloorDocument } from '../lib/drafts';
import { assetUrl } from '../lib/catalog';
import { floorWorldHeight, floorWorldWidth } from '../types/geometry';
import { isPolygonEntity } from '../geometry/entities';

interface PrettyFloorViewProps {
  document: FloorDocument;
  onBack: () => void;
}

/** Ensure tiny footprints still render a readable icon in viewBox units. */
function displaySize(w: number, h: number, a: number): { w: number; h: number; padX: number; padY: number } {
  const minSide = Math.max(a * 1.25, 0.35);
  const dw = Math.max(w, minSide);
  const dh = Math.max(h, minSide);
  return {
    w: dw,
    h: dh,
    padX: (dw - w) / 2,
    padY: (dh - h) / 2,
  };
}

const PrettyFloorView: React.FC<PrettyFloorViewProps> = ({ document: doc, onBack }) => {
  const a = doc.a;
  const floor = doc.floor;
  const width = floorWorldWidth(floor);
  const height = floorWorldHeight(floor);
  const unusable = doc.unusableCells ?? [];

  const viewBox = useMemo(() => `0 0 ${width} ${height}`, [width, height]);

  return (
    <div className="pretty-layout">
      <header className="toolbar">
        <div className="toolbar-brand">
          <span className="brand-mark" aria-hidden />
          <span>Pretty floor view</span>
        </div>
        <div className="toolbar-spacer" />
        <button type="button" className="toolbar-btn" onClick={onBack}>
          Back to planner
        </button>
      </header>
      <div className="pretty-canvas">
        <svg
          className="pretty-svg"
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          aria-label="Pretty floor render"
        >
          <rect x={0} y={0} width={width} height={height} className="pretty-floor" />

          <g transform={`translate(0, ${height}) scale(1, -1)`}>
            {unusable.map((c) => (
              <rect
                key={`u-${c.col}-${c.row}`}
                x={c.col * a}
                y={c.row * a}
                width={a}
                height={a}
                fill="rgba(100,116,139,0.28)"
              />
            ))}

            {doc.zones.map((zone) =>
              zone.cells.map((c) => (
                <rect
                  key={`${zone.id}-${c.col}-${c.row}`}
                  x={c.col * a}
                  y={c.row * a}
                  width={a}
                  height={a}
                  fill={zone.color}
                />
              )),
            )}

            {doc.entities.map((e) => {
              const x = e.origin.col * a;
              const y = e.origin.row * a;
              const w = e.widthCells * a;
              const h = e.heightCells * a;
              const rot = e.rotation ?? 0;
              const cx = x + w / 2;
              const cy = y + h / 2;
              // In Y-up world group, positive rotate is CCW; SVG rotate is CW in Y-down,
              // but we are already in flipped Y, so use -rot for visual CCW on screen.
              const rotAttr = rot ? `rotate(${-rot}, ${cx}, ${cy})` : undefined;

              if (e.category === 'text') {
                return (
                  <g
                    key={e.objectId}
                    transform={`translate(${cx}, ${cy}) scale(1, -1)${rot ? ` rotate(${rot})` : ''}`}
                  >
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={Math.max((e.fontSize ?? 0.5) * a, a * 0.35)}
                      fill={e.color ?? '#334155'}
                    >
                      {e.label}
                    </text>
                  </g>
                );
              }

              if (isPolygonEntity(e) && e.svgPath) {
                return (
                  <g
                    key={e.objectId}
                    transform={[rotAttr, `translate(${x}, ${y})`, `scale(${a})`]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <path
                      d={e.svgPath}
                      fill={e.color ?? '#94a3b8'}
                      fillOpacity={0.12}
                      stroke={e.color ?? '#64748b'}
                      strokeWidth={0.08}
                    />
                  </g>
                );
              }

              const href = assetUrl(e.svg);
              if (href) {
                const sized = displaySize(w, h, a);
                const ix = x - sized.padX;
                const iy = y - sized.padY;
                const icx = ix + sized.w / 2;
                const icy = iy + sized.h / 2;
                const imgRot = rot ? `rotate(${-rot}, ${icx}, ${icy})` : undefined;
                return (
                  <g key={e.objectId} transform={imgRot}>
                    <image
                      href={href}
                      x={ix}
                      y={iy}
                      width={sized.w}
                      height={sized.h}
                      preserveAspectRatio="xMidYMid meet"
                    />
                  </g>
                );
              }

              return (
                <g key={e.objectId} transform={rotAttr}>
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    fill={e.color ?? '#94a3b8'}
                    fillOpacity={0.35}
                    stroke={e.color ?? '#64748b'}
                    strokeWidth={a * 0.05}
                  />
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
};

export default PrettyFloorView;
