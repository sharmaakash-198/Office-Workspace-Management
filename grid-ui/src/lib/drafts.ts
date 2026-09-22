import type {
  CustomLibraryEntry,
  Entity,
  FloorConfig,
  FloorZone,
  GridCell,
  UnusableRegion,
} from '../types/geometry';
import type { Viewport } from '../types/viewport';

export type FloorDocument = {
  version: 2;
  name?: string;
  savedAt?: string;
  a: number;
  floor: FloorConfig;
  entities: Entity[];
  zones: FloorZone[];
  customLibrary: CustomLibraryEntry[];
  unusableRegions?: UnusableRegion[];
  /** @deprecated migrated to unusableRegions on load */
  unusableCells?: GridCell[];
  /** @deprecated ignored */
  subdivision?: 2 | 4;
  viewport?: Viewport;
  theme?: 'dark' | 'light';
};

const STORAGE_KEY = 'floor-planner-drafts-v2';

export function normalizeUnusableRegions(doc: FloorDocument): UnusableRegion[] {
  if (doc.unusableRegions && doc.unusableRegions.length > 0) {
    return doc.unusableRegions;
  }
  if (doc.unusableCells && doc.unusableCells.length > 0) {
    return [
      {
        id: `unusable-${Math.random().toString(36).slice(2, 10)}`,
        label: '',
        cells: doc.unusableCells,
      },
    ];
  }
  return [];
}

/** Strip deprecated fields when saving. */
export function sanitizeDocument(doc: FloorDocument): FloorDocument {
  const {
    subdivision: _sub,
    unusableCells: _cells,
    ...rest
  } = doc;
  return {
    ...rest,
    unusableRegions: normalizeUnusableRegions(doc),
  };
}

export function listDrafts(): FloorDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FloorDocument[];
    return Array.isArray(parsed) ? parsed.filter((d) => d.version === 2) : [];
  } catch {
    return [];
  }
}

function writeAll(drafts: FloorDocument[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

export function saveDraft(draft: FloorDocument): void {
  const name = draft.name ?? 'Untitled';
  const drafts = listDrafts().filter((d) => d.name !== name);
  drafts.unshift({
    ...sanitizeDocument(draft),
    name,
    savedAt: new Date().toISOString(),
  });
  writeAll(drafts.slice(0, 40));
}

export function loadDraft(name: string): FloorDocument | null {
  return listDrafts().find((d) => d.name === name) ?? null;
}

export function deleteDraft(name: string): void {
  writeAll(listDrafts().filter((d) => d.name !== name));
}

export function downloadFloorJson(doc: FloorDocument, filename?: string): void {
  const clean = sanitizeDocument(doc);
  const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `floor-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function floorDocumentToJson(doc: FloorDocument): string {
  return JSON.stringify(sanitizeDocument(doc), null, 2);
}
