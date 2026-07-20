import { parseWikilink } from "../story-world/StoryWorldIndex";

export interface ProseWikilinkOccurrence {
  readonly raw: string;
  readonly linkpath: string;
  readonly displayText: string | null;
  readonly start: number;
  readonly end: number;
}

function maskRange(mask: boolean[], start: number, end: number): void {
  for (let index = Math.max(0, start); index < Math.min(mask.length, end); index += 1) {
    mask[index] = true;
  }
}

function lineBoundaries(text: string): Array<{ start: number; end: number; value: string }> {
  const lines: Array<{ start: number; end: number; value: string }> = [];
  let start = 0;
  while (start < text.length) {
    const newline = text.indexOf("\n", start);
    const end = newline < 0 ? text.length : newline + 1;
    lines.push({
      start,
      end,
      value: text.slice(start, end).replace(/[\r\n]+$/, "")
    });
    start = end;
  }
  return lines;
}

function maskFrontmatter(text: string, mask: boolean[]): void {
  const lines = lineBoundaries(text);
  if (lines.length === 0) return;
  if (lines[0].value.replace(/^\uFEFF/, "").trim() !== "---") return;

  for (let index = 1; index < lines.length; index += 1) {
    const value = lines[index].value.trim();
    if (value === "---" || value === "...") {
      maskRange(mask, 0, lines[index].end);
      return;
    }
  }
  maskRange(mask, 0, text.length);
}

function maskFencedCode(text: string, mask: boolean[]): void {
  const lines = lineBoundaries(text);
  let open: { start: number; marker: string; length: number } | null = null;

  for (const line of lines) {
    const match = /^ {0,3}(`{3,}|~{3,})/.exec(line.value);
    if (!open) {
      if (match) open = { start: line.start, marker: match[1][0], length: match[1].length };
      continue;
    }

    const escapedMarker = open.marker === "`" ? "`" : "~";
    const close = new RegExp(`^ {0,3}${escapedMarker}{${open.length},}\\s*$`);
    if (close.test(line.value)) {
      maskRange(mask, open.start, line.end);
      open = null;
    }
  }

  if (open) maskRange(mask, open.start, text.length);
}

function maskDelimited(
  text: string,
  mask: boolean[],
  opening: string,
  closing: string
): void {
  let cursor = 0;
  while (cursor < text.length) {
    const start = text.indexOf(opening, cursor);
    if (start < 0) return;
    const close = text.indexOf(closing, start + opening.length);
    const end = close < 0 ? text.length : close + closing.length;
    maskRange(mask, start, end);
    cursor = Math.max(start + 1, end);
  }
}

function maskInlineCode(text: string, mask: boolean[]): void {
  let cursor = 0;
  while (cursor < text.length) {
    if (mask[cursor] || text[cursor] !== "`") {
      cursor += 1;
      continue;
    }

    let length = 1;
    while (text[cursor + length] === "`") length += 1;
    const marker = "`".repeat(length);
    const close = text.indexOf(marker, cursor + length);
    if (close < 0) {
      cursor += length;
      continue;
    }
    maskRange(mask, cursor, close + length);
    cursor = close + length;
  }
}

function exclusionMask(text: string): boolean[] {
  const mask = new Array<boolean>(text.length).fill(false);
  maskFrontmatter(text, mask);
  maskFencedCode(text, mask);
  maskDelimited(text, mask, "<" + "!--", "--" + ">");
  maskDelimited(text, mask, "%" + "%", "%" + "%");
  maskInlineCode(text, mask);
  return mask;
}

function isEscaped(text: string, offset: number): boolean {
  let count = 0;
  for (let index = offset - 1; index >= 0 && text[index] === "\\"; index -= 1) count += 1;
  return count % 2 === 1;
}

export function findProseWikilinks(text: string): ProseWikilinkOccurrence[] {
  const mask = exclusionMask(text);
  const result: ProseWikilinkOccurrence[] = [];
  const pattern = /\[\[[^\]\n]+\]\]/g;

  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const start = match.index;
    const end = start + match[0].length;
    if (start > 0 && text[start - 1] === "!") continue;
    if (isEscaped(text, start)) continue;
    if (mask.slice(start, end).some(Boolean)) continue;

    const parsed = parseWikilink(match[0]);
    if (!parsed) continue;
    result.push({
      raw: match[0],
      linkpath: parsed.linkpath,
      displayText: parsed.displayText,
      start,
      end
    });
  }

  return result;
}

function changedRange(previous: string, current: string): { start: number; end: number } | null {
  if (previous === current) return null;
  let prefix = 0;
  while (
    prefix < previous.length
    && prefix < current.length
    && previous[prefix] === current[prefix]
  ) prefix += 1;

  let suffix = 0;
  while (
    suffix < previous.length - prefix
    && suffix < current.length - prefix
    && previous[previous.length - suffix - 1] === current[current.length - suffix - 1]
  ) suffix += 1;

  return { start: prefix, end: current.length - suffix };
}

export function selectChangedProseWikilink(
  previous: string,
  current: string,
  cursorOffset: number
): ProseWikilinkOccurrence | null {
  const change = changedRange(previous, current);
  if (!change) return null;
  const changeEnd = Math.max(change.end, change.start + 1);

  return findProseWikilinks(current)
    .filter((link) => link.start < changeEnd && link.end > change.start)
    .filter((link) => cursorOffset >= link.start && cursorOffset <= link.end + 1)
    .sort((left, right) => right.start - left.start)[0] ?? null;
}

export class ProseWikilinkChangeTracker {
  private readonly snapshots = new Map<string, string>();

  seed(path: string, text: string): void {
    this.snapshots.set(path, text);
  }

  update(path: string, text: string, cursorOffset: number): ProseWikilinkOccurrence | null {
    const previous = this.snapshots.get(path);
    this.snapshots.set(path, text);
    return previous === undefined
      ? null
      : selectChangedProseWikilink(previous, text, cursorOffset);
  }

  clear(path: string): void {
    this.snapshots.delete(path);
  }

  rename(oldPath: string, newPath: string): void {
    const snapshot = this.snapshots.get(oldPath);
    this.snapshots.delete(oldPath);
    if (snapshot !== undefined) this.snapshots.set(newPath, snapshot);
  }
}
