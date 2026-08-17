export const MANUSCRIPT_ACTION_VIEW = Symbol("murmuration-manuscript-action-view");

export interface InitializedManuscriptActionView {
  readonly [MANUSCRIPT_ACTION_VIEW]: true;
  readonly containerEl: HTMLElement;
  addAction(icon: string, title: string, callback: () => void): HTMLElement;
  setPreparationActionsRenderer(renderer: () => void): void;
}

interface ManuscriptActionWorkspace {
  getLeavesOfType(type: string): Array<{ view: unknown }>;
}

export const MANUSCRIPT_ACTION_VIEW_TYPE = "murmuration-manuscript-navigator-view";

/**
 * Visits only fully initialized Manuscript views.
 *
 * Obsidian may expose a restored deferred view with the final view type before
 * the registered ItemView has replaced it. The subsequent supported
 * `layout-change` event runs this scan again after that replacement.
 */
export function forEachInitializedManuscriptView(
  workspace: ManuscriptActionWorkspace,
  visit: (view: InitializedManuscriptActionView) => void
): void {
  for (const leaf of workspace.getLeavesOfType(MANUSCRIPT_ACTION_VIEW_TYPE)) {
    const view = leaf.view as Partial<InitializedManuscriptActionView> | null;
    if (view?.[MANUSCRIPT_ACTION_VIEW] === true) {
      visit(view as InitializedManuscriptActionView);
    }
  }
}
