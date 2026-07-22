import { App, TFile } from "obsidian";
import {
  BOOK_REFERENCE_ALIASES,
  BOOK_TYPE_ALIASES,
  isBookFrontmatter,
  MANUSCRIPT_PARENT_ALIASES,
  normalizeBookPropertyName
} from "../editorial/BookReview";
import { parseWikilink } from "../story-world/StoryWorldIndex";

function frontmatterFor(app: App, file: TFile): Record<string, unknown> | undefined {
  return app.metadataCache.getFileCache(file)?.frontmatter as
    Record<string, unknown> | undefined;
}

export interface ExplicitOwningBookResolution {
  readonly book: TFile;
  readonly source: TFile;
  readonly property: readonly (string | number)[];
}

function propertyOccurrences(
  frontmatter: Record<string, unknown> | undefined,
  aliases: readonly string[]
): Array<{ reference: string; property: readonly (string | number)[] }> {
  if (!frontmatter) return [];
  const normalized = new Set(aliases.map(normalizeBookPropertyName));
  for (const [property, raw] of Object.entries(frontmatter)) {
    if (!normalized.has(normalizeBookPropertyName(property))) continue;
    const values = Array.isArray(raw) ? raw : [raw];
    return values.flatMap((value, index) => typeof value === "string" && value.trim()
      ? [{ reference: value.trim(), property: Array.isArray(raw) ? [property, index] : [property] }]
      : []);
  }
  return [];
}

function resolveReference(app: App, source: TFile, reference: string): TFile | null {
  const parsed = parseWikilink(reference);
  const linkpath = parsed?.linkpath ?? reference.trim();
  if (!linkpath) return null;

  return app.metadataCache.getFirstLinkpathDest(linkpath, source.path);
}

function pathSegments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

function fallbackBookScore(chapter: TFile, candidate: TFile): number {
  const chapterSegments = pathSegments(chapter.path).slice(0, -1);
  const candidateParentSegments = pathSegments(candidate.parent?.path ?? "");
  let commonDepth = 0;

  while (
    commonDepth < chapterSegments.length
    && commonDepth < candidateParentSegments.length
    && chapterSegments[commonDepth] === candidateParentSegments[commonDepth]
  ) {
    commonDepth += 1;
  }

  const matchingAncestorIndex = chapterSegments
    .map((segment) => segment.toLowerCase())
    .lastIndexOf(candidate.basename.toLowerCase());

  if (matchingAncestorIndex >= 0) return 100 + matchingAncestorIndex;
  if (commonDepth > 0) return commonDepth;
  return -1;
}

export function resolveExplicitOwningBookWithSource(
  app: App,
  chapter: TFile
): ExplicitOwningBookResolution | null {
  if (isBookFrontmatter(frontmatterFor(app, chapter))) {
    const property = Object.keys(frontmatterFor(app, chapter) ?? {}).find((key) =>
      BOOK_TYPE_ALIASES.some((alias) => normalizeBookPropertyName(alias) === normalizeBookPropertyName(key))
    ) ?? BOOK_TYPE_ALIASES[0];
    return { book: chapter, source: chapter, property: [property] };
  }

  const queue: TFile[] = [chapter];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.path)) continue;
    visited.add(current.path);

    const frontmatter = frontmatterFor(app, current);
    const bookReferences = propertyOccurrences(frontmatter, BOOK_REFERENCE_ALIASES);
    const parentReferences = propertyOccurrences(frontmatter, MANUSCRIPT_PARENT_ALIASES);

    for (const occurrence of bookReferences) {
      const resolved = resolveReference(app, current, occurrence.reference);
      if (resolved) return { book: resolved, source: current, property: occurrence.property };
    }

    for (const occurrence of parentReferences) {
      const resolved = resolveReference(app, current, occurrence.reference);
      if (!resolved || visited.has(resolved.path)) continue;
      if (isBookFrontmatter(frontmatterFor(app, resolved))) {
        return { book: resolved, source: current, property: occurrence.property };
      }
      queue.push(resolved);
    }
  }

  return null;
}

export function resolveExplicitOwningBook(app: App, chapter: TFile): TFile | null {
  return resolveExplicitOwningBookWithSource(app, chapter)?.book ?? null;
}

export function resolveOwningBook(app: App, chapter: TFile): TFile | null {
  const explicit = resolveExplicitOwningBook(app, chapter);
  if (explicit) return explicit;

  let best: TFile | null = null;
  let bestScore = -1;

  for (const candidate of app.vault.getMarkdownFiles()) {
    if (!isBookFrontmatter(frontmatterFor(app, candidate))) continue;
    const score = fallbackBookScore(chapter, candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}
