import type { EntityKind, LibraryItem } from '../types/geometry';

/** Built-in library stubs - colours are mutable in the editor. */
export const DEFAULT_ENTITY_LIBRARY: LibraryItem[] = [
  {
    id: 'workstation',
    kind: 'workstation',
    label: 'Workstation',
    code: 1,
    defaultWidth: 1.2,
    defaultHeight: 0.8,
    color: '#3b82f6',
  },
  {
    id: 'plant',
    kind: 'plant',
    label: 'Plant',
    code: 2,
    defaultWidth: 0.5,
    defaultHeight: 0.5,
    color: '#22c55e',
  },
  {
    id: 'meeting_room',
    kind: 'meeting_room',
    label: 'Meeting room',
    code: 3,
    defaultWidth: 4,
    defaultHeight: 3,
    color: '#a855f7',
  },
  {
    id: 'cafeteria',
    kind: 'cafeteria',
    label: 'Cafeteria',
    code: 4,
    defaultWidth: 6,
    defaultHeight: 4,
    color: '#f59e0b',
  },
  {
    id: 'custom',
    kind: 'custom',
    label: 'Custom block',
    code: 9,
    defaultWidth: 1,
    defaultHeight: 1,
    color: '#94a3b8',
  },
  {
    id: 'text',
    kind: 'text',
    label: 'Text block',
    code: 0,
    defaultWidth: 3,
    defaultHeight: 1,
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
