export interface TimelineLeaf { setViewState(state: { type: string; active: boolean }): Promise<void>; }
export interface TimelineWorkspace<Leaf extends TimelineLeaf> {
  getLeavesOfType(type: string): readonly Leaf[]; getLeaf(newLeaf: "tab"): Leaf; revealLeaf(leaf: Leaf): Promise<void> | void;
}
export class StoryWorldTimelineActivation {
  private pending: Promise<void> | null = null;
  activate<Leaf extends TimelineLeaf>(workspace: TimelineWorkspace<Leaf>, viewType: string): Promise<void> {
    if (this.pending) return this.pending;
    const operation = this.activateOnce(workspace, viewType); this.pending = operation;
    const clear = () => { if (this.pending === operation) this.pending = null; };
    void operation.then(clear, clear); return operation;
  }
  private async activateOnce<Leaf extends TimelineLeaf>(workspace: TimelineWorkspace<Leaf>, viewType: string): Promise<void> {
    const existing = workspace.getLeavesOfType(viewType)[0];
    if (existing) { await workspace.revealLeaf(existing); return; }
    const leaf = workspace.getLeaf("tab"); await leaf.setViewState({ type: viewType, active: true }); await workspace.revealLeaf(leaf);
  }
}
