import type { AnnotationAnchor } from "./EditorialNote";

/** Preserve the selected occurrence for strict external export without changing source text. */
export async function createAnnotationExportAnchor(source: string, from: number, to: number): Promise<AnnotationAnchor> {
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to > source.length || to <= from) throw new Error("Invalid annotation selection range.");
  const bodyStart = source.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/)?.[0].length || 0;
  if (from < bodyStart) throw new Error("Annotations in YAML metadata cannot be exported.");
  const raw = source.slice(from, to);
  const text = raw.trim();
  if (!text) throw new Error("Select text first.");
  const start = from + raw.indexOf(text);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source.slice(bodyStart)));
  const sourceSha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  return { text, line: source.slice(0, start).split("\n").length, range: { from: start - bodyStart, to: start + text.length - bodyStart, sourceSha256, basis: "markdown-body-v1" } };
}
