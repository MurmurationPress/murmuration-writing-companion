export interface ReconciliationScheduler {
  schedule(callback: () => void, delay: number): number;
  cancel(handle: number): void;
}

/** Combine a resolution burst into one authoritative pass, with bounded wait. */
export class ReconciliationQueue {
  private quiet: number | null = null;
  private deadline: number | null = null;
  private disposed = false;

  constructor(private readonly reconcile: () => void, private readonly scheduler: ReconciliationScheduler = {
    schedule: (callback, delay) => window.setTimeout(callback, delay),
    cancel: handle => window.clearTimeout(handle)
  }) {}

  request(): void {
    if (this.disposed) return;
    if (this.quiet !== null) this.scheduler.cancel(this.quiet);
    this.quiet = this.scheduler.schedule(() => this.flush(), 100);
    if (this.deadline === null) this.deadline = this.scheduler.schedule(() => this.flush(), 1000);
  }

  dispose(): void { this.disposed = true; this.clear(); }

  private clear(): void {
    if (this.quiet !== null) this.scheduler.cancel(this.quiet);
    if (this.deadline !== null) this.scheduler.cancel(this.deadline);
    this.quiet = this.deadline = null;
  }

  private flush(): void {
    this.clear();
    if (!this.disposed) this.reconcile();
  }
}
