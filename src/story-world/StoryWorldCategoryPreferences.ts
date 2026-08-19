export interface StoryWorldCategoryPreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORY_WORLD_CATEGORY_PREFERENCE_VERSION = 1;

interface PersistedStoryWorldCategoryState {
  readonly version: number;
  readonly collapsed: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createStoryWorldCategoryPreferenceKey(
  pluginId: string,
  vaultName: string,
  resourceRoot: string
): string {
  const normalizedVaultName = vaultName.trim() || "vault";
  const normalizedResourceRoot = resourceRoot.trim() || normalizedVaultName;
  const identity = `${normalizedVaultName}\n${normalizedResourceRoot}`;
  return `${pluginId}:story-world-categories:v${STORY_WORLD_CATEGORY_PREFERENCE_VERSION}:${encodeURIComponent(identity)}`;
}

export function parseStoryWorldCategoryState(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)
      || parsed.version !== STORY_WORLD_CATEGORY_PREFERENCE_VERSION
      || !Array.isArray(parsed.collapsed)) return new Set();
    return new Set(parsed.collapsed.filter((key): key is string => typeof key === "string" && key.trim().length > 0));
  } catch {
    return new Set();
  }
}

export function serializeStoryWorldCategoryState(collapsed: ReadonlySet<string>): string {
  const state: PersistedStoryWorldCategoryState = {
    version: STORY_WORLD_CATEGORY_PREFERENCE_VERSION,
    collapsed: [...collapsed].sort()
  };
  return JSON.stringify(state);
}

export class StoryWorldCategoryPreferences {
  private collapsed: Set<string>;

  constructor(
    private readonly storage: StoryWorldCategoryPreferenceStorage | null,
    private readonly storageKey: string
  ) {
    this.collapsed = parseStoryWorldCategoryState(this.readPreference());
  }

  isCollapsed(category: string): boolean {
    return this.collapsed.has(category);
  }

  setCollapsed(category: string, collapsed: boolean): boolean {
    if (this.collapsed.has(category) === collapsed) return false;
    const next = new Set(this.collapsed);
    if (collapsed) next.add(category);
    else next.delete(category);
    this.collapsed = next;
    this.writePreference();
    return true;
  }

  snapshot(): ReadonlySet<string> {
    return new Set(this.collapsed);
  }

  private readPreference(): string | null {
    if (!this.storage) return null;
    try { return this.storage.getItem(this.storageKey); } catch { return null; }
  }

  private writePreference(): void {
    if (!this.storage) return;
    try { this.storage.setItem(this.storageKey, serializeStoryWorldCategoryState(this.collapsed)); } catch {
      // In-memory category state remains usable when browser storage is unavailable.
    }
  }
}
