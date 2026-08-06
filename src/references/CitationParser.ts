import { EMPTY_REFERENCE_METADATA, ReferenceField, ReferenceMetadata, referenceFieldText } from "./ReferenceMetadata";

export interface CitationParseResult {
  readonly input: string;
  readonly metadata: ReferenceMetadata;
  readonly recognisedFields: readonly ReferenceField[];
  readonly warnings: readonly string[];
  readonly unparsed: readonly string[];
}

export type ReferenceConflictChoice = "keep" | "parsed" | "manual";

export interface ReferenceImportConflict {
  readonly field: ReferenceField;
  readonly existing: string;
  readonly parsed: string;
}

export const DOI_PATTERN = /10\.\d{4,9}\/[-._;()/:a-z0-9]+/i;

function stripTrailingDoiPunctuation(value: string): string {
  let output = value.replace(/[.,;:]+$/g, "");
  while (output.endsWith(")") && (output.match(/\(/g)?.length ?? 0) < (output.match(/\)/g)?.length ?? 0)) output = output.slice(0, -1);
  while (output.endsWith("]") && (output.match(/\[/g)?.length ?? 0) < (output.match(/\]/g)?.length ?? 0)) output = output.slice(0, -1);
  return output;
}

export function normalizeDoi(input: string): { doi: string; link: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) && !/^https?:\/\/(?:dx\.)?doi\.org\//i.test(trimmed)) return null;
  const withoutPrefix = trimmed
    .replace(/^doi\s*:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
  const match = withoutPrefix.match(DOI_PATTERN) ?? trimmed.match(DOI_PATTERN);
  if (!match) return null;
  const doi = stripTrailingDoiPunctuation(match[0]);
  if (!/^10\.\d{4,9}\/[!-~]+$/i.test(doi) || /\s/.test(doi)) return null;
  const canonical = doi.toLowerCase();
  return { doi: canonical, link: `https://doi.org/${canonical}` };
}

function splitAuthors(value: string): string[] {
  const normalized = value.trim().replace(/\s+and\s+/gi, " & ");
  if (!normalized) return [];
  const semicolon = normalized.split(/\s*;\s*/).filter(Boolean);
  if (semicolon.length > 1) return semicolon;
  const ampersand = normalized.split(/\s*,?\s*&\s*/).filter(Boolean);
  if (ampersand.length > 1) return ampersand;
  return [normalized];
}

function segments(value: string): string[] {
  const protectedAbbreviations = value.replace(/\b(pp?|vol|no)\.\s+(?=[A-Z0-9])/gi, (_match, abbreviation: string) => `${abbreviation}\u0000`);
  return protectedAbbreviations.replace(/([.!?])\s+(?=[A-Z0-9])/g, "$1\u0001").split("\u0001")
    .map((item) => item.replace(/\u0000/g, ". ").trim().replace(/\.$/, ""))
    .filter(Boolean);
}

function parsePublication(value: string): Pick<ReferenceMetadata, "publication" | "volume" | "issue" | "pages"> & { remainder: string[] } {
  const parts = value.split(/,\s*/).map((part) => part.trim()).filter(Boolean);
  const publication = parts.shift() ?? null;
  let volume: string | null = null;
  let issue: string | null = null;
  let pages: string | null = null;
  const remainder: string[] = [];
  for (const part of parts) {
    const volumeIssue = part.match(/^([^()]+?)\s*\(([^)]+)\)$/);
    if (volumeIssue && !volume && !issue) { volume = volumeIssue[1].trim(); issue = volumeIssue[2].trim(); continue; }
    if (/^(?:pp?\.\s*)?[a-z0-9]+(?:\s*[-–—]\s*[a-z0-9]+)$/i.test(part) && !pages) { pages = part.replace(/^pp?\.\s*/i, ""); continue; }
    if (/^[a-z0-9]+$/i.test(part) && !volume) { volume = part; continue; }
    remainder.push(part);
  }
  return { publication, volume, issue, pages, remainder };
}

export function parseCitation(input: string): CitationParseResult {
  const original = input;
  const trimmed = input.trim();
  const warnings: string[] = [];
  const unparsed: string[] = [];
  if (!trimmed) return { input: original, metadata: EMPTY_REFERENCE_METADATA, recognisedFields: [], warnings: ["No citation was provided."], unparsed: [] };

  const doi = normalizeDoi(trimmed);
  let remaining = trimmed;
  if (doi) remaining = remaining.replace(new RegExp(`(?:doi\\s*:\\s*|https?:\\/\\/(?:dx\\.)?doi\\.org\\/)?${doi.doi.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[.,;:]?`, "i"), "").trim();
  remaining = remaining.replace(/[.\s]+$/, "").trim();

  let authors: readonly string[] = [];
  let date: string | null = null;
  let title: string | null = null;
  let publication: string | null = null;
  let publisher: string | null = null;
  let volume: string | null = null;
  let issue: string | null = null;
  let pages: string | null = null;

  if (remaining) {
    const dated = remaining.match(/^(.*?)\s*\((\d{4}(?:[-/]\d{1,2}(?:[-/]\d{1,2})?)?|n\.d\.)\)\.\s*(.*)$/i);
    if (dated) {
      authors = splitAuthors(dated[1]);
      date = dated[2];
      const parts = segments(dated[3]);
      title = parts.shift() ?? null;
      if (parts.length) {
        const parsedPublication = parsePublication(parts.shift() ?? "");
        publication = parsedPublication.publication;
        volume = parsedPublication.volume;
        issue = parsedPublication.issue;
        pages = parsedPublication.pages;
        unparsed.push(...parsedPublication.remainder, ...parts);
      }
    } else {
      const parts = segments(remaining);
      if (parts.length >= 3) {
        authors = splitAuthors(parts.shift() ?? "");
        title = parts.shift() ?? null;
        const parsedPublication = parsePublication(parts.shift() ?? "");
        publication = parsedPublication.publication;
        volume = parsedPublication.volume;
        issue = parsedPublication.issue;
        pages = parsedPublication.pages;
        unparsed.push(...parsedPublication.remainder, ...parts);
        warnings.push("No publication year or date was recognised.");
      } else if (!doi || remaining.toLowerCase() !== doi.doi) {
        unparsed.push(remaining);
        warnings.push("The formatted citation could not be classified safely.");
      }
    }
  }

  const metadata: ReferenceMetadata = {
    authors, title, date, publication, publisher, volume, issue, pages,
    doi: doi?.doi ?? null, link: doi?.link ?? null
  };
  const recognisedFields = (Object.keys(metadata) as ReferenceField[]).filter((field) => referenceFieldText(metadata, field) !== "");
  if (!recognisedFields.length && !warnings.length) warnings.push("No supported citation fields were recognised.");
  return { input: original, metadata, recognisedFields, warnings, unparsed };
}

export function referenceImportConflicts(existing: ReferenceMetadata, parsed: ReferenceMetadata): ReferenceImportConflict[] {
  const fields = Object.keys(EMPTY_REFERENCE_METADATA) as ReferenceField[];
  return fields.flatMap((field) => {
    const oldValue = referenceFieldText(existing, field);
    const newValue = referenceFieldText(parsed, field);
    return oldValue && newValue && oldValue !== newValue ? [{ field, existing: oldValue, parsed: newValue }] : [];
  });
}

export function applyReferenceImport(
  existing: ReferenceMetadata,
  parsed: ReferenceMetadata,
  choices: Partial<Record<ReferenceField, ReferenceConflictChoice>> = {},
  manual: Partial<Record<ReferenceField, string>> = {}
): ReferenceMetadata {
  const fields = Object.keys(EMPTY_REFERENCE_METADATA) as ReferenceField[];
  const values = {} as Record<ReferenceField, string>;
  for (const field of fields) {
    const oldValue = referenceFieldText(existing, field);
    const newValue = referenceFieldText(parsed, field);
    if (!oldValue || !newValue || oldValue === newValue) values[field] = oldValue || newValue;
    else if (choices[field] === "keep") values[field] = oldValue;
    else if (choices[field] === "parsed") values[field] = newValue;
    else if (choices[field] === "manual") values[field] = manual[field]?.trim() ?? "";
    else throw new Error(`Choose how to resolve the ${field} conflict.`);
  }
  return {
    authors: values.authors.split(/\s*;\s*/).filter(Boolean), title: values.title || null,
    date: values.date || null, publication: values.publication || null, publisher: values.publisher || null,
    volume: values.volume || null, issue: values.issue || null, pages: values.pages || null,
    doi: values.doi || null, link: values.link || null
  };
}
