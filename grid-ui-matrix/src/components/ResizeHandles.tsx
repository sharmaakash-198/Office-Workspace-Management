import React from 'react';
import type { Entity } from '../types/geometry';
import { entityBounds } from '../geometry/entities';

export type ResizeHandle =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w';

interface ResizeHandlesProps {
  entity: Entity;
  zoom: number;
  onHandleDown: (handle: ResizeHandle, e: React.MouseEvent) => void;
}

const HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function handlePosition(
  handle: ResizeHandle,
  x: number,
  y: number,
  w: number,
  h: number,
): { cx: number; cy: number } {
  switch (handle) {
    case 'nw':
      return { cx: x, cy: y + h };
    case 'n':
      return { cx: x + w / 2, cy: y + h };
    case 'ne':
      return { cx: x + w, cy: y + h };
    case 'e':
      return { cx: x + w, cy: y + h / 2 };
    case 'se':
      return { cx: x + w, cy: y };
    case 's':
      return { cx: x + w / 2, cy: y };
    case 'sw':
      return { cx: x, cy: y };
    case 'w':
      return { cx: x, cy: y + h / 2 };
  }
}

const CURSOR: Record<ResizeHandle, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
};

const ResizeHandles: React.FC<ResizeHandlesProps> = ({ entity, zoom, onHandleDown }) => {
  const b = entityBounds(entity);
  const size = 8 / zoom;

  return (
    <g id="resize-handles">
      <rect
        x={b.x}
        y={b.y}
        width={b.width}
        height={b.height}
        fill="none"
        stroke="#22c55e"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      {HANDLES.map((h) => {
        const { cx, cy } = handlePosition(h, b.x, b.y, b.width, b.height);
        return (
          <rect
            key={h}
            x={cx - size / 2}
            y={cy - size / 2}
            width={size}
            height={size}
            className="resize-handle"
            style={{ cursor: CURSOR[h] }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onHandleDown(h, e);
            }}
          />
        );
      })}
    </g>
  );
};

export default ResizeHandles;
