/**
 * DimensionAnnotation
 *
 * Renders engineering-style dimension lines for a selected entity:
 *   - A horizontal line spanning the full width below the entity, labelled in metres
 *   - A vertical line spanning the full height to the right of the entity, labelled in metres
 *
 * Coordinates live in world-space (same as entityWorldBounds).
 * The viewport transform already flips Y, so text groups use scale(1,-1) to
 * cancel the flip and read normally.
 */

import React from 'react';
import type { Entity } from '../types/floorplan';
import { entityWorldBounds } from '../geometry/cells';

interface DimensionAnnotationProps {
  entity: Entity;
  /** Canonical cell size in world units (metres). */
  a: number;
  /** Current viewport zoom (px per world unit) — used to keep strokes pixel-perfect. */
  zoom: number;
}

const COLOUR = '#4a6fa5';   // accent blue — matches the editor theme
const GAP   = 10;           // gap from entity edge to dim line, in screen px
const TICK  = 5;            // half-length of end ticks, in screen px
const FONT  = 10;           // label font size, in screen px

const DimensionAnnotation: React.FC<DimensionAnnotationProps> = ({ entity, a, zoom }) => {
  if (entity.kind === 'text') return null;

  const b    = entityWorldBounds(entity, a);
  const gap  = GAP  / zoom;   // convert screen px → world units
  const tick = TICK / zoom;
  const fs   = FONT / zoom;

  const wMetres = entity.size.w * a;
  const hMetres = entity.size.h * a;
  const wLabel  = `${wMetres.toFixed(2)} m`;
  const hLabel  = `${hMetres.toFixed(2)} m`;

  // ── Horizontal dimension line (width) ─────────────────────────
  // Sits below the entity. In world coords (Y up), "below" = smaller Y.
  const hY   = b.y - gap;           // y position of the dim line
  const hX1  = b.x;                 // left tick x
  const hX2  = b.x + b.width;       // right tick x
  const hMid = b.x + b.width / 2;   // text centre x

  // ── Vertical dimension line (height) ──────────────────────────
  // Sits to the right. "Right" = larger X.
  const vX   = b.x + b.width + gap;
  const vY1  = b.y;                 // bottom tick y  (world Y=bottom)
  const vY2  = b.y + b.height;      // top tick y
  const vMid = b.y + b.height / 2;  // text centre y

  const sw = 1 / zoom;  // 1 px stroke in world units

  return (
    <g className="dim-annotation" pointerEvents="none">

      {/* ── WIDTH dimension line ── */}
      {/* Main line */}
      <line
        x1={hX1} y1={hY} x2={hX2} y2={hY}
        stroke={COLOUR} strokeWidth={sw} vectorEffect="non-scaling-stroke"
        strokeDasharray="none"
      />
      {/* Left tick */}
      <line
        x1={hX1} y1={hY - tick} x2={hX1} y2={hY + tick}
        stroke={COLOUR} strokeWidth={sw} vectorEffect="non-scaling-stroke"
      />
      {/* Right tick */}
      <line
        x1={hX2} y1={hY - tick} x2={hX2} y2={hY + tick}
        stroke={COLOUR} strokeWidth={sw} vectorEffect="non-scaling-stroke"
      />
      {/* Extension lines from entity edges down to dim line */}
      <line
        x1={hX1} y1={b.y} x2={hX1} y2={hY - tick}
        stroke={COLOUR} strokeWidth={sw * 0.6} vectorEffect="non-scaling-stroke"
        strokeDasharray={`${2 / zoom} ${2 / zoom}`}
        opacity={0.5}
      />
      <line
        x1={hX2} y1={b.y} x2={hX2} y2={hY - tick}
        stroke={COLOUR} strokeWidth={sw * 0.6} vectorEffect="non-scaling-stroke"
        strokeDasharray={`${2 / zoom} ${2 / zoom}`}
        opacity={0.5}
      />
      {/* Width label — centred on the dim line */}
      <g transform={`translate(${hMid}, ${hY}) scale(1, -1)`}>
        <text
          textAnchor="middle"
          dominantBaseline="auto"
          fontSize={fs}
          dy={`${fs * 1.1}px`}
          fill={COLOUR}
          fontFamily="'JetBrains Mono', ui-monospace, monospace"
          fontWeight="600"
          stroke="var(--bg-panel, #f0f1f3)"
          strokeWidth={fs * 0.35}
          strokeLinejoin="round"
          paintOrder="stroke fill"
        >
          {wLabel}
        </text>
      </g>

      {/* ── HEIGHT dimension line ── */}
      {/* Main line */}
      <line
        x1={vX} y1={vY1} x2={vX} y2={vY2}
        stroke={COLOUR} strokeWidth={sw} vectorEffect="non-scaling-stroke"
      />
      {/* Bottom tick */}
      <line
        x1={vX - tick} y1={vY1} x2={vX + tick} y2={vY1}
        stroke={COLOUR} strokeWidth={sw} vectorEffect="non-scaling-stroke"
      />
      {/* Top tick */}
      <line
        x1={vX - tick} y1={vY2} x2={vX + tick} y2={vY2}
        stroke={COLOUR} strokeWidth={sw} vectorEffect="non-scaling-stroke"
      />
      {/* Extension lines from entity edge to dim line */}
      <line
        x1={b.x + b.width} y1={vY1} x2={vX + tick} y2={vY1}
        stroke={COLOUR} strokeWidth={sw * 0.6} vectorEffect="non-scaling-stroke"
        strokeDasharray={`${2 / zoom} ${2 / zoom}`}
        opacity={0.5}
      />
      <line
        x1={b.x + b.width} y1={vY2} x2={vX + tick} y2={vY2}
        stroke={COLOUR} strokeWidth={sw * 0.6} vectorEffect="non-scaling-stroke"
        strokeDasharray={`${2 / zoom} ${2 / zoom}`}
        opacity={0.5}
      />
      {/* Height label — centred on dim line, rotated 90° */}
      <g transform={`translate(${vX}, ${vMid}) scale(1, -1) rotate(-90)`}>
        <text
          textAnchor="middle"
          dominantBaseline="auto"
          fontSize={fs}
          dy={`${fs * 1.1}px`}
          fill={COLOUR}
          fontFamily="'JetBrains Mono', ui-monospace, monospace"
          fontWeight="600"
          stroke="var(--bg-panel, #f0f1f3)"
          strokeWidth={fs * 0.35}
          strokeLinejoin="round"
          paintOrder="stroke fill"
        >
          {hLabel}
        </text>
      </g>
    </g>
  );
};

export default DimensionAnnotation;
