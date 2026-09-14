import type { EntityKind, LibraryItem } from '../types/floorplan';

/**
 * Built-in palette. Sizes are in canonical cells, so at the default a = 0.25 m
 * a seat is 0.5 m square and a desk is 1.5 m x 0.75 m.
 */
export const DEFAULT_ENTITY_LIBRARY: LibraryItem[] = [
  {
    id: 'seat',
    kind: 'seat',
    label: 'Seat',
    code: 5,
    defaultSize: { w: 2, h: 2 },
    color: '#0ea5e9',
  },
  {
    id: 'desk',
    kind: 'desk',
    label: 'Desk',
    code: 6,
    defaultSize: { w: 6, h: 3 },
    color: '#2563eb',
  },
  {
    id: 'workstation',
    kind: 'workstation',
    label: 'Workstation',
    code: 1,
    defaultSize: { w: 5, h: 4 },
    color: '#3b82f6',
  },
  {
    id: 'plant',
    kind: 'plant',
    label: 'Plant',
    code: 2,
    defaultSize: { w: 2, h: 2 },
    color: '#22c55e',
  },
  {
    id: 'meeting_room',
    kind: 'meeting_room',
    label: 'Meeting room',
    code: 3,
    defaultSize: { w: 16, h: 12 },
    color: '#a855f7',
  },
  {
    id: 'room',
    kind: 'room',
    label: 'Room',
    code: 7,
    defaultSize: { w: 16, h: 12 },
    color: '#8b5cf6',
  },
  {
    id: 'cafeteria',
    kind: 'cafeteria',
    label: 'Cafeteria',
    code: 4,
    defaultSize: { w: 24, h: 16 },
    color: '#f59e0b',
  },
  {
    id: 'area',
    kind: 'area',
    label: 'Area',
    code: 8,
    defaultSize: { w: 8, h: 8 },
    color: '#14b8a6',
  },
  {
    id: 'custom',
    kind: 'custom',
    label: 'Custom block',
    code: 9,
    defaultSize: { w: 4, h: 4 },
    color: '#94a3b8',
  },
  {
    id: 'text',
    kind: 'text',
    label: 'Text block',
    code: 0,
    defaultSize: { w: 12, h: 4 },
    color: '#64748b',
    defaultFontSize: 0.6,
  },
];

const CUSTOM_PALETTE = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#84cc16',
  '#14b8a6',
  '#06b6d4',
  '#6366f1',
  '#d946ef',
  '#f43f5e',
  '#78716c',
];

let customCodeSeq = 10;

export function nextCustomCode(): number {
  return customCodeSeq++;
}

export function nextCustomColor(index: number): string {
  return CUSTOM_PALETTE[index % CUSTOM_PALETTE.length];
}

export function colorForEntity(
  kind: EntityKind,
  library: LibraryItem[],
  entityColor?: string,
): string {
  if (entityColor) return entityColor;
  const hit = library.find((i) => i.kind === kind || i.id === kind);
  return hit?.color ?? '#94a3b8';
}

export function findLibraryItem(
  library: LibraryItem[],
  kind: EntityKind,
): LibraryItem | undefined {
  return library.find((i) => i.kind === kind);
}
