import type { Viewport } from '../types/viewport';
import type { FloorPlanJson } from './serialization';

/**
 * Local drafts hold the same serialized plan that goes over the wire, so a
 * draft exercises the real contract instead of a parallel storage shape.
 */
export type DraftDocument = {
  version: 2;
  name: string;
  savedAt: string;
  plan: FloorPlanJson;
  viewport: Viewport;
  theme?: 'dark' | 'light';
};

const STORAGE_KEY = 'floor-planner-drafts-v2';
const MAX_DRAFTS = 40;

export function listDrafts(): DraftDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DraftDocument[];
    return Array.isArray(parsed) ? parsed.filter((d) => d?.version === 2) : [];
  } catch {
    return [];
  }
}

function writeAll(drafts: DraftDocument[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // Quota exceeded or storage disabled; drafts are best-effort.
  }
}

export function saveDraft(draft: DraftDocument): void {
  const drafts = listDrafts().filter((d) => d.name !== draft.name);
  drafts.unshift(draft);
  writeAll(drafts.slice(0, MAX_DRAFTS));
}

export function loadDraft(name: string): DraftDocument | null {
  return listDrafts().find((d) => d.name === name) ?? null;
}

export function deleteDraft(name: string): void {
  writeAll(listDrafts().filter((d) => d.name !== name));
}
