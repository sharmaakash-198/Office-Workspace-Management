import React from 'react';
import type { Entity } from '../types/geometry';
import { entityWorldRect, isPolygonEntity } from '../geometry/entities';
import { cellsToWorldOutline, relativeCellsWorldRects } from '../geometry/footprint';

interface EntitiesLayerProps {
  entities: Entity[];
  selectedIds: Set<string>;
  a: number;
  colorFor: (entity: Entity) => string;
  onEntityPointerDown?: (id: string, e: React.MouseEvent) => void;
}

function shapeLabelSize(entity: Entity, a: number, factor: number): number {
  const scale = entity.fontSize ?? 1;
  const w = entity.widthCells * a;
  const h = entity.heightCells * a;
  return Math.max(a * 0.08, Math.min(w, h) * factor * scale);
}

const EntitiesLayer: React.FC<EntitiesLayerProps> = ({
  entities,
  selectedIds,
  a,
  colorFor,
  onEntityPointerDown,
}) => {
  return (
    <g id="entities">
      {entities.map((e) => {
        const color = colorFor(e);
        const selected = selectedIds.has(e.objectId);
        const label = e.label ?? e.elementType.replace(/_/g, ' ');
        const bounds = entityWorldRect(e, a);

        if (e.category === 'text') {
          const fontSize = (e.fontSize ?? 0.5) * a;
          const cx = bounds.x + bounds.width / 2;
          const cy = bounds.y + bounds.height / 2;
          return (
            <g
              key={e.objectId}
              id={`entity-${e.objectId}`}
              onMouseDown={(ev) => onEntityPointerDown?.(e.objectId, ev)}
              style={{ cursor: 'move' }}
            >
              {selected && (
                <rect
                  x={bounds.x}
                  y={bounds.y}
                  width={bounds.width}
                  height={bounds.height}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              <g transform={`translate(${cx}, ${cy}) scale(1, -1)`}>
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={fontSize}
                  fill={color}
                  className="entity-label text-block-label"
                >
                  {label || 'Text'}
                </text>
              </g>
            </g>
          );
        }

        if (isPolygonEntity(e) && e.cells) {
          const rects = relativeCellsWorldRects(e.origin, e.cells, a);
          const outline = cellsToWorldOutline(e.origin, e.cells, a);
          const pts = outline.map((p) => `${p.x},${p.y}`).join(' ');
          const cx = bounds.x + bounds.width / 2;
          const cy = bounds.y + bounds.height / 2;
          const fontSize = shapeLabelSize(e, a, 0.2);
          return (
            <g
              key={e.objectId}
              id={`entity-${e.objectId}`}
              onMouseDown={(ev) => onEntityPointerDown?.(e.objectId, ev)}
              style={{ cursor: 'move' }}
            >
              {rects.map((r, i) => (
                <rect
                  key={i}
                  x={r.x}
                  y={r.y}
                  width={r.width}
                  height={r.height}
                  fill={color}
                  fillOpacity={selected ? 0.4 : 0.25}
                  stroke="none"
                />
              ))}
              {outline.length >= 3 && (
                <polygon
                  points={pts}
                  fill="none"
                  stroke={selected ? '#22c55e' : color}
                  strokeWidth={selected ? 2 : 1.5}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              <g transform={`translate(${cx}, ${cy}) scale(1, -1)`} pointerEvents="none">
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={fontSize}
                  fill="currentColor"
                  className="entity-label"
                >
                  {label}
                </text>
              </g>
            </g>
          );
        }

        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;
        const fontSize = shapeLabelSize(e, a, 0.28);

        return (
          <g
            key={e.objectId}
            id={`entity-${e.objectId}`}
            onMouseDown={(ev) => onEntityPointerDown?.(e.objectId, ev)}
            style={{ cursor: 'move' }}
          >
            <rect
              x={bounds.x}
              y={bounds.y}
              width={bounds.width}
              height={bounds.height}
              fill={color}
              fillOpacity={selected ? 0.35 : 0.2}
              stroke={selected ? '#22c55e' : color}
              strokeWidth={selected ? 2 : 1.5}
              vectorEffect="non-scaling-stroke"
              rx={a * 0.05}
            />
            <g transform={`translate(${cx}, ${cy}) scale(1, -1)`} pointerEvents="none">
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={fontSize}
                fill="currentColor"
                className="entity-label"
              >
                {label}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
};

export default EntitiesLayer;
