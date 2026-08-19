export interface StoryWorldRelinkOccurrence {
  readonly raw: string;
  readonly start: number;
  readonly end: number;
}

function installableTarget(path: string): string {
  return path.normalize("NFC").replace(/\.md$/iu, "");
}

/** Replaces exactly one reviewed wikilink occurrence and no surrounding prose. */
export function relinkStoryWorldOccurrence(
  markdown: string,
  occurrence: StoryWorldRelinkOccurrence,
  targetPath: string
): string {
  if (!Number.isInteger(occurrence.start) || !Number.isInteger(occurrence.end)
    || occurrence.start < 0 || occurrence.end <= occurrence.start
    || occurrence.end > markdown.length) throw new Error("The reviewed wikilink location is no longer valid.");
  if (markdown.slice(occurrence.start, occurrence.end) !== occurrence.raw) {
    throw new Error("The reviewed wikilink changed after analysis. Run Story World Review again.");
  }
  const match = /^\[\[([\s\S]*?)(\|[\s\S]*?)?\]\]$/u.exec(occurrence.raw);
  if (!match) throw new Error("The selected text is no longer a supported wikilink.");
  const replacement = `[[${installableTarget(targetPath)}${match[2] ?? ""}]]`;
  return markdown.slice(0, occurrence.start) + replacement + markdown.slice(occurrence.end);
}
