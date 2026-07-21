export interface WritingCompanionLeaf {
  setViewState(state: { type: string; active: boolean }): Promise<void>;
}

export interface WritingCompanionWorkspace<Leaf extends WritingCompanionLeaf> {
  getLeavesOfType(type: string): readonly Leaf[];
  getRightLeaf(split: boolean): Leaf | null;
  revealLeaf(leaf: Leaf): Promise<void> | void;
}

export class WritingCompanionActivation {
  private pending: Promise<boolean> | null = null;

  activate<Leaf extends WritingCompanionLeaf>(
    workspace: WritingCompanionWorkspace<Leaf>,
    viewType: string
  ): Promise<boolean> {
    if (this.pending) return this.pending;

    const activation = this.activateOnce(workspace, viewType);
    this.pending = activation;
    const clear = () => {
      if (this.pending === activation) this.pending = null;
    };
    void activation.then(clear, clear);
    return activation;
  }

  private async activateOnce<Leaf extends WritingCompanionLeaf>(
    workspace: WritingCompanionWorkspace<Leaf>,
    viewType: string
  ): Promise<boolean> {
    const existing = workspace.getLeavesOfType(viewType)[0];
    if (existing) {
      await workspace.revealLeaf(existing);
      return true;
    }

    const leaf = workspace.getRightLeaf(false);
    if (!leaf) return false;

    await leaf.setViewState({ type: viewType, active: true });
    await workspace.revealLeaf(leaf);
    return true;
  }
}
