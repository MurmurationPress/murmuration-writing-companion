import { isBookFrontmatter } from "../editorial/BookReview";
import { manuscriptDisplayTitle } from "../manuscript/ManuscriptMetadata";
import { isTemplateManuscriptPath } from "../manuscript/LegacyManuscriptHierarchy";
import { canonicalWikilink, presentReferenceCandidates, ReferencePresentation } from "./WikilinkPresentation";
import { parseWikilink } from "./StoryWorldIndex";

export interface ScopeCandidateDocument {
  readonly path: string;
  readonly basename: string;
  readonly frontmatter?: Record<string, unknown> | null;
}

export type ScopeReferenceResolver = (linkpath: string, sourcePath: string) => string | null;

function strings(value: unknown): string[] {
  return (Array.isArray(value) ? value : [value])
    .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    .map((item) => item.trim());
}

function aliases(frontmatter: Record<string, unknown> | null | undefined): string[] {
  return strings(frontmatter?.aliases);
}

function semanticName(document: ScopeCandidateDocument): string {
  return typeof document.frontmatter?.world_name === "string" && document.frontmatter.world_name.trim()
    ? document.frontmatter.world_name.trim()
    : manuscriptDisplayTitle({ ...document, frontmatter: document.frontmatter ?? undefined });
}

/**
 * Scope authority is the manuscript schema: recognised Books plus the notes
 * referenced by a recognised Book's existing series/trilogy fields.
 */
export function buildStoryWorldScopeCandidates(
  documents: readonly ScopeCandidateDocument[],
  resolve: ScopeReferenceResolver
): ReferencePresentation[] {
  const byPath = new Map(documents.map((document) => [document.path, document]));
  const books = documents.filter((document) => isBookFrontmatter(document.frontmatter ?? undefined) && !isTemplateManuscriptPath(document.path));
  const validPaths = new Set(books.map((book) => book.path));
  for (const book of books) {
    for (const property of ["series", "trilogy"] as const) {
      for (const reference of strings(book.frontmatter?.[property])) {
        const parsed = parseWikilink(reference);
        const path = resolve(parsed?.linkpath ?? reference, book.path);
        if (path && byPath.has(path) && !isTemplateManuscriptPath(path)) validPaths.add(path);
      }
    }
  }
  return presentReferenceCandidates([...validPaths]
    .map((path) => byPath.get(path)!)
    .map((document) => ({
      storedValue: canonicalWikilink(document.path),
      path: document.path,
      name: semanticName(document),
      aliases: aliases(document.frontmatter)
    })))
    .sort((left, right) => left.label.localeCompare(right.label, "en", { numeric: true, sensitivity: "base" }));
}
