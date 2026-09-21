import React from 'react';
import type { GridCell, Wall } from '../types/floorplan';

interface WallsLayerProps {
  walls: Wall[];
  selectedIds: Set<string>;
  /** Canonical cell size in world units. */
  a: number;
  /** Vertices of the wall being drawn right now, if any. */
  draft?: GridCell[] | null;
  draftThickness?: number;
  /** Live cursor vertex, shown as a rubber-band segment from the last point. */
  draftCursor?: GridCell | null;
  onWallPointerDown?: (id: string, e: React.MouseEvent) => void;
}

const SELECTION_STROKE = '#22c55e';
const DEFAULT_WALL_COLOR = '#475569';

function toPath(points: GridCell[], a: number): string {
  return points.map((p) => `${p.x * a},${p.y * a}`).join(' ');
}

const WallsLayer: React.FC<WallsLayerProps> = ({
  walls,
  selectedIds,
  a,
  draft,
  draftThickness = 1,
  draftCursor,
  onWallPointerDown,
}) => {
  const draftPoints = draft
    ? draftCursor
      ? [...draft, draftCursor]
      : draft
    : null;

  return (
    <g id="walls">
      {walls.map((wall) => {
        const selected = selectedIds.has(wall.id);
        const color = wall.color ?? DEFAULT_WALL_COLOR;
        return (
          <g
            key={wall.id}
            id={`wall-${wall.id}`}
            onMouseDown={(e) => onWallPointerDown?.(wall.id, e)}
            style={{ cursor: 'move' }}
          >
            {/* Invisible fat stroke so thin walls stay easy to click. */}
            <polyline
              points={toPath(wall.points, a)}
              fill="none"
              stroke="transparent"
              strokeWidth={Math.max(wall.thickness * a, a * 3)}
              strokeLinecap="butt"
              strokeLinejoin="miter"
            />
            <polyline
              points={toPath(wall.points, a)}
              fill="none"
              stroke={selected ? SELECTION_STROKE : color}
              strokeWidth={wall.thickness * a}
              strokeLinecap="butt"
              strokeLinejoin="miter"
              pointerEvents="none"
            />
            {selected &&
              wall.points.map((p, i) => (
                <rect
                  key={i}
                  x={p.x * a - a * 0.35}
                  y={p.y * a - a * 0.35}
                  width={a * 0.7}
                  height={a * 0.7}
                  fill="#ffffff"
                  stroke={SELECTION_STROKE}
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              ))}
          </g>
        );
      })}

      {draftPoints && draftPoints.length >= 2 && (
        <polyline
          points={toPath(draftPoints, a)}
          fill="none"
          stroke={SELECTION_STROKE}
          strokeWidth={draftThickness * a}
          strokeLinecap="butt"
          strokeLinejoin="miter"
          strokeOpacity={0.7}
          pointerEvents="none"
        />
      )}
      {draft?.map((p, i) => (
        <circle
          key={i}
          cx={p.x * a}
          cy={p.y * a}
          r={a * 0.3}
          fill={SELECTION_STROKE}
          pointerEvents="none"
        />
      ))}
    </g>
  );
};

export default WallsLayer;
