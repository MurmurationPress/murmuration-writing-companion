import { parseWikilink } from "./StoryWorldIndex";

export interface WikilinkPresentation {
  readonly authored: string;
  readonly label: string;
  readonly linkpath: string | null;
  readonly wikilink: boolean;
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

export function isWikilinkActivationKey(key: string): boolean {
  return key === "Enter" || key === " ";
}
