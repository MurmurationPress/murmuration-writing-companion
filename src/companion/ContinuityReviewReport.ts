import type {
  ContinuityReviewFilterOption,
  ContinuityReviewFilters,
  ContinuityReviewItem,
  ContinuityReviewProjection
} from "../observations/ContinuityReview";
import { projectContinuityReview } from "../observations/ContinuityReview";
import type { ObservationEvidence, ObservationNoteReference } from "../observations/ContinuityObservation";
import { continuityNoteLabel, projectContinuityReviewPresentation } from "./ContinuityReviewPresentation";
import { CONTINUITY_REVIEW_REPORT_TYPE } from "./ContinuityReviewReportClassification";

export type ContinuityReviewReportScope = "book" | "filtered";

export interface ContinuityReviewReportFilter {
  readonly label: string;
  readonly value: string;
}

export interface ContinuityReviewReportInput {
  readonly book: ObservationNoteReference;
  readonly scope: ContinuityReviewReportScope;
  readonly filters: readonly ContinuityReviewReportFilter[];
  readonly items: readonly ContinuityReviewItem[];
  readonly generatedAt: string;
  readonly pluginVersion: string;
  readonly existingPaths?: ReadonlySet<string>;
}

export interface ContinuityReviewReportDraft {
  readonly scope: ContinuityReviewReportScope;
  readonly filename: string;
  readonly markdown: string;
}

export interface ContinuityReviewReportChoices {
  readonly book: ContinuityReviewReportDraft;
  readonly filtered: ContinuityReviewReportDraft;
}

type ReportState = "unresolved" | "deferred" | "intentional" | "resolved" | "stale";

const STATE_ORDER: readonly ReportState[] = ["unresolved", "deferred", "intentional", "resolved", "stale"];
const STATE_HEADINGS: Record<ReportState, string> = {
  unresolved: "Unresolved",
  deferred: "Deferred",
  intentional: "Accepted as intentional",
  resolved: "Resolved by author action — still detected",
  stale: "Stale dispositions requiring renewed review"
};

function wikilink(note: ObservationNoteReference, existingPaths?: ReadonlySet<string>): string {
  const target = note.path.replace(/\.md$/i, "");
  const label = continuityNoteLabel(note).replace(/\|/g, "\\|");
  const missing = existingPaths && !existingPaths.has(note.path) ? " (source currently unavailable)" : "";
  return `[[${target}|${label}]]${missing}`;
}

function readable(value: string): string {
  return value.split(".").filter(Boolean).map((part) => part.replace(/[-_]+/g, " "))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" · ");
}

function evidenceValue(evidence: ObservationEvidence, existingPaths?: ReadonlySet<string>): string {
  const value = evidence.value;
  switch (value.kind) {
    case "missing": return "Missing";
    case "value": return typeof value.value === "string" ? value.value : JSON.stringify(value.value);
    case "date": return `${value.value} (${value.precision} precision)`;
    case "resolved_note": return wikilink(value.note, existingPaths);
    case "unresolved_reference": return `${value.reference} — unresolved (${value.reason.replace(/_/g, " ")})`;
    case "malformed": return `${JSON.stringify(value.raw)} — malformed (${value.reason.replace(/_/g, " ")})`;
    case "unsupported": return `${JSON.stringify(value.raw)} — unsupported (${value.reason.replace(/_/g, " ")})`;
  }
}

function reportState(item: ContinuityReviewItem): ReportState {
  if (item.match.state === "stale") return "stale";
  return item.match.record?.disposition ?? "unresolved";
}

function itemOrder(item: ContinuityReviewItem): number {
  return item.locations[0]?.order ?? Number.MAX_SAFE_INTEGER;
}

function compareItems(left: ContinuityReviewItem, right: ContinuityReviewItem): number {
  const severity = { conflict: 0, review: 1, information: 2 } as const;
  return itemOrder(left) - itemOrder(right)
    || severity[left.observation.severity] - severity[right.observation.severity]
    || left.observation.kind.localeCompare(right.observation.kind)
    || left.observation.lineageKey.localeCompare(right.observation.lineageKey);
}

function countBy(items: readonly ContinuityReviewItem[], value: (item: ContinuityReviewItem) => string): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(value(item), (counts.get(value(item)) ?? 0) + 1);
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function summaryList(label: string, values: readonly [string, number][]): string[] {
  if (!values.length) return [];
  return [`### ${label}`, "", ...values.map(([name, count]) => `- ${readable(name)}: ${count}`), ""];
}

function evidenceGroup(evidence: ObservationEvidence): "Manuscript evidence" | "Story World evidence" | "Derived temporal evidence" {
  const role = evidence.role.toLowerCase();
  if (role.includes("date") || role.includes("time") || role.includes("valid_")) return "Derived temporal evidence";
  return evidence.source.note.role === "story_world" ? "Story World evidence" : "Manuscript evidence";
}

function renderObservation(item: ContinuityReviewItem, existingPaths?: ReadonlySet<string>): string[] {
  const observation = item.observation;
  const presentation = projectContinuityReviewPresentation(item);
  const lines = [`### ${presentation.finding}`, ""];
  lines.push(`- **Severity:** ${readable(observation.severity)}`);
  lines.push(`- **Observation kind:** ${readable(observation.kind)}`);
  lines.push(`- **Classification:** ${readable(observation.classification)}`);
  lines.push(`- **Primary source:** ${wikilink(observation.primary, existingPaths)}`);
  if (item.locations.length) {
    lines.push(`- **Manuscript location:** ${item.locations.map((location) => (
      location.partLabel && location.partPath
        ? `[[${location.partPath.replace(/\.md$/i, "")}|${location.partLabel.replace(/\|/g, "\\|")}]] → [[${location.path.replace(/\.md$/i, "")}|${location.label.replace(/\|/g, "\\|")}]]`
        : `[[${location.path.replace(/\.md$/i, "")}|${location.label.replace(/\|/g, "\\|")}]]`
    )).join(" · ")}`);
  }
  if (item.entities.length) lines.push(`- **Story World notes:** ${item.entities.map((note) => wikilink(note, existingPaths)).join(" · ")}`);
  lines.push(`- **Rule:** ${observation.rule.id} v${observation.rule.version}`);
  lines.push(`- **Fingerprint:** \`${observation.fingerprint}\``);
  lines.push("", presentation.explanation, "");

  const grouped = new Map<string, ObservationEvidence[]>();
  for (const evidence of observation.evidence) {
    const group = evidenceGroup(evidence);
    const rows = grouped.get(group) ?? [];
    rows.push(evidence); grouped.set(group, rows);
  }
  for (const group of ["Manuscript evidence", "Story World evidence", "Derived temporal evidence"] as const) {
    const evidence = grouped.get(group);
    if (!evidence?.length) continue;
    lines.push(`#### ${group}`, "");
    for (const row of evidence) {
      const property = row.source.property.join(".") || "note";
      lines.push(`- **${readable(row.role)}:** ${wikilink(row.source.note, existingPaths)} · \`${property}\` · ${evidenceValue(row, existingPaths)}`);
    }
    lines.push("");
  }

  const record = item.match.record;
  lines.push("#### Editorial disposition", "");
  if (!record) lines.push("- No current disposition — unresolved.");
  else {
    const status = item.match.state === "stale" ? `Stale; previously marked ${record.disposition}` : readable(record.disposition);
    lines.push(`- **Status:** ${status}`);
    lines.push(`- **First reviewed:** ${record.firstReviewedAt}`);
    lines.push(`- **Last updated:** ${record.updatedAt}`);
    if (record.note) lines.push(`- **Author note:** ${record.note.replace(/\n/g, "  \n  ")}`);
  }
  lines.push("");
  return lines;
}

export function sanitizeContinuityReviewReportFilename(value: string): string {
  const cleaned = value.normalize("NFC").replace(/[\\/:*?"<>|#[\]^]/g, "-").replace(/\s+/g, " ").replace(/-+/g, "-").trim();
  return `${cleaned || "Continuity Review"}.md`.replace(/\.md\.md$/i, ".md");
}

export function continuityReviewReportFilename(bookTitle: string, date: string, scope: ContinuityReviewReportScope): string {
  const suffix = scope === "filtered" ? " - Filtered" : "";
  return sanitizeContinuityReviewReportFilename(`Continuity Review - ${bookTitle} - ${date}${suffix}`);
}

export function describeContinuityReviewFilters(
  filters: ContinuityReviewFilters,
  options: ContinuityReviewProjection["filterOptions"]
): ContinuityReviewReportFilter[] {
  const label = (values: readonly ContinuityReviewFilterOption[], value: string | null, fallback: string) => (
    value ? values.find((option) => option.value === value)?.label ?? value : fallback
  );
  return [
    { label: "Queue", value: filters.queue === "all" ? "All" : filters.queue === "reviewed" ? "Reviewed" : "Active" },
    { label: "Type", value: label(options.types, filters.type, "All types") },
    { label: "Location", value: label(options.locations, filters.locationPath, "All locations") },
    { label: "Entity", value: label(options.entities, filters.entityPath, "All entities") }
  ];
}

export function generateContinuityReviewReport(input: ContinuityReviewReportInput): ContinuityReviewReportDraft {
  const bookTitle = continuityNoteLabel(input.book);
  const date = input.generatedAt.slice(0, 10);
  const lines = [
    "---",
    `type: ${CONTINUITY_REVIEW_REPORT_TYPE}`,
    `report_scope: ${input.scope}`,
    `report_book: \"[[${input.book.path.replace(/\.md$/i, "")}]]\"`,
    `generated_at: ${input.generatedAt}`,
    "---",
    "",
    `# Continuity Review — ${bookTitle}`,
    "",
    `- **Book:** ${wikilink(input.book, input.existingPaths)}`,
    `- **Scope:** ${input.scope === "book" ? "Entire selected Book" : "Current filtered result set"}`,
    `- **Review timestamp:** ${input.generatedAt}`,
    `- **MWC version:** ${input.pluginVersion}`,
    `- **Observation identity contract:** obs-v1`,
    `- **Authority:** Current manuscript and Story World Markdown remain authoritative. This report is a derived editorial snapshot.`,
    ""
  ];
  if (input.scope === "filtered") {
    lines.push("## Active filters", "", ...input.filters.map((filter) => `- **${filter.label}:** ${filter.value}`), "");
  }
  const ordered = [...input.items].sort(compareItems);
  lines.push("## Summary", "", `- **Total observations:** ${ordered.length}`, "");
  lines.push(...summaryList("By severity", countBy(ordered, (item) => item.observation.severity)));
  lines.push(...summaryList("By observation kind", countBy(ordered, (item) => item.observation.kind)));
  lines.push(...summaryList("By disposition", STATE_ORDER.map((state) => [state, ordered.filter((item) => reportState(item) === state).length] as [string, number]).filter(([, count]) => count > 0)));
  if (!ordered.length) lines.push("## Observations", "", "No matching observations were present for this report scope.", "");
  for (const state of STATE_ORDER) {
    const items = ordered.filter((item) => reportState(item) === state);
    if (!items.length) continue;
    lines.push(`## ${STATE_HEADINGS[state]}`, "");
    for (const item of items) lines.push(...renderObservation(item, input.existingPaths));
  }
  lines.push(
    "---", "",
    "This report is a snapshot. Manuscript and Story World Markdown remain authoritative. Rebuilding Continuity Review from unchanged Markdown and unchanged editorial dispositions should reproduce materially equivalent observations; later source changes may make this report obsolete.",
    ""
  );
  return {
    scope: input.scope,
    filename: continuityReviewReportFilename(bookTitle, date, input.scope),
    markdown: lines.join("\n")
  };
}

export function buildContinuityReviewReportChoices(options: {
  readonly input: Parameters<typeof projectContinuityReview>[0];
  readonly filteredProjection: ContinuityReviewProjection;
  readonly filters: ContinuityReviewFilters;
  readonly generatedAt: string;
  readonly pluginVersion: string;
  readonly existingPaths?: ReadonlySet<string>;
}): ContinuityReviewReportChoices {
  const common = {
    book: options.input.manuscriptScope.book,
    generatedAt: options.generatedAt,
    pluginVersion: options.pluginVersion,
    existingPaths: options.existingPaths
  };
  const whole = projectContinuityReview(options.input, {
    queue: "all", type: null, locationPath: null, entityPath: null
  });
  return {
    book: generateContinuityReviewReport({
      ...common, scope: "book", filters: [], items: whole.items
    }),
    filtered: generateContinuityReviewReport({
      ...common,
      scope: "filtered",
      filters: describeContinuityReviewFilters(options.filters, options.filteredProjection.filterOptions),
      items: options.filteredProjection.items
    })
  };
}
