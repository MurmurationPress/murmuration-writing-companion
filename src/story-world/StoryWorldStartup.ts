/** Performs one normal startup pass and only retries at layout-ready when metadata was incomplete. */
export class StoryWorldStartup<T> {
  private built = false;
  private needsSettledPass = false;
  constructor(private readonly rebuild: () => T, private readonly metadataReady: () => boolean = () => true) {}
  initialise(): T | null {
    if (this.built) return null;
    this.built = true;
    this.needsSettledPass = !this.metadataReady();
    return this.rebuild();
  }

  settle(): T | null {
    if (!this.needsSettledPass) return null;
    this.needsSettledPass = false;
    return this.rebuild();
  }
}
