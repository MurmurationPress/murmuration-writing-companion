export interface ContinuityReviewLeaf {
  readonly view: unknown;
  setViewState(state: { type: string; active: boolean; state?: Record<string, unknown> }): Promise<void>;
}

export interface ContinuityReviewWorkspace<Leaf extends ContinuityReviewLeaf> {
  getLeavesOfType(type: string): readonly Leaf[];
  getLeaf(newLeaf: "tab"): Leaf;
  revealLeaf(leaf: Leaf): Promise<void> | void;
}

/** Reuses exactly one centre-pane Continuity Review tab. */
export class ContinuityReviewActivation {
  private pending: Promise<ContinuityReviewLeaf> | null = null;

  activate<Leaf extends ContinuityReviewLeaf>(
    workspace: ContinuityReviewWorkspace<Leaf>,
    viewType: string,
    bookPath: string
  ): Promise<Leaf> {
    if (this.pending) return this.pending as Promise<Leaf>;
    const operation = this.activateOnce(workspace, viewType, bookPath);
    this.pending = operation;
    const clear = () => { if (this.pending === operation) this.pending = null; };
    void operation.then(clear, clear);
    return operation;
  }

  private async activateOnce<Leaf extends ContinuityReviewLeaf>(
    workspace: ContinuityReviewWorkspace<Leaf>,
    viewType: string,
    bookPath: string
  ): Promise<Leaf> {
    const existing = workspace.getLeavesOfType(viewType)[0];
    if (existing) {
      await workspace.revealLeaf(existing);
      return existing;
    }
    const leaf = workspace.getLeaf("tab");
    await leaf.setViewState({ type: viewType, active: true, state: { bookPath } });
    await workspace.revealLeaf(leaf);
    return leaf;
  }
}

export interface LatestContinuityReviewResult<T> {
  readonly current: boolean;
  readonly value: T;
}

/** Metadata changes recollect only when they affect the current derived input. */
export function continuityReviewDependencyChanged(
  dependencies: ReadonlySet<string>,
  changedPath: string
): boolean {
  return dependencies.has(changedPath);
}

/** Guards async collection so only the latest requested book may publish. */
export class ContinuityReviewCollectionCoordinator {
  private generation = 0;

  async request<T>(load: () => Promise<T> | T): Promise<LatestContinuityReviewResult<T>> {
    const generation = ++this.generation;
    const value = await load();
    return { current: generation === this.generation, value };
  }

  supersede(): void { this.generation += 1; }
}
