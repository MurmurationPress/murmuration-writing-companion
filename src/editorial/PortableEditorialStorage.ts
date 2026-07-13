import type {
  Annotation,
  AnnotationAnchor,
  ChapterNote,
  EditorialStore,
  OrphanedEditorialPage,
  PageEditorialNotes
} from "./EditorialNote";

export const PORTABLE_EDITORIAL_DATA_PATH =
  ".murmuration/writing-companion/editorial-data.json";
export const PORTABLE_EDITORIAL_SCHEMA_VERSION = 2;

export type EditorialStorageErrorCode =
  | "empty"
  | "malformed"
  | "invalid-shape"
  | "unsupported-version"
  | "write-failed"
  | "path-conflict";

export class EditorialStorageError extends Error {
  readonly code: EditorialStorageErrorCode;
  readonly originalError?: unknown;

  constructor(
    code: EditorialStorageErrorCode,
    message: string,
    originalError?: unknown
  ) {
    super(message);
    this.name = "EditorialStorageError";
    this.code = code;
    this.originalError = originalError;
  }
}

export interface PortableEditorialFileSystem {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  rename(sourcePath: string, targetPath: string): Promise<void>;
  remove(path: string): Promise<void>;
  mkdir(path: string): Promise<void>;
}

export interface PortableEditorialStoragePaths {
  primary: string;
  temporary: string;
  backup: string;
  corrupt: string;
}

export function portableEditorialStoragePaths(
  primary = PORTABLE_EDITORIAL_DATA_PATH
): PortableEditorialStoragePaths {
  return {
    primary,
    temporary: `${primary}.tmp`,
    backup: `${primary}.bak`,
    corrupt: `${primary}.corrupt`
  };
}

function parentDirectories(path: string): string[] {
  const parts = path.split("/").filter(Boolean).slice(0, -1);
  const directories: string[] = [];
  let current = "";

  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    directories.push(current);
  }

  return directories;
}

export class AtomicTextFileStore {
  constructor(private readonly fileSystem: PortableEditorialFileSystem) {}

  async readOptional(path: string): Promise<string | null> {
    if (!(await this.fileSystem.exists(path))) return null;
    return this.fileSystem.read(path);
  }

  async writeAtomic(path: string, content: string): Promise<void> {
    const paths = portableEditorialStoragePaths(path);
    await this.ensureParentDirectories(path);
    await this.removeIfExists(paths.temporary);

    try {
      await this.fileSystem.write(paths.temporary, content);
      const hadPrimary = await this.fileSystem.exists(paths.primary);

      if (hadPrimary) {
        await this.removeIfExists(paths.backup);
        await this.fileSystem.rename(paths.primary, paths.backup);
      }

      try {
        await this.fileSystem.rename(paths.temporary, paths.primary);
      } catch (error) {
        await this.restoreBackupAfterFailedPublish(paths);
        throw error;
      }
    } catch (error) {
      throw new EditorialStorageError(
        "write-failed",
        `Could not write portable editorial storage at ${path}.`,
        error
      );
    }
  }

  async restoreAtomic(path: string, content: string): Promise<void> {
    const paths = portableEditorialStoragePaths(path);
    await this.ensureParentDirectories(path);
    await this.removeIfExists(paths.temporary);

    try {
      await this.fileSystem.write(paths.temporary, content);
      const hadPrimary = await this.fileSystem.exists(paths.primary);

      if (hadPrimary) {
        await this.removeIfExists(paths.corrupt);
        await this.fileSystem.rename(paths.primary, paths.corrupt);
      }

      try {
        await this.fileSystem.rename(paths.temporary, paths.primary);
      } catch (error) {
        if (
          !(await this.fileSystem.exists(paths.primary))
          && await this.fileSystem.exists(paths.corrupt)
        ) {
          await this.fileSystem.rename(paths.corrupt, paths.primary);
        }
        throw error;
      }
    } catch (error) {
      throw new EditorialStorageError(
        "write-failed",
        `Could not recover portable editorial storage at ${path}.`,
        error
      );
    }
  }

  private async ensureParentDirectories(path: string): Promise<void> {
    for (const directory of parentDirectories(path)) {
      if (!(await this.fileSystem.exists(directory))) {
        await this.fileSystem.mkdir(directory);
      }
    }
  }

  private async removeIfExists(path: string): Promise<void> {
    if (await this.fileSystem.exists(path)) {
      await this.fileSystem.remove(path);
    }
  }

  private async restoreBackupAfterFailedPublish(
    paths: PortableEditorialStoragePaths
  ): Promise<void> {
    if (
      !(await this.fileSystem.exists(paths.primary))
      && await this.fileSystem.exists(paths.backup)
    ) {
      await this.fileSystem.rename(paths.backup, paths.primary);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

interface NormalizedResult<T> {
  value: T;
  changed: boolean;
}

function normalizeAnnotation(
  value: unknown,
  now: string
): NormalizedResult<Annotation> | null {
  if (!isRecord(value)) return null;

  const rawAnchor = isRecord(value.anchor) ? value.anchor : {};
  const anchor: AnnotationAnchor = {
    ...rawAnchor,
    text: stringValue(rawAnchor.text)
  };
  if (typeof rawAnchor.line === "number") anchor.line = rawAnchor.line;

  const annotation = {
    ...value,
    id: stringValue(value.id),
    body: stringValue(value.body),
    category: stringValue(value.category, "Editorial"),
    status: value.status === "resolved" ? "resolved" : "open",
    created: stringValue(value.created, now),
    updated: stringValue(value.updated, now),
    anchor
  } as Annotation;

  const changed =
    !isRecord(value.anchor)
    || typeof rawAnchor.text !== "string"
    || typeof value.id !== "string"
    || typeof value.body !== "string"
    || typeof value.category !== "string"
    || (value.status !== "open" && value.status !== "resolved")
    || typeof value.created !== "string"
    || typeof value.updated !== "string";

  return { value: annotation, changed };
}

function normalizeChapterNote(
  rawPage: Record<string, unknown>,
  now: string
): NormalizedResult<ChapterNote> {
  if (isRecord(rawPage.chapterNote)) {
    const raw = rawPage.chapterNote;
    const value = {
      ...raw,
      body: stringValue(raw.body),
      created: stringValue(raw.created, now),
      updated: stringValue(raw.updated, now)
    } as ChapterNote;

    return {
      value,
      changed:
        typeof raw.body !== "string"
        || typeof raw.created !== "string"
        || typeof raw.updated !== "string"
    };
  }

  const legacyNotes = Array.isArray(rawPage.documentNotes)
    ? rawPage.documentNotes.filter(
        (note) => isRecord(note) && note.status === "open"
      ) as Record<string, unknown>[]
    : [];

  return {
    value: {
      body: legacyNotes.map((note) => stringValue(note.body)).join("\n\n"),
      created: stringValue(legacyNotes[0]?.created, now),
      updated: stringValue(
        legacyNotes[legacyNotes.length - 1]?.updated,
        now
      )
    },
    changed: true
  };
}

function normalizePage(
  value: unknown,
  now: string
): NormalizedResult<PageEditorialNotes> {
  const rawPage = isRecord(value) ? value : {};
  const rawAnnotations = Array.isArray(rawPage.annotations)
    ? rawPage.annotations
    : [];
  const annotations: Annotation[] = [];
  let changed = !isRecord(value) || !Array.isArray(rawPage.annotations);

  for (const rawAnnotation of rawAnnotations) {
    const normalized = normalizeAnnotation(rawAnnotation, now);
    if (!normalized) {
      changed = true;
      continue;
    }

    annotations.push(normalized.value);
    changed = changed || normalized.changed;
  }

  const chapterNote = normalizeChapterNote(rawPage, now);
  changed = changed || chapterNote.changed;

  const page = {
    ...rawPage,
    chapterNote: chapterNote.value,
    annotations
  } as PageEditorialNotes;

  if (rawPage.deletedAt !== undefined) {
    if (typeof rawPage.deletedAt === "string" && rawPage.deletedAt.length > 0) {
      page.deletedAt = rawPage.deletedAt;
    } else {
      delete page.deletedAt;
      changed = true;
    }
  }

  return { value: page, changed };
}

function normalizeOrphanedPage(
  value: unknown,
  now: string
): NormalizedResult<OrphanedEditorialPage> {
  if (!isRecord(value)) {
    throw new EditorialStorageError(
      "invalid-shape",
      "Portable editorial storage contains an invalid orphaned page record."
    );
  }

  if (
    typeof value.originalPath !== "string"
    || value.originalPath.length === 0
    || typeof value.deletedAt !== "string"
    || value.deletedAt.length === 0
    || !isRecord(value.page)
  ) {
    throw new EditorialStorageError(
      "invalid-shape",
      "Portable editorial storage contains an incomplete orphaned page record."
    );
  }

  const normalizedPage = normalizePage(value.page, now);
  const page = { ...normalizedPage.value };
  if (page.deletedAt !== undefined) delete page.deletedAt;

  return {
    value: {
      ...value,
      originalPath: value.originalPath,
      deletedAt: value.deletedAt,
      page
    } as OrphanedEditorialPage,
    changed: normalizedPage.changed || normalizedPage.value.deletedAt !== undefined
  };
}

export function normalizeEditorialStore(
  input: unknown,
  now = new Date().toISOString()
): NormalizedResult<EditorialStore> {
  const rawStore = isRecord(input) ? input : {};
  const rawPages = isRecord(rawStore.pages) ? rawStore.pages : {};
  const pages: Record<string, PageEditorialNotes> = {};
  let changed = !isRecord(input) || !isRecord(rawStore.pages);

  for (const [path, rawPage] of Object.entries(rawPages)) {
    const normalized = normalizePage(rawPage, now);
    pages[path] = normalized.value;
    changed = changed || normalized.changed;
  }

  let orphanedPages: Record<string, OrphanedEditorialPage> | undefined;
  if (rawStore.orphanedPages !== undefined) {
    if (!isRecord(rawStore.orphanedPages)) {
      throw new EditorialStorageError(
        "invalid-shape",
        "Portable editorial storage orphanedPages must be an object."
      );
    }

    orphanedPages = {};
    for (const [id, rawOrphan] of Object.entries(rawStore.orphanedPages)) {
      const normalized = normalizeOrphanedPage(rawOrphan, now);
      orphanedPages[id] = normalized.value;
      changed = changed || normalized.changed;
    }
  }

  const extras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawStore)) {
    if (
      key !== "pages"
      && key !== "orphanedPages"
      && key !== "schemaVersion"
    ) {
      extras[key] = value;
    }
  }

  const store = {
    ...extras,
    pages
  } as EditorialStore;

  if (orphanedPages && Object.keys(orphanedPages).length > 0) {
    store.orphanedPages = orphanedPages;
  }

  return { value: store, changed };
}

function schemaVersion(value: unknown): number {
  if (value === undefined) return 0;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new EditorialStorageError(
      "invalid-shape",
      "Portable editorial storage has an invalid schemaVersion."
    );
  }
  return value;
}

export interface ParsedPortableEditorialStore {
  store: EditorialStore;
  migrated: boolean;
}

export function parsePortableEditorialStore(
  content: string,
  now = new Date().toISOString()
): ParsedPortableEditorialStore {
  if (!content.trim()) {
    throw new EditorialStorageError(
      "empty",
      "Portable editorial storage is empty."
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new EditorialStorageError(
      "malformed",
      "Portable editorial storage is not valid JSON.",
      error
    );
  }

  if (!isRecord(parsed) || !isRecord(parsed.pages)) {
    throw new EditorialStorageError(
      "invalid-shape",
      "Portable editorial storage must contain a pages object."
    );
  }

  const version = schemaVersion(parsed.schemaVersion);
  if (version > PORTABLE_EDITORIAL_SCHEMA_VERSION) {
    throw new EditorialStorageError(
      "unsupported-version",
      `Portable editorial storage uses schema version ${version}, but this plugin supports version ${PORTABLE_EDITORIAL_SCHEMA_VERSION}.`
    );
  }

  const normalized = normalizeEditorialStore(parsed, now);
  return {
    store: normalized.value,
    migrated:
      version !== PORTABLE_EDITORIAL_SCHEMA_VERSION || normalized.changed
  };
}

export function serializePortableEditorialStore(store: EditorialStore): string {
  const extras: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(store)) {
    if (
      key !== "pages"
      && key !== "orphanedPages"
      && key !== "schemaVersion"
    ) {
      extras[key] = value;
    }
  }

  const serialized: Record<string, unknown> = {
    schemaVersion: PORTABLE_EDITORIAL_SCHEMA_VERSION,
    ...extras,
    pages: store.pages
  };

  if (store.orphanedPages && Object.keys(store.orphanedPages).length > 0) {
    serialized.orphanedPages = store.orphanedPages;
  }

  return `${JSON.stringify(serialized, null, 2)}\n`;
}

export function hasLegacyEditorialData(value: unknown): boolean {
  return isRecord(value)
    && isRecord(value.pages)
    && Object.keys(value.pages).length > 0;
}

function deletedAt(page: PageEditorialNotes): string | null {
  return typeof page.deletedAt === "string" && page.deletedAt.length > 0
    ? page.deletedAt
    : null;
}

function uniqueOrphanId(
  store: EditorialStore,
  originalPath: string,
  deletionTime: string
): string {
  const base = `${deletionTime}::${originalPath}`;
  let id = base;
  let suffix = 2;

  while (store.orphanedPages?.[id]) {
    id = `${base}::${suffix}`;
    suffix += 1;
  }

  return id;
}

function archiveDeletedDestination(
  store: EditorialStore,
  path: string,
  page: PageEditorialNotes
): void {
  const deletionTime = deletedAt(page);
  if (!deletionTime) return;

  const archivedPage = { ...page };
  delete archivedPage.deletedAt;
  const id = uniqueOrphanId(store, path, deletionTime);
  const orphan: OrphanedEditorialPage = {
    originalPath: path,
    deletedAt: deletionTime,
    page: archivedPage
  };

  if (!store.orphanedPages) store.orphanedPages = {};
  store.orphanedPages[id] = orphan;
}

export function markEditorialPageDeleted(
  store: EditorialStore,
  path: string,
  now = new Date().toISOString()
): boolean {
  const page = store.pages[path];
  if (!page || deletedAt(page)) return false;
  page.deletedAt = now;
  return true;
}

export function restoreEditorialPage(
  store: EditorialStore,
  path: string
): boolean {
  const page = store.pages[path];
  if (page) {
    if (!deletedAt(page)) return false;
    delete page.deletedAt;
    return true;
  }

  const candidates = Object.entries(store.orphanedPages ?? {})
    .filter(([, orphan]) => orphan.originalPath === path)
    .sort((left, right) => right[1].deletedAt.localeCompare(left[1].deletedAt));
  const candidate = candidates[0];
  if (!candidate) return false;

  store.pages[path] = candidate[1].page;
  delete store.orphanedPages?.[candidate[0]];
  if (store.orphanedPages && Object.keys(store.orphanedPages).length === 0) {
    delete store.orphanedPages;
  }
  return true;
}

export interface EditorialPagePresenceResult {
  deletedPaths: string[];
  restoredPaths: string[];
}

export function reconcileEditorialPagePresence(
  store: EditorialStore,
  existingPaths: Iterable<string>,
  now = new Date().toISOString()
): EditorialPagePresenceResult {
  const existing = new Set(existingPaths);
  const deletedPaths: string[] = [];
  const restoredPaths: string[] = [];

  for (const path of Object.keys(store.pages)) {
    if (existing.has(path)) {
      if (restoreEditorialPage(store, path)) restoredPaths.push(path);
    } else if (markEditorialPageDeleted(store, path, now)) {
      deletedPaths.push(path);
    }
  }

  for (const path of existing) {
    if (!store.pages[path] && restoreEditorialPage(store, path)) {
      restoredPaths.push(path);
    }
  }

  return { deletedPaths, restoredPaths };
}

export function moveEditorialPage(
  store: EditorialStore,
  oldPath: string,
  newPath: string
): boolean {
  if (oldPath === newPath || !store.pages[oldPath]) return false;

  const destination = store.pages[newPath];
  if (destination) {
    if (deletedAt(destination)) {
      archiveDeletedDestination(store, newPath, destination);
      delete store.pages[newPath];
    } else {
      throw new EditorialStorageError(
        "path-conflict",
        `Editorial data already exists for ${newPath}; the rename was not applied.`
      );
    }
  }

  const source = store.pages[oldPath];
  delete source.deletedAt;
  store.pages[newPath] = source;
  delete store.pages[oldPath];
  return true;
}

export type PortableEditorialLoadSource =
  | "portable"
  | "legacy"
  | "empty"
  | "temporary"
  | "backup";

export interface PortableEditorialLoadResult {
  store: EditorialStore;
  source: PortableEditorialLoadSource;
  migrated: boolean;
  recovered: boolean;
}

interface RecoveryCandidate {
  path: string;
  source: "temporary" | "backup";
  parsed: ParsedPortableEditorialStore;
}

export class PortableEditorialStorage {
  private readonly paths: PortableEditorialStoragePaths;

  constructor(
    private readonly files: AtomicTextFileStore,
    primaryPath = PORTABLE_EDITORIAL_DATA_PATH
  ) {
    this.paths = portableEditorialStoragePaths(primaryPath);
  }

  async load(
    legacyData?: unknown,
    now = new Date().toISOString()
  ): Promise<PortableEditorialLoadResult> {
    const primary = await this.files.readOptional(this.paths.primary);

    if (primary !== null) {
      try {
        const parsed = parsePortableEditorialStore(primary, now);
        if (parsed.migrated) {
          await this.files.writeAtomic(
            this.paths.primary,
            serializePortableEditorialStore(parsed.store)
          );
        }

        return {
          store: parsed.store,
          source: "portable",
          migrated: parsed.migrated,
          recovered: false
        };
      } catch (error) {
        if (
          error instanceof EditorialStorageError
          && error.code === "unsupported-version"
        ) {
          throw error;
        }

        const recovered = await this.findRecoveryCandidate(now);
        if (!recovered) throw error;
        return this.restoreRecoveryCandidate(recovered);
      }
    }

    const recovered = await this.findRecoveryCandidate(now);
    if (recovered) return this.restoreRecoveryCandidate(recovered);

    const legacy = normalizeEditorialStore(legacyData ?? { pages: {} }, now);
    const source = hasLegacyEditorialData(legacyData) ? "legacy" : "empty";
    await this.files.writeAtomic(
      this.paths.primary,
      serializePortableEditorialStore(legacy.value)
    );

    return {
      store: legacy.value,
      source,
      migrated: source === "legacy" || legacy.changed,
      recovered: false
    };
  }

  async save(store: EditorialStore): Promise<void> {
    await this.files.writeAtomic(
      this.paths.primary,
      serializePortableEditorialStore(store)
    );
  }

  private async findRecoveryCandidate(
    now: string
  ): Promise<RecoveryCandidate | null> {
    let unsupported: EditorialStorageError | null = null;

    for (const candidate of [
      { path: this.paths.temporary, source: "temporary" as const },
      { path: this.paths.backup, source: "backup" as const }
    ]) {
      const content = await this.files.readOptional(candidate.path);
      if (content === null) continue;

      try {
        return {
          ...candidate,
          parsed: parsePortableEditorialStore(content, now)
        };
      } catch (error) {
        if (
          error instanceof EditorialStorageError
          && error.code === "unsupported-version"
        ) {
          unsupported = unsupported ?? error;
        }
      }
    }

    if (unsupported) throw unsupported;
    return null;
  }

  private async restoreRecoveryCandidate(
    candidate: RecoveryCandidate
  ): Promise<PortableEditorialLoadResult> {
    await this.files.restoreAtomic(
      this.paths.primary,
      serializePortableEditorialStore(candidate.parsed.store)
    );

    return {
      store: candidate.parsed.store,
      source: candidate.source,
      migrated: candidate.parsed.migrated,
      recovered: true
    };
  }
}
