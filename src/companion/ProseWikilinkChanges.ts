import { parseWikilink } from "../story-world/StoryWorldIndex";

export interface ProseWikilinkOccurrence {
  readonly raw: string;
  readonly linkpath: string;
  readonly displayText: string | null;
  readonly start: number;
  readonly end: number;
}

export interface ProseWikilinkEditor {
  getLine(line: number): string;
  lineCount(): number;
  posToOffset(position: { line: number; ch: number }): number;
}

export interface ProseWikilinkCursor {
  readonly line: number;
  readonly ch: number;
}

interface ProseLexicalState {
  readonly frontmatter: boolean;
  readonly fenceMarker: "`" | "~" | null;
  readonly fenceLength: number;
  readonly htmlComment: boolean;
  readonly obsidianComment: boolean;
}

const INITIAL_LEXICAL_STATE: ProseLexicalState = {
  frontmatter: false,
  fenceMarker: null,
  fenceLength: 0,
  htmlComment: false,
  obsidianComment: false
};

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

function sameLexicalState(left: ProseLexicalState, right: ProseLexicalState): boolean {
  return left.frontmatter === right.frontmatter
    && left.fenceMarker === right.fenceMarker
    && left.fenceLength === right.fenceLength
    && left.htmlComment === right.htmlComment
    && left.obsidianComment === right.obsidianComment;
}

function advanceDelimitedState(line: string, opening: string, closing: string, initiallyOpen: boolean): boolean {
  let open = initiallyOpen;
  let cursor = 0;
  while (cursor < line.length) {
    const marker = open ? closing : opening;
    const found = line.indexOf(marker, cursor);
    if (found < 0) break;
    open = !open;
    cursor = found + marker.length;
  }
  return open;
}

function advanceLexicalState(state: ProseLexicalState, line: string, lineNumber: number): ProseLexicalState {
  let frontmatter = state.frontmatter;
  if (lineNumber === 0 && line.replace(/^\uFEFF/, "").trim() === "---") frontmatter = true;
  else if (frontmatter && (line.trim() === "---" || line.trim() === "...")) {
    frontmatter = false;
  }

  let fenceMarker = state.fenceMarker;
  let fenceLength = state.fenceLength;
  if (!frontmatter) {
    const fence = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (!fenceMarker && fence) {
      fenceMarker = fence[1][0] as "`" | "~";
      fenceLength = fence[1].length;
    } else if (fenceMarker && new RegExp(`^ {0,3}${fenceMarker}{${fenceLength},}\\s*$`).test(line)) {
      fenceMarker = null;
      fenceLength = 0;
    }
  }

  return {
    frontmatter,
    fenceMarker,
    fenceLength,
    htmlComment: advanceDelimitedState(line, "<!--", "-->", state.htmlComment),
    obsidianComment: advanceDelimitedState(line, "%%", "%%", state.obsidianComment)
  };
}

function maskDelimitedOnLine(line: string, mask: boolean[], opening: string, closing: string, initiallyOpen: boolean): void {
  let open = initiallyOpen;
  let cursor = 0;
  while (cursor < line.length) {
    if (open) {
      const close = line.indexOf(closing, cursor);
      const end = close < 0 ? line.length : close + closing.length;
      maskRange(mask, cursor, end);
      if (close < 0) return;
      open = false;
      cursor = end;
    } else {
      const start = line.indexOf(opening, cursor);
      if (start < 0) return;
      const close = line.indexOf(closing, start + opening.length);
      const end = close < 0 ? line.length : close + closing.length;
      maskRange(mask, start, end);
      if (close < 0) return;
      cursor = end;
    }
  }
}

function findProseWikilinksOnLine(line: string, state: ProseLexicalState): ProseWikilinkOccurrence[] {
  if (
    state.frontmatter
    || state.fenceMarker
    || /^\uFEFF?---\s*$/.test(line)
    || /^ {0,3}(`{3,}|~{3,})/.test(line)
  ) return [];
  const mask = new Array<boolean>(line.length).fill(false);
  maskDelimitedOnLine(line, mask, "<!--", "-->", state.htmlComment);
  maskDelimitedOnLine(line, mask, "%%", "%%", state.obsidianComment);
  maskInlineCode(line, mask);
  const result: ProseWikilinkOccurrence[] = [];
  const pattern = /\[\[[^\]\n]+\]\]/g;
  for (let match = pattern.exec(line); match; match = pattern.exec(line)) {
    const start = match.index;
    const end = start + match[0].length;
    if (start > 0 && line[start - 1] === "!") continue;
    if (isEscaped(line, start)) continue;
    let excluded = false;
    for (let index = start; index < end; index += 1) if (mask[index]) { excluded = true; break; }
    if (excluded) continue;
    const parsed = parseWikilink(match[0]);
    if (parsed) result.push({ raw: match[0], linkpath: parsed.linkpath, displayText: parsed.displayText, start, end });
  }
  return result;
}

/**
 * Tracks editor lines and Markdown lexical state so an ordinary editor change
 * compares and parses only the cursor line. Full-document reconciliation is a
 * separate settled-path concern.
 */
export class ProseWikilinkEditorChangeTracker {
  private readonly linesByPath = new Map<string, string[]>();
  private readonly statesByPath = new Map<string, ProseLexicalState[]>();

  seed(path: string, text: string): void {
    const lines = text.split(/\r?\n/);
    this.linesByPath.set(path, lines);
    this.statesByPath.set(path, this.buildStates(lines));
  }

  update(path: string, editor: ProseWikilinkEditor, cursor: ProseWikilinkCursor): ProseWikilinkOccurrence | null {
    let lines = this.linesByPath.get(path);
    let states = this.statesByPath.get(path);
    if (!lines || !states) {
      this.seedFromEditor(path, editor);
      return null;
    }

    const lineNumber = Math.max(0, Math.min(cursor.line, editor.lineCount() - 1));
    if (editor.lineCount() !== lines.length) {
      this.seedFromEditor(path, editor);
      return this.changedLink(path, lines[lineNumber] ?? "", editor.getLine(lineNumber), lineNumber, cursor.ch, editor);
    }

    const previous = lines[lineNumber];
    const current = editor.getLine(lineNumber);
    if (previous === current) return null;
    const state = states[lineNumber] ?? INITIAL_LEXICAL_STATE;
    lines[lineNumber] = current;
    this.propagateStates(lines, states, lineNumber);
    return this.selectLineChange(previous, current, state, lineNumber, cursor.ch, editor);
  }

  clear(path: string): void {
    this.linesByPath.delete(path);
    this.statesByPath.delete(path);
  }

  rename(oldPath: string, newPath: string): void {
    const lines = this.linesByPath.get(oldPath);
    const states = this.statesByPath.get(oldPath);
    this.clear(oldPath);
    if (lines && states) {
      this.linesByPath.set(newPath, lines);
      this.statesByPath.set(newPath, states);
    }
  }

  private changedLink(path: string, previous: string, current: string, line: number, ch: number, editor: ProseWikilinkEditor): ProseWikilinkOccurrence | null {
    const states = this.statesByPath.get(path);
    return this.selectLineChange(previous, current, states?.[line] ?? INITIAL_LEXICAL_STATE, line, ch, editor);
  }

  private selectLineChange(previous: string, current: string, state: ProseLexicalState, line: number, ch: number, editor: ProseWikilinkEditor): ProseWikilinkOccurrence | null {
    const change = changedRange(previous, current);
    if (!change) return null;
    const changeEnd = Math.max(change.end, change.start + 1);
    const link = findProseWikilinksOnLine(current, state)
      .filter((candidate) => candidate.start < changeEnd && candidate.end > change.start)
      .filter((candidate) => ch >= candidate.start && ch <= candidate.end + 1)
      .sort((left, right) => right.start - left.start)[0];
    if (!link) return null;
    return {
      ...link,
      start: editor.posToOffset({ line, ch: link.start }),
      end: editor.posToOffset({ line, ch: link.end })
    };
  }

  private seedFromEditor(path: string, editor: ProseWikilinkEditor): void {
    const lines = Array.from({ length: editor.lineCount() }, (_, line) => editor.getLine(line));
    this.linesByPath.set(path, lines);
    this.statesByPath.set(path, this.buildStates(lines));
  }

  private buildStates(lines: readonly string[]): ProseLexicalState[] {
    const states: ProseLexicalState[] = [];
    let state = INITIAL_LEXICAL_STATE;
    for (let line = 0; line < lines.length; line += 1) {
      states.push(state);
      state = advanceLexicalState(state, lines[line], line);
    }
    return states;
  }

  private propagateStates(lines: readonly string[], states: ProseLexicalState[], changedLine: number): void {
    let state = advanceLexicalState(states[changedLine] ?? INITIAL_LEXICAL_STATE, lines[changedLine], changedLine);
    for (let line = changedLine + 1; line < lines.length; line += 1) {
      if (sameLexicalState(states[line], state)) break;
      states[line] = state;
      state = advanceLexicalState(state, lines[line], line);
    }
  }
}
