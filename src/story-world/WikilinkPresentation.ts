import { parseWikilink } from "./StoryWorldIndex";

export interface WikilinkPresentation {
  readonly authored: string;
  readonly label: string;
  readonly linkpath: string | null;
  readonly wikilink: boolean;
}

export interface ReferenceCandidate {
  readonly storedValue: string;
  readonly path: string;
  readonly name: string;
  readonly aliases?: readonly string[];
}

export interface ReferencePresentation {
  readonly storedValue: string;
  readonly resolvedPath: string;
  readonly label: string;
  readonly secondary: string | null;
  readonly searchTerms: readonly string[];
}

/** Shared storage-to-label contract for scalar and list-valued metadata. */
export function presentWikilinkValue(value: unknown): WikilinkPresentation | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const authored = value.trim();
  const parsed = parseWikilink(authored);
  if (!parsed) return { authored, label: authored, linkpath: null, wikilink: false };
  const targetLabel = parsed.linkpath.split("/").pop() ?? parsed.linkpath;
  return { authored, label: parsed.displayText ?? targetLabel, linkpath: parsed.linkpath, wikilink: true };
}

export function presentWikilinkValues(value: unknown): WikilinkPresentation[] {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return values.map(presentWikilinkValue).filter((item): item is WikilinkPresentation => item !== null);
}

export function canonicalWikilink(path: string, label?: string | null): string {
  const target = path.trim().replace(/\.md$/i, "");
  if (!target) throw new Error("A wikilink target is required.");
  return label?.trim() ? `[[${target}|${label.trim()}]]` : `[[${target}]]`;
}

function parentContext(path: string): string | null {
  const parts = path.replace(/\\/g, "/").replace(/\.md$/i, "").split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") : null;
}

/** Builds author-facing choices without changing the canonical value used as identity. */
export function presentReferenceCandidates(candidates: readonly ReferenceCandidate[]): ReferencePresentation[] {
  const labelCounts = new Map<string, number>();
  for (const candidate of candidates) {
    const key = candidate.name.trim().toLocaleLowerCase();
    labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1);
  }
  return candidates.map((candidate) => {
    const label = candidate.name.trim() || candidate.path.replace(/\.md$/i, "").split("/").pop() || candidate.path;
    const duplicate = (labelCounts.get(label.toLocaleLowerCase()) ?? 0) > 1;
    return {
      storedValue: candidate.storedValue,
      resolvedPath: candidate.path,
      label,
      secondary: duplicate ? parentContext(candidate.path) : null,
      searchTerms: [label, ...(candidate.aliases ?? []), candidate.path]
    };
  });
}

export function isWikilinkActivationKey(key: string): boolean {
  return key === "Enter" || key === " ";
}
