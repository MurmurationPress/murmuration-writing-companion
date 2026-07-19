export const NAVIGATOR_ACTIVATION_GUARD_MS = 400;

/**
 * Prevent a rapid second click from acting on a navigator tree that has already
 * rerendered after the first scene activation.
 */
export class NavigatorActivationGuard {
  private blockedUntil = 0;

  begin(now = Date.now()): void {
    this.blockedUntil = now + NAVIGATOR_ACTIVATION_GUARD_MS;
  }

  blocks(now = Date.now()): boolean {
    return now < this.blockedUntil;
  }

  clear(): void {
    this.blockedUntil = 0;
  }
}
