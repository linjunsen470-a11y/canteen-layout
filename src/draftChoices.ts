import type { BasicLayoutCandidate } from './basicLayout';
import type { Project } from './model';
import { useStore } from './store';

const MAX_CACHED_PROJECTS = 3;

type CacheEntry = {
  choices: BasicLayoutCandidate[];
  revisions: Map<number, number>; // layoutRevision -> selected index
  savedAt: Map<string, number>;   // project.updatedAt -> selected index (for unmodified switchback)
};

// LRU cache of up to 3 projects for the active drafting session, keyed by O(1) store layoutRevision
// instead of serializing the entire project JSON.
const cache = new Map<string, CacheEntry>();

export function draftRevisionKey(project: Pick<Project, 'id'>, layoutRevision = useStore.getState().layoutRevision): string {
  return `${project.id}:${layoutRevision}`;
}

export function rememberDraftChoices(
  project: Project,
  choices: BasicLayoutCandidate[],
  selected: number,
  layoutRevision = useStore.getState().layoutRevision,
) {
  let entry = cache.get(project.id);
  if (!entry || entry.choices !== choices) {
    entry = { choices, revisions: new Map(), savedAt: new Map() };
  }
  // Refresh LRU order
  cache.delete(project.id);
  cache.set(project.id, entry);
  entry.revisions.set(layoutRevision, selected);
  if (useStore.getState().past.length === 0) recordSavedDraft(project, layoutRevision);
  while (cache.size > MAX_CACHED_PROJECTS) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

// Bind the timestamp of the snapshot that actually reached IndexedDB.
export function recordSavedDraft(project: Project, layoutRevision: number) {
  const entry = cache.get(project.id);
  if (!entry) return;
  const selected = entry.revisions.get(layoutRevision);
  entry.savedAt.clear();
  if (selected !== undefined) entry.savedAt.set(project.updatedAt, selected);
}

export function currentDraftChoices(
  project: Pick<Project, 'id' | 'updatedAt'>,
  layoutRevision = useStore.getState().layoutRevision,
  allowSavedMatch = useStore.getState().past.length === 0,
): { choices: BasicLayoutCandidate[]; selected: number } | undefined {
  const entry = cache.get(project.id);
  if (!entry) return;
  const byRev = entry.revisions.get(layoutRevision);
  if (byRev !== undefined) {
    cache.delete(project.id);
    cache.set(project.id, entry);
    return { choices: entry.choices, selected: byRev };
  }
  if (allowSavedMatch && project.updatedAt) {
    const bySaved = entry.savedAt.get(project.updatedAt);
    if (bySaved !== undefined) {
      // Re-bind this freshly opened revision so subsequent style changes or undo stay O(1).
      entry.revisions.set(layoutRevision, bySaved);
      cache.delete(project.id);
      cache.set(project.id, entry);
      return { choices: entry.choices, selected: bySaved };
    }
  }
}

export function clearDraftChoices() {
  cache.clear();
}
