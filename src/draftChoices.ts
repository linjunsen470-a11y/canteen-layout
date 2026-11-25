import type { BasicLayoutCandidate } from './basicLayout';
import type { Project } from './model';

// Keep alternatives for the active drafting session. Imported and reloaded projects
// can generate new copies, even when we no longer know which edits were manual.
export const draftSnapshot = (project: Project) => JSON.stringify({ ...project, updatedAt: undefined, style: undefined });
let last: { id: string; choices: BasicLayoutCandidate[]; snapshots: Map<number, string> } | undefined;

export function rememberDraftChoices(project: Project, choices: BasicLayoutCandidate[], selected: number) {
  if (last?.id !== project.id || last.choices !== choices) {
    last = { id: project.id, choices, snapshots: new Map() };
  }
  last.snapshots.set(selected, draftSnapshot(project));
}

export function currentDraftChoices(snapshot: string) {
  if (!last) return;
  for (const [selected, known] of last.snapshots) {
    if (known === snapshot) return { choices: last.choices, selected };
  }
}
