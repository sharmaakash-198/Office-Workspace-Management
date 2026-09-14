import React from 'react';
import type { Entity } from '../types/geometry';
import { footprintToOutline } from '../geometry/footprint';

interface EntitiesLayerProps {
  entities: Entity[];
  selectedIds: Set<string>;
  colorFor: (entity: Entity) => string;
  onEntityPointerDown?: (id: string, e: React.MouseEvent) => void;
}

function shapeLabelSize(entity: Entity, factor: number): number {
  const scale = entity.fontSize ?? 1;
  return Math.max(0.08, Math.min(entity.width, entity.height) * factor * scale);
}

const EntitiesLayer: React.FC<EntitiesLayerProps> = ({
  entities,
  selectedIds,
  colorFor,
  onEntityPointerDown,
}) => {
  return (
    <g id="entities">
      {entities.map((e) => {
        const color = colorFor(e);
        const selected = selectedIds.has(e.id);
        const label = e.label ?? e.kind.replace('_', ' ');

        if (e.kind === 'text') {
          const fontSize = e.fontSize ?? 0.5;
          const cx = e.x + e.width / 2;
          const cy = e.y + e.height / 2;
          return (
            <g
              key={e.id}
              id={`entity-${e.id}`}
              onMouseDown={(ev) => onEntityPointerDown?.(e.id, ev)}
              style={{ cursor: 'move' }}
            >
              {selected && (
                <rect
                  x={e.x}
                  y={e.y}
                  width={e.width}
                  height={e.height}
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

        if (e.kind === 'polygon' && e.footprint && e.footprint.length > 0) {
          const outline = footprintToOutline(e.x, e.y, e.footprint);
          const pts = outline.map((p) => `${p.x},${p.y}`).join(' ');
          const cx = e.x + e.width / 2;
          const cy = e.y + e.height / 2;
          const fontSize = shapeLabelSize(e, 0.2);
          return (
            <g
              key={e.id}
              id={`entity-${e.id}`}
              onMouseDown={(ev) => onEntityPointerDown?.(e.id, ev)}
              style={{ cursor: 'move' }}
            >
              {e.footprint.map((f, i) => (
                <rect
                  key={i}
                  x={e.x + f.x}
                  y={e.y + f.y}
                  width={f.width}
                  height={f.height}
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

        if (e.kind === 'polygon' && e.points && e.points.length >= 2) {
          const pts = e.points.map((p) => `${p.x},${p.y}`).join(' ');
          const cx =
            e.points.reduce((s, p) => s + p.x, 0) / Math.max(1, e.points.length);
          const cy =
            e.points.reduce((s, p) => s + p.y, 0) / Math.max(1, e.points.length);
          const fontSize = Math.max(0.08, 0.35 * (e.fontSize ?? 1));
          return (
            <g
              key={e.id}
              id={`entity-${e.id}`}
              onMouseDown={(ev) => onEntityPointerDown?.(e.id, ev)}
              style={{ cursor: 'move' }}
            >
              <polygon
                points={pts}
                fill={color}
                fillOpacity={selected ? 0.35 : 0.18}
                stroke={selected ? '#22c55e' : color}
                strokeWidth={selected ? 2 : 1.5}
                vectorEffect="non-scaling-stroke"
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
        }

        const cx = e.x + e.width / 2;
        const cy = e.y + e.height / 2;
        const fontSize = shapeLabelSize(e, 0.28);

        return (
          <g
            key={e.id}
            id={`entity-${e.id}`}
            onMouseDown={(ev) => onEntityPointerDown?.(e.id, ev)}
            style={{ cursor: 'move' }}
          >
            <rect
              x={e.x}
              y={e.y}
              width={e.width}
              height={e.height}
              fill={color}
              fillOpacity={selected ? 0.35 : 0.2}
              stroke={selected ? '#22c55e' : color}
              strokeWidth={selected ? 2 : 1.5}
              vectorEffect="non-scaling-stroke"
              rx={0.05}
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
