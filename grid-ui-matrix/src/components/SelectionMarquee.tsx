import React from 'react';
import type { Point, Rect } from '../types/geometry';
import type { Viewport } from '../types/viewport';
import { worldToScreen } from '../geometry/coordinates';

interface SelectionMarqueeProps {
  /** World-space marquee rect while dragging, or null. */
  rect: Rect | null;
  viewport: Viewport;
}

/** Screen-space overlay for Ctrl+drag multi-select. */
const SelectionMarquee: React.FC<SelectionMarqueeProps> = ({ rect, viewport }) => {
  if (!rect || (rect.width === 0 && rect.height === 0)) return null;

  const a: Point = { x: rect.x, y: rect.y };
  const b: Point = { x: rect.x + rect.width, y: rect.y + rect.height };
  const sa = worldToScreen(a, viewport);
  const sb = worldToScreen(b, viewport);
  const x = Math.min(sa.x, sb.x);
  const y = Math.min(sa.y, sb.y);
  const w = Math.abs(sb.x - sa.x);
  const h = Math.abs(sb.y - sa.y);

  return (
    <rect
      id="selection-marquee"
      x={x}
      y={y}
      width={w}
      height={h}
      className="selection-marquee"
      pointerEvents="none"
    />
  );
};

export default SelectionMarquee;
