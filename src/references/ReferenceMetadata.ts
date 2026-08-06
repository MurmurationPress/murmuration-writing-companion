export const REFERENCE_PROPERTY_NAMES = {
  authors: "reference_authors",
  title: "reference_title",
  date: "reference_date",
  publication: "reference_publication",
  publisher: "reference_publisher",
  volume: "reference_volume",
  issue: "reference_issue",
  pages: "reference_pages",
  doi: "reference_doi",
  link: "reference_link"
} as const;

export type ReferenceField = keyof typeof REFERENCE_PROPERTY_NAMES;

export interface ReferenceMetadata {
  readonly authors: readonly string[];
  readonly title: string | null;
  readonly date: string | null;
  readonly publication: string | null;
  readonly publisher: string | null;
  readonly volume: string | null;
  readonly issue: string | null;
  readonly pages: string | null;
  readonly doi: string | null;
  readonly link: string | null;
}

export const EMPTY_REFERENCE_METADATA: ReferenceMetadata = {
  authors: [], title: null, date: null, publication: null, publisher: null,
  volume: null, issue: null, pages: null, doi: null, link: null
};

const ALIASES: Record<ReferenceField, readonly string[]> = {
  authors: ["reference_authors", "authors", "author"],
  title: ["reference_title", "citation_title"],
  date: ["reference_date", "publication_date", "publication_year", "year"],
  publication: ["reference_publication", "journal", "publication"],
  publisher: ["reference_publisher", "publisher"],
  volume: ["reference_volume", "volume"],
  issue: ["reference_issue", "issue"],
  pages: ["reference_pages", "pages"],
  doi: ["reference_doi", "doi"],
  link: ["reference_link", "url", "link"]
};

function text(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function first(properties: Readonly<Record<string, unknown>>, field: ReferenceField): unknown {
  for (const name of ALIASES[field]) if (properties[name] != null) return properties[name];
  return null;
}

function authors(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  const output: string[] = [];
  for (const item of values) {
    const valueText = text(item);
    if (valueText && !output.includes(valueText)) output.push(valueText);
  }
  return output;
}

export function readReferenceMetadata(properties: Readonly<Record<string, unknown>>): ReferenceMetadata {
  return {
    authors: authors(first(properties, "authors")),
    title: text(first(properties, "title")),
    date: text(first(properties, "date")),
    publication: text(first(properties, "publication")),
    publisher: text(first(properties, "publisher")),
    volume: text(first(properties, "volume")),
    issue: text(first(properties, "issue")),
    pages: text(first(properties, "pages")),
    doi: text(first(properties, "doi")),
    link: text(first(properties, "link"))
  };
}

export function referenceFieldText(metadata: ReferenceMetadata, field: ReferenceField): string {
  return field === "authors" ? metadata.authors.join("; ") : metadata[field] ?? "";
}

export function referenceMetadataFromText(values: Readonly<Record<ReferenceField, string>>): ReferenceMetadata {
  const scalar = (field: Exclude<ReferenceField, "authors">): string | null => values[field].trim() || null;
  return {
    authors: values.authors.split(/\s*;\s*/).map((value) => value.trim()).filter(Boolean),
    title: scalar("title"), date: scalar("date"), publication: scalar("publication"),
    publisher: scalar("publisher"), volume: scalar("volume"), issue: scalar("issue"),
    pages: scalar("pages"), doi: scalar("doi"), link: scalar("link")
  };
}

export function hasReferenceMetadata(metadata: ReferenceMetadata): boolean {
  return metadata.authors.length > 0 || Object.entries(metadata).some(([key, value]) => key !== "authors" && value != null);
}
