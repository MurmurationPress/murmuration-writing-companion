const DERIVED_REPORTING_PROPERTIES = new Set([
  "manuscript_sequence",
  "book_scene_number",
  "series_scene_number"
]);

function withoutDerivedReportingLines(content: string): string {
  if (!content.startsWith("---")) return content;
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(newline);
  if (lines[0]?.trim() !== "---") return content;
  const closing = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (closing < 0) return content;

  return lines.filter((line, index) => {
    if (index <= 0 || index >= closing) return true;
    const property = line.match(/^([A-Za-z0-9_-]+)\s*:/)?.[1];
    return !property || !DERIVED_REPORTING_PROPERTIES.has(property);
  }).join(newline);
}

/** Reporting projection is disposable and must not make immediate Undo stale. */
export function manuscriptPreparationContentMatchesUndoState(
  current: string,
  prepared: string
): boolean {
  return current === prepared
    || withoutDerivedReportingLines(current) === withoutDerivedReportingLines(prepared);
}
