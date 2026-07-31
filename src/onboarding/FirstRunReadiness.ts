export class FirstRunReadinessPreference {
  constructor(private readonly storage: Storage | null, private readonly key: string) {}
  hasBeenShown(): boolean {
    try { return this.storage?.getItem(this.key) === "1"; } catch { return false; }
  }
  markShown(): void {
    try { this.storage?.setItem(this.key, "1"); } catch { /* Local presentation state is best effort. */ }
  }
  shouldInvite(indexesReady: boolean): boolean { return indexesReady && !this.hasBeenShown(); }
  hasBeenOpened(): boolean {
    try { return this.storage?.getItem(`${this.key}:opened`) === "1"; } catch { return false; }
  }
  markOpened(): void {
    try { this.storage?.setItem(`${this.key}:opened`, "1"); } catch { /* Local presentation state is best effort. */ }
  }
  shouldHintOnFirstInteraction(): boolean {
    try {
      if (!this.storage) return false;
      return !this.hasBeenOpened() && this.storage?.getItem(`${this.key}:interaction-hint`) !== "1";
    } catch { return false; }
  }
  markInteractionHintShown(): void {
    try { this.storage?.setItem(`${this.key}:interaction-hint`, "1"); } catch { /* Local presentation state is best effort. */ }
  }
}

export function firstRunReadinessKey(pluginId: string, vaultName: string, version = 1): string {
  return `${pluginId}:${vaultName}:project-readiness-invitation-v${version}`;
}
