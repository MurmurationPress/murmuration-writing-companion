/** A conservative rendered-text projection with a source offset for every visible character.
 * Unsupported Markdown fails closed; the host-rendered section must also match in full.
 */
export interface TextProjection { text: string; starts: number[]; ends: number[] }
export function normalizeProjection(text: string, starts = Array.from({ length: text.length }, (_, i) => i), ends = starts.map(i => i + 1)): TextProjection {
  const result: TextProjection = { text: "", starts: [], ends: [] };
  for (let i = 0; i < text.length; i++) {
    const character = /\s/.test(text[i]) ? " " : text[i];
    if (character === " " && (!result.text || result.text.endsWith(" "))) {
      if (result.text) result.ends[result.ends.length - 1] = ends[i];
      continue;
    }
    result.text += character;
    result.starts.push(starts[i]); result.ends.push(ends[i]);
  }
  if (result.text.endsWith(" ")) { result.text = result.text.slice(0, -1); result.starts.pop(); result.ends.pop(); }
  return result;
}

export function projectReadingSource(source: string): TextProjection | null {
  // Embeds, HTML, code, math, tables, footnotes and callouts have non-prose renderers.
  if (/!\[|<|`|\$|\||\[\^|^\s*(?:---|~~~|>\s*\[!)/m.test(source)) return null;
  const hidden = new Set<number>();
  const hide = (from: number, to: number) => { for (let i = from; i < to; i++) hidden.add(i); };
  for (const match of source.matchAll(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-+*]\s+|\d+[.)]\s+)/gm)) hide(match.index!, match.index! + match[0].length);
  for (const match of source.matchAll(/\[\[([^\]\n]+)\]\]|\[([^\]\n]+)\]\(([^)\n]*)\)/g)) {
    const start = match.index!;
    if (match[1] !== undefined) {
      const pipe = match[1].lastIndexOf("|");
      // Piped wikilinks need a renderer-aware projection; reject rather than guess.
      if (pipe >= 0) return null;
      hide(start, start + 2); hide(start + match[0].length - 2, start + match[0].length);
    } else {
      hide(start, start + 1); hide(start + 1 + match[2].length, start + match[0].length);
    }
  }
  // Inline emphasis delimiters are only admitted when the full projection matches the DOM.
  for (const match of source.matchAll(/\*+|_+|~~|==|\\(?=[\\*_[\]{}()#+.!>~-])/g)) hide(match.index!, match.index! + match[0].length);
  let text = ""; const starts: number[] = [], ends: number[] = [];
  for (let i = 0; i < source.length; i++) if (!hidden.has(i)) { text += source[i]; starts.push(i); ends.push(i + 1); }
  return normalizeProjection(text, starts, ends);
}

/** The DOM boundary is a UTF-16 text offset within a host-identified source section. */
export function mapReadingBoundary(sourceSection: string, renderedSection: string, boundary: number, end: boolean): number | null {
  const source = projectReadingSource(sourceSection);
  const rendered = normalizeProjection(renderedSection);
  if (!source || source.text !== rendered.text || boundary < 0 || boundary > renderedSection.length) return null;
  if (end) {
    let index = rendered.ends.length - 1;
    while (index >= 0 && rendered.ends[index] > boundary) index--;
    return index < 0 ? null : source.ends[index];
  }
  const index = rendered.starts.findIndex(offset => offset >= boundary);
  return index < 0 ? null : source.starts[index];
}

export function markdownBody(source: string): string {
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "");
}
export function readingSelectionStillValid(captured: string, current: string): boolean {
  return markdownBody(captured) === markdownBody(current);
}

/** Keep the captured file identity, including renames; never consult the active scene. */
export async function validateReadingSelection<File extends { path: string }>(file: File, source: string,
  vault: { lookup(path: string): unknown; read(file: File): Promise<string> }): Promise<void> {
  const current = await vault.read(file);
  if (vault.lookup(file.path) !== file || !readingSelectionStillValid(source, current)) {
    throw new Error("The selected note has changed. Cancel and select the passage again; no annotation was saved.");
  }
}
