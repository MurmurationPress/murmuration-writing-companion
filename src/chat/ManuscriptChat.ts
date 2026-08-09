export type ManuscriptChatAlignment = "left" | "right" | "center";

export interface ManuscriptChatMessage {
  readonly type: "message";
  readonly header: string;
  readonly body: string;
  readonly subtext: string;
  readonly alignment: ManuscriptChatAlignment;
}

export interface ManuscriptChatDivider { readonly type: "divider"; }
export interface ManuscriptChatComment { readonly type: "comment"; readonly text: string; }
export interface ManuscriptChatMalformed { readonly type: "malformed"; readonly source: string; }
export type ManuscriptChatToken = ManuscriptChatMessage | ManuscriptChatDivider | ManuscriptChatComment | ManuscriptChatMalformed;

export interface ParsedManuscriptChat {
  readonly syntax: "v2" | "legacy" | "unrecognised";
  readonly tokens: readonly ManuscriptChatToken[];
  readonly alignments: Readonly<Record<string, ManuscriptChatAlignment>>;
  readonly source: string;
}

function isEscapedAt(text: string, index: number): boolean {
  let count = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) count += 1;
  return count % 2 === 1;
}

function unescapedPipes(text: string): number[] {
  const positions: number[] = [];
  for (let index = 0; index < text.length; index += 1) if (text[index] === "|" && !isEscapedAt(text, index)) positions.push(index);
  return positions;
}

function unescapePipes(text: string): string { return text.replace(/\\\|/g, "|"); }

function simpleName(text: string): string {
  return text
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/^>\s?/, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .trim();
}

function alignmentFor(header: string, alignments: Readonly<Record<string, ManuscriptChatAlignment>>): ManuscriptChatAlignment {
  return alignments[simpleName(header)] ?? alignments[header] ?? "left";
}

function parseMessage(raw: string, previousHeader: string): Omit<ManuscriptChatMessage, "type" | "alignment"> {
  const pipes = unescapedPipes(raw);
  let header = ""; let body = raw; let subtext = "";
  if (pipes.length >= 2) {
    header = raw.slice(0, pipes[0]);
    body = raw.slice(pipes[0] + 1, pipes[pipes.length - 1]);
    subtext = raw.slice(pipes[pipes.length - 1] + 1);
  } else if (pipes.length === 1) {
    header = raw.slice(0, pipes[0]); body = raw.slice(pipes[0] + 1);
  }
  header = unescapePipes(header).trim() || previousHeader;
  body = unescapePipes(body).replace(/^\s*\n/, "").replace(/\n\s*$/, "").trimEnd();
  subtext = unescapePipes(subtext).trim();
  return { header, body, subtext };
}

function findMessageEnd(text: string, start: number): number {
  for (let index = start + 2; index < text.length - 1; index += 1) {
    if (text[index] === "}" && text[index + 1] === "}" && !isEscapedAt(text, index)) return index;
  }
  return -1;
}

function controls(text: string, tokens: ManuscriptChatToken[], alignments: Record<string, ManuscriptChatAlignment>): void {
  const malformed: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const marker = line[0];
    if (marker === ">" || marker === "^") {
      const names = line.slice(1).split(",").map(simpleName).filter(Boolean);
      if (names.length) { for (const name of names) alignments[name] = marker === ">" ? "right" : "center"; continue; }
    }
    if (line === "...") { tokens.push({ type: "divider" }); continue; }
    if (line.startsWith("#")) {
      const comment = line.replace(/^#+\s*/, "").trim();
      if (comment) tokens.push({ type: "comment", text: comment });
      continue;
    }
    malformed.push(raw);
  }
  if (malformed.length) tokens.push({ type: "malformed", source: malformed.join("\n") });
}

function parseV2(source: string): ParsedManuscriptChat {
  const alignments: Record<string, ManuscriptChatAlignment> = {};
  const unresolved: Array<Omit<ManuscriptChatMessage, "type" | "alignment"> | ManuscriptChatDivider | ManuscriptChatComment | ManuscriptChatMalformed> = [];
  let previousHeader = ""; let index = 0;
  while (index < source.length) {
    const start = source.indexOf("{{", index);
    if (start < 0) { controls(source.slice(index), unresolved as ManuscriptChatToken[], alignments); break; }
    controls(source.slice(index, start), unresolved as ManuscriptChatToken[], alignments);
    const end = findMessageEnd(source, start);
    if (end < 0) { unresolved.push({ type: "malformed", source: source.slice(start) }); break; }
    const message = parseMessage(source.slice(start + 2, end), previousHeader);
    if (message.header) previousHeader = message.header;
    unresolved.push(message);
    index = end + 2;
  }
  const tokens = unresolved.map((token): ManuscriptChatToken => (
    "body" in token ? { type: "message", ...token, alignment: alignmentFor(token.header, alignments) } : token
  ));
  return { syntax: "v2", tokens, alignments, source };
}

function parseLegacy(source: string): ParsedManuscriptChat | null {
  const messages: Array<{ marker: "<" | ">" | "^"; header: string; lines: string[] }> = [];
  let current: typeof messages[number] | null = null;
  const flush = () => { if (current) messages.push(current); current = null; };
  for (const raw of source.split(/\r?\n/)) {
    const start = /^\s*([<>^])\s+\*\*([^*]+?):\*\*\s*(.*)$/.exec(raw);
    if (start) { flush(); current = { marker: start[1] as "<" | ">" | "^", header: start[2].trim(), lines: start[3] ? [start[3]] : [] }; continue; }
    if (!current) { if (raw.trim()) return null; continue; }
    const continuation = /^\s*([<>^])\s?(.*)$/.exec(raw);
    if (continuation?.[1] === current.marker) current.lines.push(continuation[2]);
    else if (!raw.trim()) current.lines.push("");
    else current.lines.push(raw.trim());
  }
  flush();
  if (!messages.length) return null;
  const alignments: Record<string, ManuscriptChatAlignment> = {};
  const tokens = messages.map((message): ManuscriptChatMessage => {
    const alignment = message.marker === ">" ? "right" : message.marker === "^" ? "center" : "left";
    alignments[message.header] = alignment;
    return { type: "message", header: message.header, body: message.lines.join("\n").trim(), subtext: "", alignment };
  });
  return { syntax: "legacy", tokens, alignments, source };
}

export function parseManuscriptChat(source: string): ParsedManuscriptChat {
  if (source.includes("{{")) return parseV2(source);
  return parseLegacy(source) ?? { syntax: "unrecognised", tokens: [], alignments: {}, source };
}
