import React, { useMemo } from 'react';
import type { Entity } from '../types/floorplan';
import { absoluteCells, entityWorldBounds } from '../geometry/cells';
import { cellsToRings } from '../geometry/rings';

interface EntitiesLayerProps {
  entities: Entity[];
  selectedIds: Set<string>;
  /** Canonical cell size in world units. */
  a: number;
  colorFor: (entity: Entity) => string;
  onEntityPointerDown?: (id: string, e: React.MouseEvent) => void;
}

const SELECTION_STROKE = '#22c55e';

function labelSize(entity: Entity, a: number, factor: number): number {
  const scale = entity.fontSize ?? 1;
  const shortest = Math.min(entity.size.w, entity.size.h) * a;
  return Math.max(0.08, shortest * factor * scale);
}

const EntityShape: React.FC<{
  entity: Entity;
  selected: boolean;
  a: number;
  color: string;
  onPointerDown?: (id: string, e: React.MouseEvent) => void;
}> = ({ entity, selected, a, color, onPointerDown }) => {
  const bounds = entityWorldBounds(entity, a);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const label = entity.label ?? entity.kind.replace('_', ' ');

  // Only irregular footprints need boundary tracing; rectangles are one <rect>.
  const rings = useMemo(
    () => (entity.cells ? cellsToRings(absoluteCells(entity)) : []),
    [entity],
  );

  if (entity.kind === 'text') {
    const fontSize = entity.fontSize ?? 0.5;
    return (
      <g
        id={`entity-${entity.id}`}
        onMouseDown={(ev) => onPointerDown?.(entity.id, ev)}
        style={{ cursor: 'move' }}
      >
        <rect
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          fill="transparent"
          stroke={selected ? SELECTION_STROKE : 'none'}
          strokeWidth={1}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
        <g transform={`translate(${centerX}, ${centerY}) scale(1, -1)`}>
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

  return (
    <g
      id={`entity-${entity.id}`}
      onMouseDown={(ev) => onPointerDown?.(entity.id, ev)}
      style={{ cursor: 'move' }}
    >
      {entity.cells ? (
        <>
          {absoluteCells(entity).map((c) => (
            <rect
              key={`${c.x},${c.y}`}
              x={c.x * a}
              y={c.y * a}
              width={a}
              height={a}
              fill={color}
              fillOpacity={selected ? 0.4 : 0.25}
              stroke="none"
              shapeRendering="crispEdges"
            />
          ))}
          {rings.map((ring, i) => (
            <polygon
              key={i}
              points={ring.vertices.map((v) => `${v.x * a},${v.y * a}`).join(' ')}
              fill="none"
              stroke={selected ? SELECTION_STROKE : color}
              strokeWidth={selected ? 2 : 1.5}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </>
      ) : (
        <rect
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          fill={color}
          fillOpacity={selected ? 0.35 : 0.2}
          stroke={selected ? SELECTION_STROKE : color}
          strokeWidth={selected ? 2 : 1.5}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <g transform={`translate(${centerX}, ${centerY}) scale(1, -1)`} pointerEvents="none">
        <text
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={labelSize(entity, a, 0.24)}
          fill="currentColor"
          className="entity-label"
        >
          {label}
        </text>
      </g>
    </g>
  );
};

const EntitiesLayer: React.FC<EntitiesLayerProps> = ({
  entities,
  selectedIds,
  a,
  colorFor,
  onEntityPointerDown,
}) => (
  <g id="entities">
    {entities.map((entity) => (
      <EntityShape
        key={entity.id}
        entity={entity}
        selected={selectedIds.has(entity.id)}
        a={a}
        color={colorFor(entity)}
        onPointerDown={onEntityPointerDown}
      />
    ))}
  </g>
);

export default EntitiesLayer;
