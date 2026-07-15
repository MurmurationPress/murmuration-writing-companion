export const ANNOTATION_LOCATOR_CLASS = "mwc-annotation-locator-active";

export interface AnnotationLocatorElement {
  classList: {
    add(value: string): void;
    remove(value: string): void;
  };
}

export type AnnotationLocatorSchedule = (
  callback: () => void,
  delayMs: number
) => unknown;

export type AnnotationLocatorCancel = (handle: unknown) => void;

export class TransientAnnotationLocator {
  private target: AnnotationLocatorElement | null = null;
  private timer: unknown = null;

  constructor(
    private readonly schedule: AnnotationLocatorSchedule = (callback, delayMs) => (
      window.setTimeout(callback, delayMs)
    ),
    private readonly cancel: AnnotationLocatorCancel = (handle) => {
      window.clearTimeout(handle as number);
    },
    private readonly durationMs = 2600
  ) {}

  show(target: AnnotationLocatorElement): void {
    this.clear();
    this.target = target;
    target.classList.add(ANNOTATION_LOCATOR_CLASS);
    this.timer = this.schedule(() => this.clear(), this.durationMs);
  }

  clear(): void {
    if (this.timer !== null) {
      this.cancel(this.timer);
      this.timer = null;
    }

    if (this.target) {
      this.target.classList.remove(ANNOTATION_LOCATOR_CLASS);
      this.target = null;
    }
  }

  dispose(): void {
    this.clear();
  }
}
