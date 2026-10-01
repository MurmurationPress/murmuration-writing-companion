/** A transient editor draft, never a second metadata store. Each instance belongs
 * to one field on one captured file. Serial commits prevent a slower old write
 * from overwriting a newer edit; failures retain the draft for explicit retry.
 */
export class ChapterContextEdit {
  draft: string | null = null;
  private tail: Promise<void> = Promise.resolve();
  private pending: { value: string; promise: Promise<void> } | null = null;
  private revision = 0;

  change(value: string): void { this.draft = value; this.revision++; }

  commit(value: string, write: (value: string) => Promise<void>): Promise<void> {
    if (this.pending?.value === value) {
      const revision = this.revision;
      return this.pending.promise.then(() => { if (this.revision === revision) this.draft = null; });
    }
    this.change(value);
    const revision = this.revision;
    const promise = this.tail.catch(() => undefined).then(() => write(value)).then(() => {
      if (this.revision === revision) this.draft = null;
    });
    this.pending = { value, promise };
    this.tail = promise;
    void promise.finally(() => {
      if (this.pending?.promise === promise) this.pending = null;
    }).catch(() => undefined);
    return promise;
  }
}
