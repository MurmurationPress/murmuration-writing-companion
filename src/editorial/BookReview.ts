import type { PageEditorialNotes } from "./EditorialNote";
import {
  EDITORIAL_PASS_LABELS,
  EDITORIAL_PASS_OPTIONS,
  EditorialPassKey,
  isEditorialPassKey
} from "./EditorialPass";

export const BOOK_REVIEW_STATUS_OPTIONS = [
  "not_started",
  "in_progress",
  "complete"
] as const;

export type BookReviewStatus = typeof BOOK_REVIEW_STATUS_OPTIONS[number];

export const BOOK_REVIEW_STATUS_LABELS: Readonly<Record<BookReviewStatus, string>> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete"
};

export const BOOK_REVIEW_MODE_OPTIONS = EDITORIAL_PASS_OPTIONS;
export const BOOK_REVIEW_MODE_LABELS = EDITORIAL_PASS_LABELS;

export const BOOK_REFERENCE_ALIASES = [
  "book",
  "manuscript_book",
  "owning_book",
  "parent_book"
] as const;

export const MANUSCRIPT_PARENT_ALIASES = [
  "parent",
  "part_of",
  "manuscript_parent",
  "up"
] as const;

export const BOOK_TYPE_ALIASES = [
  "manuscript_type",
  "document_type",
  "note_type",
  "type",
  "kind"
] as const;

export const BOOK_REVIEW_STATUS_ALIASES = [
  "review_status",
  "book_review_status",
  "editorial_review_status"
] as const;

export interface BookReviewStatusValue {
  property: string;
  value: string;
}

export interface BookReviewSelectOption {
  value: string;
  label: string;
  preserved?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeBookPropertyName(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stringValues(value: unknown): string[] {
  const rawValues = Array.isArray(value) ? value : [value];
  const result: string[] = [];

  for (const rawValue of rawValues) {
    const text = nonEmptyString(rawValue);
    if (text) result.push(text);
  }

  return result;
}

function findProperty(
  frontmatter: Record<string, unknown> | undefined,
  aliases: readonly string[]
): { property: string; value: unknown } | null {
  if (!frontmatter) return null;

  const normalizedAliases = new Set(aliases.map(normalizeBookPropertyName));

  for (const [property, value] of Object.entries(frontmatter)) {
    if (property === "position") continue;
    if (normalizedAliases.has(normalizeBookPropertyName(property))) {
      return { property, value };
    }
  }

  return null;
}

export function getBookHierarchyReferences(
  frontmatter: Record<string, unknown> | undefined
): { bookReferences: string[]; parentReferences: string[] } {
  return {
    bookReferences: stringValues(findProperty(frontmatter, BOOK_REFERENCE_ALIASES)?.value),
    parentReferences: stringValues(findProperty(frontmatter, MANUSCRIPT_PARENT_ALIASES)?.value)
  };
}

export function isBookFrontmatter(
  frontmatter: Record<string, unknown> | undefined
): boolean {
  const value = findProperty(frontmatter, BOOK_TYPE_ALIASES)?.value;
  const values = stringValues(value).map((item) => normalizeBookPropertyName(item));

  return values.some((item) => (
    item === "book"
    || item === "novel"
    || item === "manuscript_book"
  ));
}

export function getBookReviewMode(page: PageEditorialNotes): EditorialPassKey | null {
  return isEditorialPassKey(page.bookReviewMode) ? page.bookReviewMode : null;
}

export function setBookReviewMode(
  page: PageEditorialNotes,
  mode: EditorialPassKey | null
): boolean {
  const current = getBookReviewMode(page);
  const hadValue = Object.prototype.hasOwnProperty.call(page, "bookReviewMode");

  if (mode === current && (mode !== null || !hadValue)) return false;

  if (mode === null) {
    delete page.bookReviewMode;
  } else {
    page.bookReviewMode = mode;
  }

  return true;
}

export function getBookReviewStatusValue(
  frontmatter: Record<string, unknown> | undefined
): BookReviewStatusValue {
  const match = findProperty(frontmatter, BOOK_REVIEW_STATUS_ALIASES);

  return {
    property: match?.property ?? "review_status",
    value: nonEmptyString(match?.value) ?? ""
  };
}

export function getBookReviewStatusOptions(
  currentValue: string
): BookReviewSelectOption[] {
  const options: BookReviewSelectOption[] = [{ value: "", label: "—" }];
  const normalizedCurrent = currentValue.trim();
  const knownCurrent = (BOOK_REVIEW_STATUS_OPTIONS as readonly string[])
    .includes(normalizedCurrent);

  if (normalizedCurrent && !knownCurrent) {
    options.push({
      value: normalizedCurrent,
      label: `${normalizedCurrent} (current)`,
      preserved: true
    });
  }

  for (const value of BOOK_REVIEW_STATUS_OPTIONS) {
    options.push({ value, label: BOOK_REVIEW_STATUS_LABELS[value] });
  }

  return options;
}

export function updateBookReviewStatusFrontmatter(
  frontmatter: Record<string, unknown>,
  value: string
): string {
  const match = findProperty(frontmatter, BOOK_REVIEW_STATUS_ALIASES);
  const property = match?.property ?? "review_status";

  for (const existingProperty of Object.keys(frontmatter)) {
    if (existingProperty === property) continue;
    if (
      BOOK_REVIEW_STATUS_ALIASES.some(
        (alias) => normalizeBookPropertyName(alias)
          === normalizeBookPropertyName(existingProperty)
      )
    ) {
      delete frontmatter[existingProperty];
    }
  }

  const normalizedValue = value.trim();
  if (normalizedValue) {
    frontmatter[property] = normalizedValue;
  } else {
    delete frontmatter[property];
  }

  return property;
}

export function isBookReviewState(value: unknown): value is Record<string, unknown> {
  return isRecord(value);
}
