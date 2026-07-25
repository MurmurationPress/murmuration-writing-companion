export const CONTINUITY_REVIEW_REPORT_TYPE = "continuity-review-report";

export function isContinuityReviewReportFrontmatter(
  frontmatter: Record<string, unknown> | undefined
): boolean {
  return typeof frontmatter?.type === "string"
    && frontmatter.type.trim().toLowerCase() === CONTINUITY_REVIEW_REPORT_TYPE;
}
