export const GENERATED_REPORT_TYPE = "generated-report";

export function isGeneratedReportFrontmatter(
  frontmatter: Record<string, unknown> | undefined | null
): boolean {
  const type = typeof frontmatter?.type === "string" ? frontmatter.type.trim().toLowerCase() : "";
  return type === GENERATED_REPORT_TYPE || type === "continuity-review-report";
}
