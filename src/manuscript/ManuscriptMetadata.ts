import {
  getBookHierarchyReferences,
  isBookFrontmatter
} from "../editorial/BookReview";
import {
  getChapterContextField,
  getEditableChapterContextValue,
  normalizePropertyName
} from "../companion/ChapterContext";
import type { ManuscriptEntryKind } from "./ManuscriptOrder";

export const MANUSCRIPT_TYPE_ALIASES = [
  "manuscript_type",
  "document_type",
  "note_type",
  "type",
  "kind"
] as const;

const PART_TYPE_VALUES = new Set([
  "part",
  "book_part",
  "manuscript_part",
  "section"
]);

const SCENE_TYPE_VALUES = new Set([
  "scene",
  "chapter",
  "book_chapter",
  "manuscript_scene",
  "manuscript_chapter"
]);

export interface ManuscriptSceneMetadata {
  readonly pov: string | null;
  readonly storyDate: string | null;
  readonly chapterStatus: string | null;
  readonly editorialPass: string | null;
}

export interface ManuscriptMetadataSource {
  readonly path: string;
  readonly basename: string;
  readonly frontmatter?: Record<string, unknown>;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function findProperty(
  frontmatter: Record<string, unknown> | undefined,
  aliases: readonly string[]
): unknown {
  if (!frontmatter) return undefined;
  const normalizedAliases = new Set(aliases.map(normalizePropertyName));

  for (const [property, value] of Object.entries(frontmatter)) {
    if (property === "position") continue;
    if (normalizedAliases.has(normalizePropertyName(property))) return value;
  }

  return undefined;
}

function normalizedValues(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values
    .map(nonEmptyString)
    .filter((item): item is string => item !== null)
    .map(normalizePropertyName);
}

export function explicitManuscriptKind(
  frontmatter: Record<string, unknown> | undefined
): ManuscriptEntryKind | null {
  if (isBookFrontmatter(frontmatter)) return "book";

  const values = normalizedValues(findProperty(frontmatter, MANUSCRIPT_TYPE_ALIASES));
  if (values.some((value) => PART_TYPE_VALUES.has(value))) return "part";
  if (values.some((value) => SCENE_TYPE_VALUES.has(value))) return "scene";
  return null;
}

export function hasSceneMetadataSignal(
  frontmatter: Record<string, unknown> | undefined
): boolean {
  if (!frontmatter) return false;

  const aliases = [
    ...getChapterContextField("pov").aliases,
    ...getChapterContextField("story_date").aliases,
    ...getChapterContextField("chapter_status").aliases,
    ...getChapterContextField("editorial_pass").aliases
  ];
  const normalizedAliases = new Set(aliases.map(normalizePropertyName));

  return Object.keys(frontmatter).some((property) => (
    property !== "position" && normalizedAliases.has(normalizePropertyName(property))
  ));
}

export function manuscriptDisplayTitle(source: ManuscriptMetadataSource): string {
  const title = getEditableChapterContextValue(
    source.frontmatter,
    getChapterContextField("title")
  ).value.trim();

  if (title) return title;
  return source.basename.replace(/^\s*\d+(?:[\s._-]+|$)/, "").trim() || source.basename;
}

export function manuscriptSceneMetadata(
  frontmatter: Record<string, unknown> | undefined
): ManuscriptSceneMetadata {
  const value = (key: "pov" | "story_date" | "chapter_status" | "editorial_pass") => {
    const text = getEditableChapterContextValue(
      frontmatter,
      getChapterContextField(key)
    ).value.trim();
    return text || null;
  };

  return {
    pov: value("pov"),
    storyDate: value("story_date"),
    chapterStatus: value("chapter_status"),
    editorialPass: value("editorial_pass")
  };
}

export function manuscriptHierarchyReferences(
  frontmatter: Record<string, unknown> | undefined
): { readonly bookReferences: readonly string[]; readonly parentReferences: readonly string[] } {
  return getBookHierarchyReferences(frontmatter);
}

export function formatNavigatorStoryDate(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value.trim();

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return value.trim();

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}
