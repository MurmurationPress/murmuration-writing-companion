import {
  EDITABLE_CHAPTER_CONTEXT_FIELDS,
  EditableChapterContextField,
  getEditableChapterContextValue
} from "./ChapterContext";

export const SIDEBAR_SECTION_KEYS = [
  "chapterContext",
  "editorialPasses",
  "chapterNotes"
] as const;

export type SidebarSectionKey = typeof SIDEBAR_SECTION_KEYS[number];
export type SidebarSectionState = Record<SidebarSectionKey, boolean>;

export const DEFAULT_SIDEBAR_SECTION_STATE: Readonly<SidebarSectionState> = {
  chapterContext: true,
  editorialPasses: false,
  chapterNotes: true
};

const SIDEBAR_SECTION_PREFERENCE_VERSION = 1;

export interface SidebarPreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface PersistedSidebarSectionState {
  version: number;
  expanded: Partial<Record<SidebarSectionKey, boolean>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createSidebarSectionPreferenceKey(
  pluginId: string,
  vaultName: string,
  resourceRoot: string
): string {
  const normalizedVaultName = vaultName.trim() || "vault";
  const normalizedResourceRoot = resourceRoot.trim() || normalizedVaultName;
  const identity = `${normalizedVaultName}\n${normalizedResourceRoot}`;

  return `${pluginId}:sidebar-sections:v${SIDEBAR_SECTION_PREFERENCE_VERSION}:${encodeURIComponent(identity)}`;
}

export function parseSidebarSectionState(raw: string | null): SidebarSectionState {
  const state: SidebarSectionState = {
    ...DEFAULT_SIDEBAR_SECTION_STATE
  };

  if (!raw) return state;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return state;
    if (parsed.version !== SIDEBAR_SECTION_PREFERENCE_VERSION) return state;
    if (!isRecord(parsed.expanded)) return state;

    for (const key of SIDEBAR_SECTION_KEYS) {
      const value = parsed.expanded[key];
      if (typeof value === "boolean") state[key] = value;
    }
  } catch {
    return state;
  }

  return state;
}

export function serializeSidebarSectionState(state: SidebarSectionState): string {
  const persisted: PersistedSidebarSectionState = {
    version: SIDEBAR_SECTION_PREFERENCE_VERSION,
    expanded: {
      chapterContext: state.chapterContext,
      editorialPasses: state.editorialPasses,
      chapterNotes: state.chapterNotes
    }
  };

  return JSON.stringify(persisted);
}

export class SidebarSectionPreferences {
  private state: SidebarSectionState;

  constructor(
    private readonly storage: SidebarPreferenceStorage | null,
    private readonly storageKey: string
  ) {
    this.state = parseSidebarSectionState(this.readPreference());
  }

  isExpanded(section: SidebarSectionKey): boolean {
    return this.state[section];
  }

  setExpanded(section: SidebarSectionKey, expanded: boolean): boolean {
    if (this.state[section] === expanded) return false;

    this.state = {
      ...this.state,
      [section]: expanded
    };
    this.writePreference();
    return true;
  }

  snapshot(): SidebarSectionState {
    return { ...this.state };
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
        serializeSidebarSectionState(this.state)
      );
    } catch {
      // The in-memory preference still applies for this Obsidian session.
    }
  }
}

const CHAPTER_CONTEXT_SUMMARY_KEYS = [
  "pov",
  "story_date",
  "chapter_status",
  "editorial_pass"
] as const;

function fieldForKey(
  key: typeof CHAPTER_CONTEXT_SUMMARY_KEYS[number]
): EditableChapterContextField {
  const field = EDITABLE_CHAPTER_CONTEXT_FIELDS.find(
    (candidate) => candidate.key === key
  );

  if (!field) {
    throw new Error(`Missing Chapter Context field definition for ${key}.`);
  }

  return field;
}

function renderWikilinkText(value: string): string {
  return value.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_match, target: string, alias: string | undefined) =>
      (alias ?? target).trim()
  );
}

function formatStoryDate(
  value: string,
  locale?: string | string[]
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return value;
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC"
    }).format(date);
  } catch {
    return value;
  }
}

function displayContextValue(
  field: EditableChapterContextField,
  value: string,
  locale?: string | string[]
): string {
  if (field.key === "pov") return renderWikilinkText(value);
  if (field.key === "story_date") return formatStoryDate(value, locale);
  return field.optionLabels?.[value] ?? value;
}

export function buildChapterContextSummary(
  frontmatter: Record<string, unknown> | undefined,
  locale?: string | string[]
): string {
  const values: string[] = [];

  for (const key of CHAPTER_CONTEXT_SUMMARY_KEYS) {
    const field = fieldForKey(key);
    const value = getEditableChapterContextValue(frontmatter, field).value;
    if (!value) continue;

    const displayValue = displayContextValue(field, value, locale).trim();
    if (displayValue) values.push(displayValue);
  }

  return values.length > 0 ? values.join(" · ") : "No chapter context";
}

export function buildChapterNoteSummary(
  body: string,
  maxLength = 88
): string {
  const compact = body.replace(/\s+/g, " ").trim();
  if (!compact || maxLength <= 0) return "";
  if (compact.length <= maxLength) return compact;
  if (maxLength === 1) return "…";

  return `${compact.slice(0, maxLength - 1).trimEnd()}…`;
}
