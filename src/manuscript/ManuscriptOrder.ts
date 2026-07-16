import { parseWikilink } from "../story-world/StoryWorldIndex";

export const MANUSCRIPT_ORDER_PROPERTY = "manuscript_order";

export type ManuscriptEntryKind = "book" | "part" | "scene" | "other";

export interface ManuscriptDocumentRecord {
  readonly path: string;
  readonly basename: string;
  readonly title: string;
  readonly kind: ManuscriptEntryKind;
  readonly bookPath: string;
  readonly parentPath: string | null;
}

export interface ManuscriptOrderNode {
  readonly entry: ManuscriptDocumentRecord;
  readonly children: readonly ManuscriptOrderNode[];
}

export type ManuscriptOrderSource = "explicit" | "legacy" | "none" | "invalid";

export type ManuscriptOrderDiagnosticKind =
  | "invalid_property_shape"
  | "invalid_reference"
  | "unresolved_reference"
  | "invalid_entry_kind"
  | "duplicate_entry"
  | "cross_book_entry"
  | "unlisted_entry"
  | "missing_parent"
  | "parent_cycle"
  | "legacy_ambiguous";

export interface ManuscriptOrderDiagnostic {
  readonly kind: ManuscriptOrderDiagnosticKind;
  readonly message: string;
  readonly reference?: string;
  readonly path?: string;
}

export interface ManuscriptOrderResult {
  readonly source: ManuscriptOrderSource;
  readonly entries: readonly ManuscriptDocumentRecord[];
  readonly roots: readonly ManuscriptOrderNode[];
  readonly scenes: readonly ManuscriptDocumentRecord[];
  readonly diagnostics: readonly ManuscriptOrderDiagnostic[];
}

export interface LegacyOrderProposal {
  readonly entries: readonly ManuscriptDocumentRecord[];
  readonly ambiguousPaths: readonly string[];
}

export type ManuscriptOrderResolver = (
  linkpath: string
) => ManuscriptDocumentRecord | null;

interface ExplicitOrderRead {
  readonly state: "missing" | "valid" | "invalid";
  readonly references: readonly string[];
  readonly diagnostics: readonly ManuscriptOrderDiagnostic[];
}

interface MutableManuscriptOrderNode {
  readonly entry: ManuscriptDocumentRecord;
  readonly children: MutableManuscriptOrderNode[];
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function canonicalLinkpath(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\.md$/i, "");
}

function isManuscriptOrderEntry(record: ManuscriptDocumentRecord): boolean {
  return record.kind === "part" || record.kind === "scene";
}

function readExplicitOrder(
  frontmatter: Record<string, unknown> | undefined
): ExplicitOrderRead {
  if (!frontmatter || !Object.prototype.hasOwnProperty.call(
    frontmatter,
    MANUSCRIPT_ORDER_PROPERTY
  )) {
    return { state: "missing", references: [], diagnostics: [] };
  }

  const value = frontmatter[MANUSCRIPT_ORDER_PROPERTY];
  if (!Array.isArray(value)) {
    return {
      state: "invalid",
      references: [],
      diagnostics: [{
        kind: "invalid_property_shape",
        message: `${MANUSCRIPT_ORDER_PROPERTY} must be a YAML list of wikilinks.`
      }]
    };
  }

  const references: string[] = [];
  const diagnostics: ManuscriptOrderDiagnostic[] = [];

  for (const item of value) {
    const reference = nonEmptyString(item);
    if (!reference) {
      diagnostics.push({
        kind: "invalid_reference",
        message: "Manuscript order entries must be non-empty wikilink strings."
      });
      continue;
    }
    references.push(reference);
  }

  return { state: "valid", references, diagnostics };
}

function numericPrefix(value: string): number | null {
  const match = /^\s*(\d+)(?=$|[\s._-])/.exec(value);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function compareLegacySiblings(
  left: ManuscriptDocumentRecord,
  right: ManuscriptDocumentRecord
): number {
  const leftPrefix = numericPrefix(left.basename);
  const rightPrefix = numericPrefix(right.basename);

  if (leftPrefix !== null && rightPrefix !== null && leftPrefix !== rightPrefix) {
    return leftPrefix - rightPrefix;
  }
  if (leftPrefix !== null && rightPrefix === null) return -1;
  if (leftPrefix === null && rightPrefix !== null) return 1;

  return left.basename.localeCompare(right.basename, "en", {
    numeric: true,
    sensitivity: "base"
  });
}

export function proposeLegacyFilenameOrder(
  bookPath: string,
  records: readonly ManuscriptDocumentRecord[]
): LegacyOrderProposal {
  const eligible = records.filter((record) => (
    record.path !== bookPath
    && record.bookPath === bookPath
    && isManuscriptOrderEntry(record)
  ));
  const byParent = new Map<string, ManuscriptDocumentRecord[]>();

  for (const record of eligible) {
    const parent = record.parentPath ?? bookPath;
    const siblings = byParent.get(parent);
    if (siblings) siblings.push(record);
    else byParent.set(parent, [record]);
  }

  for (const siblings of byParent.values()) siblings.sort(compareLegacySiblings);

  const ambiguous = new Set<string>();
  for (const siblings of byParent.values()) {
    const usedPrefixes = new Map<number, string>();
    for (const sibling of siblings) {
      const prefix = numericPrefix(sibling.basename);
      if (prefix === null) {
        ambiguous.add(sibling.path);
        continue;
      }

      const existing = usedPrefixes.get(prefix);
      if (existing) {
        ambiguous.add(existing);
        ambiguous.add(sibling.path);
      } else {
        usedPrefixes.set(prefix, sibling.path);
      }
    }
  }

  const entries: ManuscriptDocumentRecord[] = [];
  const visited = new Set<string>();

  const appendChildren = (parentPath: string) => {
    for (const child of byParent.get(parentPath) ?? []) {
      if (visited.has(child.path)) continue;
      visited.add(child.path);
      entries.push(child);
      appendChildren(child.path);
    }
  };

  appendChildren(bookPath);

  // Malformed or incomplete hierarchy remains visible at the end of the
  // proposal rather than disappearing from migration review.
  for (const record of [...eligible].sort(compareLegacySiblings)) {
    if (visited.has(record.path)) continue;
    visited.add(record.path);
    ambiguous.add(record.path);
    entries.push(record);
    appendChildren(record.path);
  }

  return {
    entries,
    ambiguousPaths: [...ambiguous]
  };
}

function resolveExplicitEntries(
  book: ManuscriptDocumentRecord,
  references: readonly string[],
  resolve: ManuscriptOrderResolver,
  diagnostics: ManuscriptOrderDiagnostic[]
): ManuscriptDocumentRecord[] {
  const entries: ManuscriptDocumentRecord[] = [];
  const seenPaths = new Set<string>();

  for (const reference of references) {
    const parsed = parseWikilink(reference);
    if (!parsed) {
      diagnostics.push({
        kind: "invalid_reference",
        reference,
        message: `Invalid manuscript-order wikilink: ${reference}`
      });
      continue;
    }

    const entry = resolve(parsed.linkpath);
    if (!entry) {
      diagnostics.push({
        kind: "unresolved_reference",
        reference,
        message: `Manuscript-order reference could not be resolved: ${reference}`
      });
      continue;
    }

    if (entry.path === book.path || entry.bookPath !== book.path) {
      diagnostics.push({
        kind: "cross_book_entry",
        reference,
        path: entry.path,
        message: `${entry.title} does not belong to ${book.title}.`
      });
      continue;
    }

    if (!isManuscriptOrderEntry(entry)) {
      diagnostics.push({
        kind: "invalid_entry_kind",
        reference,
        path: entry.path,
        message: `${entry.title} is not a recognised manuscript part or scene.`
      });
      continue;
    }

    if (seenPaths.has(entry.path)) {
      diagnostics.push({
        kind: "duplicate_entry",
        reference,
        path: entry.path,
        message: `${entry.title} appears more than once in manuscript order.`
      });
      continue;
    }

    seenPaths.add(entry.path);
    entries.push(entry);
  }

  return entries;
}

function cyclePaths(
  entries: readonly ManuscriptDocumentRecord[]
): Set<string> {
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const cycles = new Set<string>();

  for (const start of entries) {
    const chain: string[] = [];
    const position = new Map<string, number>();
    let current: ManuscriptDocumentRecord | undefined = start;

    while (current) {
      const existingPosition = position.get(current.path);
      if (existingPosition !== undefined) {
        for (const path of chain.slice(existingPosition)) cycles.add(path);
        break;
      }

      position.set(current.path, chain.length);
      chain.push(current.path);
      current = current.parentPath
        ? byPath.get(current.parentPath)
        : undefined;
    }
  }

  return cycles;
}

function buildTree(
  book: ManuscriptDocumentRecord,
  entries: readonly ManuscriptDocumentRecord[],
  diagnostics: ManuscriptOrderDiagnostic[]
): ManuscriptOrderNode[] {
  const nodes = new Map<string, MutableManuscriptOrderNode>();
  for (const entry of entries) {
    nodes.set(entry.path, { entry, children: [] });
  }

  const cycles = cyclePaths(entries);
  for (const path of cycles) {
    const entry = nodes.get(path)?.entry;
    diagnostics.push({
      kind: "parent_cycle",
      path,
      message: `${entry?.title ?? path} participates in a manuscript-parent cycle.`
    });
  }

  const roots: MutableManuscriptOrderNode[] = [];
  for (const entry of entries) {
    const node = nodes.get(entry.path)!;
    const parentPath = entry.parentPath;

    if (!parentPath || parentPath === book.path || cycles.has(entry.path)) {
      roots.push(node);
      continue;
    }

    const parent = nodes.get(parentPath);
    if (!parent || cycles.has(parentPath)) {
      diagnostics.push({
        kind: "missing_parent",
        path: entry.path,
        message: `${entry.title}'s parent is not present in manuscript order.`
      });
      roots.push(node);
      continue;
    }

    parent.children.push(node);
  }

  return roots;
}

export function buildManuscriptOrder(
  book: ManuscriptDocumentRecord,
  bookFrontmatter: Record<string, unknown> | undefined,
  knownRecords: readonly ManuscriptDocumentRecord[],
  resolve: ManuscriptOrderResolver
): ManuscriptOrderResult {
  const read = readExplicitOrder(bookFrontmatter);
  const diagnostics = [...read.diagnostics];
  let source: ManuscriptOrderSource;
  let entries: ManuscriptDocumentRecord[];

  if (read.state === "valid") {
    source = "explicit";
    entries = resolveExplicitEntries(book, read.references, resolve, diagnostics);

    const listed = new Set(entries.map((entry) => entry.path));
    for (const record of knownRecords) {
      if (
        record.path === book.path
        || record.bookPath !== book.path
        || !isManuscriptOrderEntry(record)
        || listed.has(record.path)
      ) continue;

      diagnostics.push({
        kind: "unlisted_entry",
        path: record.path,
        message: `${record.title} belongs to the book but is not listed in manuscript order.`
      });
    }
  } else if (read.state === "invalid") {
    source = "invalid";
    entries = [];
  } else {
    const legacy = proposeLegacyFilenameOrder(book.path, knownRecords);
    entries = [...legacy.entries];
    source = entries.length > 0 ? "legacy" : "none";

    for (const path of legacy.ambiguousPaths) {
      const record = knownRecords.find((candidate) => candidate.path === path);
      diagnostics.push({
        kind: "legacy_ambiguous",
        path,
        message: `${record?.title ?? path} needs review before legacy order is adopted.`
      });
    }
  }

  const roots = buildTree(book, entries, diagnostics);
  return {
    source,
    entries,
    roots,
    scenes: entries.filter((entry) => entry.kind === "scene"),
    diagnostics
  };
}

export function previousManuscriptScene(
  result: ManuscriptOrderResult,
  scenePath: string
): ManuscriptDocumentRecord | null {
  const index = result.scenes.findIndex((scene) => scene.path === scenePath);
  return index > 0 ? result.scenes[index - 1] : null;
}

export function nextManuscriptScene(
  result: ManuscriptOrderResult,
  scenePath: string
): ManuscriptDocumentRecord | null {
  const index = result.scenes.findIndex((scene) => scene.path === scenePath);
  return index >= 0 && index < result.scenes.length - 1
    ? result.scenes[index + 1]
    : null;
}

function referenceTargetMatches(target: string, oldPath: string): boolean {
  const canonicalTarget = canonicalLinkpath(target).toLowerCase();
  const canonicalOldPath = canonicalLinkpath(oldPath).toLowerCase();
  return canonicalTarget === canonicalOldPath
    || canonicalOldPath.endsWith(`/${canonicalTarget}`);
}

function preserveReferenceDepth(target: string, newPath: string): string {
  const targetSegments = canonicalLinkpath(target).split("/").filter(Boolean);
  const newSegments = canonicalLinkpath(newPath).split("/").filter(Boolean);
  if (targetSegments.length === 0 || targetSegments.length >= newSegments.length) {
    return canonicalLinkpath(newPath);
  }
  return newSegments.slice(-targetSegments.length).join("/");
}

function rewriteReferenceTarget(
  reference: string,
  oldPath: string,
  newPath: string
): string {
  const parsed = parseWikilink(reference);
  if (!parsed || !referenceTargetMatches(parsed.linkpath, oldPath)) return reference;

  const target = preserveReferenceDepth(parsed.linkpath, newPath);
  return parsed.displayText
    ? `[[${target}|${parsed.displayText}]]`
    : `[[${target}]]`;
}

export function rewriteManuscriptOrderForRename(
  frontmatter: Record<string, unknown>,
  oldPath: string,
  newPath: string
): boolean {
  const value = frontmatter[MANUSCRIPT_ORDER_PROPERTY];
  if (!Array.isArray(value)) return false;

  let changed = false;
  const rewritten = value.map((item) => {
    if (typeof item !== "string") return item;
    const next = rewriteReferenceTarget(item, oldPath, newPath);
    if (next !== item) changed = true;
    return next;
  });

  if (changed) frontmatter[MANUSCRIPT_ORDER_PROPERTY] = rewritten;
  return changed;
}
