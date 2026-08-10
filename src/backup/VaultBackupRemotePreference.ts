export interface VaultBackupPreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createVaultBackupRemotePreferenceKey(pluginId: string, vaultName: string): string {
  return `${pluginId}:${vaultName.trim() || "vault"}:vault-backup-remote`;
}

export class VaultBackupRemotePreference {
  private value: string | null;

  constructor(
    private readonly storage: VaultBackupPreferenceStorage | null,
    private readonly key: string
  ) {
    this.value = this.read();
  }

  get(): string | null {
    return this.value;
  }

  set(remote: string | null): void {
    this.value = remote?.trim() || null;
    try {
      if (this.value) this.storage?.setItem(this.key, this.value);
      else this.storage?.removeItem(this.key);
    } catch {
      // The explicit selection still applies for this Obsidian session.
    }
  }

  private read(): string | null {
    try {
      const value = this.storage?.getItem(this.key)?.trim();
      return value || null;
    } catch {
      return null;
    }
  }
}

export function vaultBackupRemoteOptions(remotes: readonly string[]): string[] {
  return remotes.length > 1 && !remotes.includes("origin") ? [...remotes] : [];
}
