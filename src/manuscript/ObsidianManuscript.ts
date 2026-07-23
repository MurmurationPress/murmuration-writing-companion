import { App, TFile, TFolder } from "obsidian";
import { isBookFrontmatter } from "../editorial/BookReview";
import { parseWikilink } from "../story-world/StoryWorldIndex";
import {
  buildManuscriptOrder,
  ManuscriptDocumentRecord,
  ManuscriptOrderResult
} from "./ManuscriptOrder";
import {
  MANUSCRIPT_ORDER_KEY_PROPERTY,
  manuscriptOrderKey
} from "./ManuscriptOrderKey";
import {
  explicitManuscriptKind,
  hasSceneMetadataSignal,
  manuscriptDisplayTitle,
  manuscriptHierarchyReferences,
  ManuscriptSceneMetadata,
  manuscriptSceneMetadata
} from "./ManuscriptMetadata";
import {
  findLegacyOwningBookPath,
  findLegacyParentPath,
  isTemplateManuscriptPath,
  LegacyBookFolder,
  normalizeVaultPath
} from "./LegacyManuscriptHierarchy";
import { visibleManuscriptOrder } from "./VisibleManuscriptOrder";

interface RawManuscriptFile {
  readonly file: TFile;
  readonly frontmatter: Record<string, unknown> | undefined;
  readonly explicitKind: ReturnType<typeof explicitManuscriptKind>;
  readonly parentPath: string | null;
  readonly explicitParent: boolean;
  readonly parentReferenceInvalid: boolean;
  readonly explicitBookPath: string | null;
  readonly orderKeyPresent: boolean;
  readonly orderKey: string | null;
}

interface PreliminaryManuscriptFile {
  readonly file: TFile;
  readonly frontmatter: Record<string, unknown> | undefined;
  readonly explicitKind: ReturnType<typeof explicitManuscriptKind>;
  readonly explicitParentPath: string | null;
  readonly parentReferences: readonly string[];
  readonly explicitBookPath: string | null;
  readonly associatedFolderPath: string | null;
  readonly orderKeyPresent: boolean;
  readonly orderKey: string | null;
}

export interface ObsidianManuscriptBook {
  readonly file: TFile;
  readonly record: ManuscriptDocumentRecord;
  readonly result: ManuscriptOrderResult;
  readonly filesByPath: ReadonlyMap<string, TFile>;
  readonly metadataByPath: ReadonlyMap<string, ManuscriptSceneMetadata>;
}

export interface ObsidianManuscriptLibrary {
  readonly books: readonly ObsidianManuscriptBook[];
  readonly owningBookPathByFile: ReadonlyMap<string, string>;
}

function frontmatterFor(
  app: App,
  file: TFile
): Record<string, unknown> | undefined {
  return app.metadataCache.getFileCache(file)?.frontmatter as
    Record<string, unknown> | undefined;
}

function hasOwnProperty(
  frontmatter: Record<string, unknown> | undefined,
  property: string
): boolean {
  return Boolean(frontmatter && Object.prototype.hasOwnProperty.call(frontmatter, property));
}

function resolveReference(app: App, source: TFile, reference: string): TFile | null {
  const parsed = parseWikilink(reference);
  const linkpath = parsed?.linkpath ?? reference.trim();
  if (!linkpath) return null;
  return app.metadataCache.getFirstLinkpathDest(linkpath, source.path);
}

function firstResolvedPath(
  app: App,
  source: TFile,
  references: readonly string[]
): string | null {
  for (const reference of references) {
    const resolved = resolveReference(app, source, reference);
    if (resolved) return resolved.path;
  }
  return null;
}

export function associatedManuscriptFolderPath(app: App, file: TFile): string | null {
  const parent = file.parent;
  if (!parent) return null;
  if (parent.name === file.basename) return parent.path;

  const siblingPath = parent.path
    ? `${parent.path}/${file.basename}`
    : file.basename;
  const sibling = app.vault.getAbstractFileByPath(siblingPath);
  return sibling instanceof TFolder ? sibling.path : null;
}

function rawFiles(app: App): Map<string, RawManuscriptFile> {
  const preliminary = new Map<string, PreliminaryManuscriptFile>();

  for (const file of app.vault.getMarkdownFiles()) {
    const frontmatter = frontmatterFor(app, file);
    const hierarchy = manuscriptHierarchyReferences(frontmatter);
    preliminary.set(file.path, {
      file,
      frontmatter,
      explicitKind: explicitManuscriptKind(frontmatter),
      explicitParentPath: firstResolvedPath(app, file, hierarchy.parentReferences),
      parentReferences: hierarchy.parentReferences,
      explicitBookPath: firstResolvedPath(app, file, hierarchy.bookReferences),
      associatedFolderPath: associatedManuscriptFolderPath(app, file),
      orderKeyPresent: hasOwnProperty(frontmatter, MANUSCRIPT_ORDER_KEY_PROPERTY),
      orderKey: manuscriptOrderKey(frontmatter?.[MANUSCRIPT_ORDER_KEY_PROPERTY])
    });
  }

  const folderNotePathByFolder = new Map<string, string>();
  for (const candidate of preliminary.values()) {
    if (!candidate.associatedFolderPath) continue;
    folderNotePathByFolder.set(
      normalizeVaultPath(candidate.associatedFolderPath),
      candidate.file.path
    );
  }

  const legacyBooks: LegacyBookFolder[] = [...preliminary.values()]
    .filter((candidate) => (
      candidate.explicitKind === "book"
      && candidate.associatedFolderPath !== null
      && !isTemplateManuscriptPath(candidate.file.path)
    ))
    .map((candidate) => ({
      bookPath: candidate.file.path,
      folderPath: candidate.associatedFolderPath!
    }));
  const legacyBookByPath = new Map(
    legacyBooks.map((book) => [book.bookPath, book])
  );
  const result = new Map<string, RawManuscriptFile>();

  for (const candidate of preliminary.values()) {
    const legacyBookPath = findLegacyOwningBookPath(
      candidate.file.path,
      legacyBooks
    );
    const resolvedBookPath = candidate.explicitBookPath ?? legacyBookPath;
    const legacyBook = resolvedBookPath
      ? legacyBookByPath.get(resolvedBookPath) ?? null
      : null;
    const legacyParentPath = legacyBook
      ? findLegacyParentPath(
        candidate.file.path,
        legacyBook.bookPath,
        legacyBook.folderPath,
        folderNotePathByFolder
      )
      : null;

    result.set(candidate.file.path, {
      file: candidate.file,
      frontmatter: candidate.frontmatter,
      explicitKind: candidate.explicitKind,
      parentPath: candidate.explicitParentPath ?? legacyParentPath,
      explicitParent: candidate.parentReferences.length > 0,
      parentReferenceInvalid: candidate.parentReferences.length > 0
        && candidate.explicitParentPath === null,
      explicitBookPath: candidate.explicitBookPath ?? legacyBookPath,
      orderKeyPresent: candidate.orderKeyPresent,
      orderKey: candidate.orderKey
    });
  }

  return result;
}

function owningBookPath(
  path: string,
  files: ReadonlyMap<string, RawManuscriptFile>,
  memo: Map<string, string | null>,
  visiting = new Set<string>()
): string | null {
  if (memo.has(path)) return memo.get(path) ?? null;
  if (visiting.has(path)) return null;

  const current = files.get(path);
  if (!current) return null;
  if (current.explicitKind === "book") {
    memo.set(path, path);
    return path;
  }

  visiting.add(path);
  let owner: string | null = null;
  if (current.explicitBookPath) {
    const explicitBook = files.get(current.explicitBookPath);
    if (explicitBook?.explicitKind === "book") owner = explicitBook.file.path;
  }
  if (!owner && current.parentPath) {
    owner = owningBookPath(current.parentPath, files, memo, visiting);
  }

  visiting.delete(path);
  memo.set(path, owner);
  return owner;
}

function recordFor(
  raw: RawManuscriptFile,
  bookPath: string,
  parentReferencedPaths: ReadonlySet<string>
): ManuscriptDocumentRecord | null {
  let kind = raw.explicitKind;

  if (!kind) {
    if (parentReferencedPaths.has(raw.file.path)) {
      kind = "part";
    } else if (
      raw.parentPath
      || raw.explicitBookPath
      || hasSceneMetadataSignal(raw.frontmatter)
    ) {
      kind = "scene";
    }
  }

  if (kind !== "book" && kind !== "part" && kind !== "scene") return null;

  return {
    path: raw.file.path,
    basename: raw.file.basename,
    title: manuscriptDisplayTitle({
      path: raw.file.path,
      basename: raw.file.basename,
      frontmatter: raw.frontmatter
    }),
    kind,
    bookPath,
    parentPath: kind === "book" ? null : raw.parentPath ?? bookPath,
    orderKey: kind === "book" ? null : raw.orderKey,
    orderKeyPresent: kind !== "book" && raw.orderKeyPresent,
    explicitParent: kind !== "book" && raw.explicitParent,
    parentReferenceInvalid: kind !== "book" && raw.parentReferenceInvalid
  };
}

function buildBook(
  app: App,
  bookRaw: RawManuscriptFile,
  files: ReadonlyMap<string, RawManuscriptFile>,
  ownerByPath: ReadonlyMap<string, string | null>
): ObsidianManuscriptBook {
  const bookPath = bookRaw.file.path;
  const ownedRaw = [...files.values()].filter((candidate) => (
    ownerByPath.get(candidate.file.path) === bookPath
  ));
  const parentReferencedPaths = new Set(
    ownedRaw
      .map((candidate) => candidate.parentPath)
      .filter((path): path is string => path !== null)
  );
  const records = ownedRaw
    .map((candidate) => recordFor(candidate, bookPath, parentReferencedPaths))
    .filter((record): record is ManuscriptDocumentRecord => record !== null);
  const bookRecord = records.find((record) => record.path === bookPath) ?? {
    path: bookPath,
    basename: bookRaw.file.basename,
    title: manuscriptDisplayTitle({
      path: bookPath,
      basename: bookRaw.file.basename,
      frontmatter: bookRaw.frontmatter
    }),
    kind: "book" as const,
    bookPath,
    parentPath: null,
    orderKey: null,
    orderKeyPresent: false,
    explicitParent: false,
    parentReferenceInvalid: false
  };
  const recordsByPath = new Map(records.map((record) => [record.path, record]));
  const filesByPath = new Map<string, TFile>();
  const metadataByPath = new Map<string, ManuscriptSceneMetadata>();

  for (const candidate of ownedRaw) {
    if (!recordsByPath.has(candidate.file.path)) continue;
    filesByPath.set(candidate.file.path, candidate.file);
    metadataByPath.set(
      candidate.file.path,
      manuscriptSceneMetadata(candidate.frontmatter)
    );
  }

  const resolvedResult = buildManuscriptOrder(
    bookRecord,
    bookRaw.frontmatter,
    records,
    (linkpath) => {
      const destination = app.metadataCache.getFirstLinkpathDest(
        linkpath,
        bookRaw.file.path
      );
      if (destination) return recordsByPath.get(destination.path) ?? null;

      const normalized = linkpath.trim().toLowerCase();
      const matches = records.filter((record) => (
        record.basename.toLowerCase() === normalized
        || record.title.toLowerCase() === normalized
      ));
      return matches.length === 1 ? matches[0] : null;
    }
  );
  const result = visibleManuscriptOrder(bookPath, resolvedResult);

  return {
    file: bookRaw.file,
    record: bookRecord,
    result,
    filesByPath,
    metadataByPath
  };
}

export function buildObsidianManuscriptLibrary(app: App): ObsidianManuscriptLibrary {
  const files = rawFiles(app);
  const ownerMemo = new Map<string, string | null>();
  for (const path of files.keys()) owningBookPath(path, files, ownerMemo);

  const books = [...files.values()]
    .filter((candidate) => (
      isBookFrontmatter(candidate.frontmatter)
      && !isTemplateManuscriptPath(candidate.file.path)
    ))
    .map((book) => buildBook(app, book, files, ownerMemo))
    .sort((left, right) => left.record.title.localeCompare(right.record.title, "en", {
      numeric: true,
      sensitivity: "base"
    }));
  const owningBookPathByFile = new Map<string, string>();

  for (const book of books) {
    for (const path of book.filesByPath.keys()) {
      owningBookPathByFile.set(path, book.file.path);
    }
  }

  return { books, owningBookPathByFile };
}
