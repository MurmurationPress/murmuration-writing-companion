/** Vault-local presentation preference, following the existing localStorage settings. */
export class FilenameTitlePreference {
  private value = true;
  constructor(private readonly storage: Pick<Storage, "getItem" | "setItem"> | null, private readonly key: string) {
    try { this.value = storage?.getItem(key) !== "false"; } catch { /* Preserve the existing default. */ }
  }
  get(): boolean { return this.value; }
  set(value: boolean): void {
    this.value = value;
    try { this.storage?.setItem(this.key, String(value)); } catch { /* Session-only fallback. */ }
  }
}
export function filenameTitlePreferenceKey(pluginId: string, resourceRoot: string): string {
  // Resource URLs contain a per-launch host and cache-busting query. Neither
  // belongs to vault identity; the decoded vault path is stable across restarts.
  let identity = resourceRoot;
  try { identity = decodeURIComponent(new URL(resourceRoot).pathname); } catch { /* Plain path or vault-name fallback. */ }
  return `${pluginId}:notify-filename-title:v1:${encodeURIComponent(identity)}`;
}
