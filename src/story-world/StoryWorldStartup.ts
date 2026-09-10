/** Coordinates startup and authoritative passes after each metadata resolution batch. */
export class StoryWorldStartup<T> {
  private built = false;
  private layoutSettled = false;
  private metadataSettled = false;

  constructor(
    private readonly rebuild: () => T,
    private readonly onSettledRebuild: (result: T) => void = () => undefined
  ) {}

  initialise(): T | null {
    if (this.built) return null;
    this.built = true;
    return this.rebuild();
  }

  /** Layout-ready fallback for plugins enabled after the initial resolved event. */
  settle(): T | null {
    if (!this.built || this.layoutSettled || this.metadataSettled) return null;
    this.layoutSettled = true;
    return this.rebuildSettled();
  }

  /** Reconcile every settled batch, including imports and external sync after startup. */
  metadataResolved(): T | null {
    if (!this.built) return null;
    this.metadataSettled = true;
    return this.rebuildSettled();
  }

  private rebuildSettled(): T {
    const result = this.rebuild();
    this.onSettledRebuild(result);
    return result;
  }
}
