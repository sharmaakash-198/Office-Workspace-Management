import type { Entity, FloorConfig } from '../types/geometry';
import type { Viewport } from '../types/viewport';

export type DraftDocument = {
  version: 1;
  name: string;
  savedAt: string;
  a: number;
  floor: FloorConfig;
  viewport: Viewport;
  entities: Entity[];
  theme?: 'dark' | 'light';
};

const STORAGE_KEY = 'floor-planner-drafts-v1';

export function listDrafts(): DraftDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DraftDocument[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(drafts: DraftDocument[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

export function saveDraft(draft: DraftDocument): void {
  const drafts = listDrafts().filter((d) => d.name !== draft.name);
  drafts.unshift(draft);
  writeAll(drafts.slice(0, 40));
}

export function loadDraft(name: string): DraftDocument | null {
  return listDrafts().find((d) => d.name === name) ?? null;
}

export function deleteDraft(name: string): void {
  writeAll(listDrafts().filter((d) => d.name !== name));
}
