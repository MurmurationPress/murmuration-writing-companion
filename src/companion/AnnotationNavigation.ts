import { AnnotationAnchor } from "../editorial/EditorialNote";

export interface AnnotationTextRange {
  fromOffset: number;
  toOffset: number;
  exact: boolean;
}

/**
 * Resolve an annotation anchor against the chapter's current text.
 *
 * Exact text matches are preferred. When the extract occurs more than once,
 * the occurrence nearest the stored line is selected. If the extract no
 * longer exists, navigation falls back to the stored line.
 */
export function resolveAnnotationRange(
  content: string,
  anchor: AnnotationAnchor
): AnnotationTextRange | null {
  const exactMatch = findClosestExactMatch(content, anchor.text, anchor.line);

  if (exactMatch !== null) {
    return {
      fromOffset: exactMatch,
      toOffset: exactMatch + anchor.text.length,
      exact: true
    };
  }

  if (!anchor.line) return null;

  const lineStart = getLineStartOffset(content, anchor.line - 1);
  const lineEnd = getLineEndOffset(content, lineStart);

  return {
    fromOffset: lineStart,
    toOffset: lineEnd,
    exact: false
  };
}

function findClosestExactMatch(
  content: string,
  extract: string,
  storedLine?: number
): number | null {
  if (!extract) return null;

  let bestOffset: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let searchFrom = 0;
  const targetLine = storedLine ? storedLine - 1 : null;

  while (searchFrom <= content.length - extract.length) {
    const matchOffset = content.indexOf(extract, searchFrom);
    if (matchOffset === -1) break;

    if (targetLine === null) return matchOffset;

    const matchLine = getLineNumberAtOffset(content, matchOffset);
    const distance = Math.abs(matchLine - targetLine);

    if (distance < bestDistance) {
      bestOffset = matchOffset;
      bestDistance = distance;
    }

    searchFrom = matchOffset + 1;
  }

  return bestOffset;
}

function getLineNumberAtOffset(content: string, offset: number): number {
  let line = 0;

  for (let index = 0; index < offset; index += 1) {
    if (content.charCodeAt(index) === 10) line += 1;
  }

  return line;
}

function getLineStartOffset(content: string, requestedLine: number): number {
  const targetLine = Math.max(0, requestedLine);
  let line = 0;

  if (targetLine === 0) return 0;

  for (let index = 0; index < content.length; index += 1) {
    if (content.charCodeAt(index) !== 10) continue;

    line += 1;
    if (line === targetLine) return index + 1;
  }

  const finalLineStart = content.lastIndexOf("\n");
  return finalLineStart === -1 ? 0 : finalLineStart + 1;
}

function getLineEndOffset(content: string, lineStart: number): number {
  const newline = content.indexOf("\n", lineStart);
  return newline === -1 ? content.length : newline;
}
