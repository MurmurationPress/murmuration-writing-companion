export const REFERENCE_PROPERTIES = [
  "reference_authors", "reference_title", "reference_journal", "reference_container", "reference_publisher",
  "reference_date", "reference_volume", "reference_issue", "reference_pages", "reference_doi",
  "reference_isbn", "link", "reference_accessed", "reference_key", "reference_category"
] as const;

export type ReferenceProperty = typeof REFERENCE_PROPERTIES[number];

export interface StoryWorldReferenceProjection {
  readonly authors: readonly string[];
  readonly title: string | null;
  readonly journal: string | null;
  readonly container: string | null;
  readonly publisher: string | null;
  readonly date: string | null;
  readonly volume: string | null;
  readonly issue: string | null;
  readonly pages: string | null;
  readonly doi: string | null;
  readonly isbn: string | null;
  readonly link: string | null;
  readonly legacyUrl: string | null;
  readonly accessed: string | null;
  readonly key: string | null;
  readonly category: string | null;
}

/** Scalar values are never inferred or coerced. YAML numbers are displayed faithfully as text. */
export function referenceScalar(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/** Authors have one canonical shape: an ordered YAML list of non-empty strings. */
export function referenceAuthors(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => typeof item === "string" ? item.trim() : "")
    .filter(Boolean);
}

const referenceString = (value: unknown): string | null => typeof value === "string" ? value.trim() || null : null;

export function projectStoryWorldReference(properties: Readonly<Record<string, unknown>>): StoryWorldReferenceProjection {
  return {
    authors: referenceAuthors(properties.reference_authors),
    title: referenceString(properties.reference_title),
    journal: referenceString(properties.reference_journal),
    container: referenceString(properties.reference_container),
    publisher: referenceString(properties.reference_publisher),
    date: referenceScalar(properties.reference_date),
    volume: referenceScalar(properties.reference_volume),
    issue: referenceScalar(properties.reference_issue),
    pages: referenceScalar(properties.reference_pages),
    doi: referenceString(properties.reference_doi),
    isbn: referenceString(properties.reference_isbn),
    link: referenceString(properties.link) ?? referenceString(properties.reference_url),
    legacyUrl: referenceString(properties.reference_url),
    accessed: referenceString(properties.reference_accessed),
    key: referenceString(properties.reference_key),
    category: referenceString(properties.reference_category)
  };
}

export function referenceNavigatorDetail(properties: Readonly<Record<string, unknown>>): string | null {
  const reference = projectStoryWorldReference(properties);
  const firstAuthor = reference.authors[0]?.split(",", 1)[0]?.trim() || null;
  return [firstAuthor, reference.date].filter(Boolean).join(" · ") || null;
}

export function safeReferenceExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}
