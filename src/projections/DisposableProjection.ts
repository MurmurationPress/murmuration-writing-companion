/** Small reusable cache primitive; values remain disposable projections, never authority. */
export class DisposableProjection<T> {
  private current: T | null = null;
  private readonly dependencies = new Map<string, string>();

  constructor(private readonly build: () => T) {}

  get(): T { return this.current ?? (this.current = this.build()); }
  hasValue(): boolean { return this.current !== null; }
  rebuild(): T { return this.current = this.build(); }
  publish(value: T): void { this.current = value; }
  invalidate(): void { this.current = null; }

  updateDependency(path: string, fingerprint: string | null, authoritativeChanged = false): boolean {
    const previous = this.dependencies.get(path) ?? null;
    if (!authoritativeChanged && previous === fingerprint) return false;
    this.current = null;
    if (fingerprint === null) this.dependencies.delete(path); else this.dependencies.set(path, fingerprint);
    return true;
  }

  replaceDependencies(entries: Iterable<readonly [string, string]>): void {
    this.dependencies.clear();
    for (const [path, fingerprint] of entries) this.dependencies.set(path, fingerprint);
  }

  hasDependency(path: string): boolean { return this.dependencies.has(path); }
}
