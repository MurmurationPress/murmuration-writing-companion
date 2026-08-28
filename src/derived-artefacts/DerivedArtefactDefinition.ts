export interface LineChartSeriesDefinition {
  readonly property: string;
  readonly label: string;
}

export interface LineChartDefinition {
  readonly artefactType: "line-chart";
  readonly source: string;
  readonly x: string;
  readonly series: readonly LineChartSeriesDefinition[];
  readonly start?: string;
  readonly end?: string;
  readonly window?: { readonly amount: number; readonly unit: "months" | "years" };
  readonly title: string;
  readonly subtitle?: string;
  readonly xAxisLabel?: string;
  readonly yAxisLabel?: string;
  readonly output: string;
}

function text(value: unknown, field: string, required = false): string | undefined {
  if (value === undefined || value === null || value === "") {
    if (required) throw new Error(`Missing ${field}.`);
    return undefined;
  }
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be non-empty text.`);
  return value.trim();
}

export function parseIsoDate(value: unknown, field: string): string | undefined {
  const raw = text(value, field);
  if (raw === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(raw)) throw new Error(`${field} must be a YYYY-MM-DD date.`);
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== raw) {
    throw new Error(`${field} must be a valid calendar date.`);
  }
  return raw;
}

function parseWindow(value: unknown): LineChartDefinition["window"] {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error("window must look like “12 months” or “1 year”.");
  const match = /^(\d+)\s+(month|months|year|years)$/iu.exec(value.trim());
  if (!match || Number(match[1]) < 1) throw new Error("window must be a positive duration such as “12 months”.");
  return { amount: Number(match[1]), unit: match[2].toLowerCase().startsWith("month") ? "months" : "years" };
}

export function isDerivedArtefactDefinition(frontmatter: Record<string, unknown> | undefined): boolean {
  return frontmatter?.world_entity === "derived-artefact";
}

export function parseLineChartDefinition(frontmatter: Record<string, unknown>): LineChartDefinition {
  if (frontmatter.world_entity !== "derived-artefact") throw new Error("world_entity must be derived-artefact.");
  if (frontmatter.artefact_type !== "line-chart") {
    throw new Error(`Unsupported artefact_type: ${String(frontmatter.artefact_type ?? "missing")}.`);
  }
  const source = text(frontmatter.source, "source", true)!;
  const x = text(frontmatter.x, "x", true)!;
  if (!Array.isArray(frontmatter.series) || frontmatter.series.length === 0) throw new Error("series must contain at least one series.");
  if (frontmatter.series.length > 4) throw new Error("series must contain no more than four series.");
  const series = frontmatter.series.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`series[${index}] must be a mapping.`);
    const entry = item as Record<string, unknown>;
    return { property: text(entry.property, `series[${index}].property`, true)!, label: text(entry.label, `series[${index}].label`, true)! };
  });
  if (new Set(series.map((item) => item.property)).size !== series.length) throw new Error("series properties must be unique.");
  const start = parseIsoDate(frontmatter.start, "start");
  const end = parseIsoDate(frontmatter.end, "end");
  if (start && end && start > end) throw new Error("start must not be after end.");
  const output = text(frontmatter.output, "output", true)!;
  if (!output.toLowerCase().endsWith(".svg")) throw new Error("output must be an SVG path ending in .svg.");
  if (output.startsWith("/") || output.split("/").includes("..")) throw new Error("output must be a vault-relative path without .. segments.");
  return {
    artefactType: "line-chart", source, x, series, start, end,
    window: parseWindow(frontmatter.window),
    title: text(frontmatter.title, "title", true)!,
    subtitle: text(frontmatter.subtitle, "subtitle"),
    xAxisLabel: text(frontmatter.x_axis_label, "x_axis_label"),
    yAxisLabel: text(frontmatter.y_axis_label, "y_axis_label"),
    output
  };
}
