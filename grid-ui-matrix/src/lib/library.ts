import type { CustomLibraryEntry, Entity, LibraryItem } from '../types/geometry';

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

export function nextCustomColor(index: number): string {
  return CUSTOM_PALETTE[index % CUSTOM_PALETTE.length];
}

export function colorForEntity(
  entity: Entity,
  library: LibraryItem[],
): string {
  if (entity.color) return entity.color;
  const hit = library.find(
    (i) => i.category === entity.category && i.elementType === entity.elementType,
  );
  return hit?.color ?? '#94a3b8';
}

export function deleteCustomLibraryEntry(
  entries: CustomLibraryEntry[],
  id: string,
): CustomLibraryEntry[] {
  return entries.filter((e) => e.id !== id);
}

export function upsertCustomCategory(
  entries: CustomLibraryEntry[],
  entry: CustomLibraryEntry,
): CustomLibraryEntry[] {
  return [...entries.filter((e) => e.id !== entry.id), entry];
}

export function groupCustomByCategory(
  entries: CustomLibraryEntry[],
): Map<string, CustomLibraryEntry[]> {
  const map = new Map<string, CustomLibraryEntry[]>();
  for (const e of entries) {
    const list = map.get(e.category) ?? [];
    list.push(e);
    map.set(e.category, list);
  }
  return map;
}
