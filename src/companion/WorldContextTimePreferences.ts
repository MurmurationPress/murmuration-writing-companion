import {
  isWorldEventRelativeTimeMode,
  WorldEventRelativeTimeMode
} from "../story-world/WorldRelativeTime";

const WORLD_CONTEXT_TIME_PREFERENCE_VERSION = 1;

export interface WorldContextTimePreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface PersistedWorldContextTimePreference {
  readonly version: number;
  readonly relativeTimeMode: WorldEventRelativeTimeMode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createWorldContextTimePreferenceKey(
  pluginId: string,
  vaultName: string,
  resourceRoot: string
): string {
  const normalizedVaultName = vaultName.trim() || "vault";
  const normalizedResourceRoot = resourceRoot.trim() || normalizedVaultName;
  const identity = `${normalizedVaultName}\n${normalizedResourceRoot}`;

  return `${pluginId}:world-context-time:v${WORLD_CONTEXT_TIME_PREFERENCE_VERSION}:${encodeURIComponent(identity)}`;
}

export function parseWorldContextTimePreference(
  raw: string | null
): WorldEventRelativeTimeMode {
  if (!raw) return "automatic";

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return "automatic";
    if (parsed.version !== WORLD_CONTEXT_TIME_PREFERENCE_VERSION) return "automatic";
    return isWorldEventRelativeTimeMode(parsed.relativeTimeMode)
      ? parsed.relativeTimeMode
      : "automatic";
  } catch {
    return "automatic";
  }
}

export function serializeWorldContextTimePreference(
  relativeTimeMode: WorldEventRelativeTimeMode
): string {
  const persisted: PersistedWorldContextTimePreference = {
    version: WORLD_CONTEXT_TIME_PREFERENCE_VERSION,
    relativeTimeMode
  };
  return JSON.stringify(persisted);
}

export class WorldContextTimePreferences {
  private relativeTimeMode: WorldEventRelativeTimeMode;

  constructor(
    private readonly storage: WorldContextTimePreferenceStorage | null,
    private readonly storageKey: string
  ) {
    this.relativeTimeMode = parseWorldContextTimePreference(this.readPreference());
  }

  getMode(): WorldEventRelativeTimeMode {
    return this.relativeTimeMode;
  }

  setMode(mode: WorldEventRelativeTimeMode): boolean {
    if (this.relativeTimeMode === mode) return false;
    this.relativeTimeMode = mode;
    this.writePreference();
    return true;
  }

  private readPreference(): string | null {
    if (!this.storage) return null;
    try {
      return this.storage.getItem(this.storageKey);
    } catch {
      return null;
    }
  }

  private writePreference(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(
        this.storageKey,
        serializeWorldContextTimePreference(this.relativeTimeMode)
      );
    } catch {
      // The in-memory preference still applies for this Obsidian session.
    }
  }
}
