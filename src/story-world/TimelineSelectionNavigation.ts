export interface TimelineSelectionNavigationHost {
  openSelectedNote(): Promise<void>;
  setSelectedNoteActive(): void;
  activateCompanion(): Promise<void>;
  focusSelectedEditor(): void;
}

export function timelineSelectionLeaf<Leaf>(existing: Leaf | null, create: () => Leaf): Leaf {
  return existing ?? create();
}

export class TimelineSelectionQueue {
  private pending: Promise<void> = Promise.resolve();

  run(operation: () => Promise<void>): Promise<void> {
    const next = this.pending.then(operation);
    this.pending = next.catch(() => undefined);
    return next;
  }
}

/** Keeps Companion context and centre-editor focus aligned to one explicit graph selection. */
export async function navigateTimelineSelection(host: TimelineSelectionNavigationHost): Promise<void> {
  await host.openSelectedNote();
  host.setSelectedNoteActive();
  await host.activateCompanion();
  host.setSelectedNoteActive();
  host.focusSelectedEditor();
}
