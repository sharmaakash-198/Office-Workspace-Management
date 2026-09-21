import type {
  CustomLibraryEntry,
  Entity,
  FloorConfig,
  FloorZone,
  GridCell,
  SubdivisionMode,
} from '../types/geometry';
import type { Viewport } from '../types/viewport';

export type FloorDocument = {
  version: 2;
  name?: string;
  savedAt?: string;
  a: number;
  subdivision: SubdivisionMode;
  floor: FloorConfig;
  entities: Entity[];
  zones: FloorZone[];
  customLibrary: CustomLibraryEntry[];
  /** Finest absolute cells marked unusable (irregular floor). */
  unusableCells?: GridCell[];
  viewport?: Viewport;
  theme?: 'dark' | 'light';
};

const STORAGE_KEY = 'floor-planner-drafts-v2';

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
  drafts.unshift({ ...draft, name, savedAt: new Date().toISOString() });
  writeAll(drafts.slice(0, 40));
}

export function loadDraft(name: string): FloorDocument | null {
  return listDrafts().find((d) => d.name === name) ?? null;
}

export function deleteDraft(name: string): void {
  writeAll(listDrafts().filter((d) => d.name !== name));
}

export function downloadFloorJson(doc: FloorDocument, filename?: string): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `floor-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function floorDocumentToJson(doc: FloorDocument): string {
  return JSON.stringify(doc, null, 2);
}
