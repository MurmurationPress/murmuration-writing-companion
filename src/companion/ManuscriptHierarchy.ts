import { App, TFile } from "obsidian";
import {
  getBookHierarchyReferences,
  isBookFrontmatter
} from "../editorial/BookReview";
import { parseWikilink } from "../story-world/StoryWorldIndex";

function frontmatterFor(app: App, file: TFile): Record<string, unknown> | undefined {
  return app.metadataCache.getFileCache(file)?.frontmatter as
    Record<string, unknown> | undefined;
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

export function resolveOwningBook(app: App, chapter: TFile): TFile | null {
  if (isBookFrontmatter(frontmatterFor(app, chapter))) return chapter;

  const queue: TFile[] = [chapter];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.path)) continue;
    visited.add(current.path);

    const frontmatter = frontmatterFor(app, current);
    const { bookReferences, parentReferences } = getBookHierarchyReferences(frontmatter);

    for (const reference of bookReferences) {
      const resolved = resolveReference(app, current, reference);
      if (resolved) return resolved;
    }

    for (const reference of parentReferences) {
      const resolved = resolveReference(app, current, reference);
      if (!resolved || visited.has(resolved.path)) continue;
      if (isBookFrontmatter(frontmatterFor(app, resolved))) return resolved;
      queue.push(resolved);
    }
  }

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
