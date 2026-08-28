import { deepEqual, equal, match, rejects } from "node:assert/strict";
import { test } from "node:test";
import { parseLineChartDefinition } from "../src/derived-artefacts/DerivedArtefactDefinition";
import { ArtefactDocument, DerivedArtefactService, DerivedArtefactVault } from "../src/derived-artefacts/DerivedArtefactService";
import { normaliseLineChartData } from "../src/derived-artefacts/LineChartData";
import { renderLineChartSvg } from "../src/derived-artefacts/LineChartSvg";

const frontmatter = {
  world_entity: "derived-artefact", artefact_type: "line-chart", source: "Observations", x: "date",
  series: [{ property: "recurrence", label: "Recurrence" }], window: "12 months", end: "2029-05-29",
  title: "Trend & response", subtitle: "A <scientific> view", x_axis_label: "Date", y_axis_label: "Score",
  output: "Visualisations/Trend.svg"
};
const definition = parseLineChartDefinition(frontmatter);
const observations = [
  ["Observations/One.md", "2029-01-20", 0.86],
  ["Observations/Peak.md", "2029-04-28", 0.95],
  ["Observations/Event.md", "2029-05-06", 0.92],
  ["Observations/Last.md", "2029-05-29", 0.94]
] as const;
const records = observations.map(([path, date, recurrence]) => ({ path, frontmatter: { date, recurrence } }));

test("line-chart definitions parse a small explicit schema", () => {
  equal(definition.artefactType, "line-chart");
  equal(definition.series[0].label, "Recurrence");
  deepEqual(definition.window, { amount: 12, unit: "months" });
});

test("definition validation rejects unsupported, missing, duplicate, excessive, and malformed fields", () => {
  for (const invalid of [
    { ...frontmatter, artefact_type: "bar-chart" },
    { ...frontmatter, source: undefined },
    { ...frontmatter, x: undefined },
    { ...frontmatter, series: [] },
    { ...frontmatter, series: Array.from({ length: 5 }, (_, i) => ({ property: `s${i}`, label: `S${i}` })) },
    { ...frontmatter, series: [{ property: "score", label: "One" }, { property: "score", label: "Two" }] },
    { ...frontmatter, end: "2029-02-30" },
    { ...frontmatter, window: "last year" },
    { ...frontmatter, output: undefined },
    { ...frontmatter, output: "Visualisations/Trend.png" }
  ]) rejects(Promise.resolve().then(() => parseLineChartDefinition(invalid)));
});

test("observations sort by date with a stable path tie-break", () => {
  const data = normaliseLineChartData(definition, [records[3], records[1], records[0], records[2]]);
  deepEqual(data.points.map((point) => point.date), ["2029-01-20", "2029-04-28", "2029-05-06", "2029-05-29"]);
});

test("rolling windows intersect explicit bounds and include their boundaries", () => {
  const bounded = { ...definition, start: "2029-04-28", window: { amount: 2, unit: "months" as const } };
  deepEqual(normaliseLineChartData(bounded, records).points.map((point) => point.date), ["2029-04-28", "2029-05-06", "2029-05-29"]);
});

test("irregular event observations preserve the 28 April peak in sequence", () => {
  const data = normaliseLineChartData(definition, records);
  deepEqual(data.points.map((point) => point.values[0]), [0.86, 0.95, 0.92, 0.94]);
  const svg = renderLineChartSvg(data);
  match(svg, /data-date="2029-04-28"/u);
  const coordinates = /data-series="recurrence" points="([^"]+)"/u.exec(svg)?.[1].split(" ") ?? [];
  equal(coordinates.length, 4);
  const x = coordinates.map((point) => Number(point.split(",")[0]));
  const y = coordinates.map((point) => Number(point.split(",")[1]));
  equal(x[1] - x[0] > x[2] - x[1], true, "x positions must preserve the longer January-to-April interval");
  equal(y[1] < y[0] && y[1] < y[2] && y[1] < y[3], true);
});

test("source values must be complete finite numbers", () => {
  rejects(Promise.resolve().then(() => normaliseLineChartData(definition, [{ path: "Observations/Bad.md", frontmatter: { date: "2029-01-01", recurrence: "0.8" } }])), /finite number/u);
  rejects(Promise.resolve().then(() => normaliseLineChartData(definition, [{ path: "Observations/Bad.md", frontmatter: { date: "2029-01-01" } }])), /finite number/u);
});

test("SVG output is deterministic and escapes all declared text", () => {
  const data = normaliseLineChartData(definition, records);
  equal(renderLineChartSvg(data), renderLineChartSvg(data));
  const svg = renderLineChartSvg(data);
  match(svg, /Trend &amp; response/u);
  match(svg, /A &lt;scientific&gt; view/u);
  equal(svg.endsWith("\n"), true);
});

test("renderer supports one and multiple series with markers and legends", () => {
  const multiDefinition = parseLineChartDefinition({ ...frontmatter, series: [
    { property: "a", label: "Series A" }, { property: "b", label: "Series B" }
  ] });
  const svg = renderLineChartSvg(normaliseLineChartData(multiDefinition, [{ path: "Observations/A.md", frontmatter: { date: "2029-01-01", a: 1, b: 2 } }]));
  equal((svg.match(/<polyline /gu) ?? []).length, 2);
  equal((svg.match(/<circle data-series=/gu) ?? []).length, 2);
  match(svg, /Series A/u); match(svg, /Series B/u);
});

class MemoryVault implements DerivedArtefactVault {
  documents: ArtefactDocument[] = [{ path: "Definitions/Trend.md", frontmatter }, ...records];
  entries = new Map<string, "file" | "folder">([["Definitions", "folder"], ["Visualisations", "folder"]]);
  writes: { kind: "create" | "modify"; path: string; content: string }[] = [];
  markdownDocuments() { return this.documents; }
  entryKind(path: string) { return this.entries.get(path) ?? null; }
  async createFolder(path: string) { this.entries.set(path, "folder"); }
  async create(path: string, content: string) { this.entries.set(path, "file"); this.writes.push({ kind: "create", path, content }); }
  async modify(path: string, content: string) { this.writes.push({ kind: "modify", path, content }); }
}

test("service creates then deterministically replaces an existing SVG", async () => {
  const vault = new MemoryVault(), service = new DerivedArtefactService(vault);
  const first = await service.generate("Definitions/Trend.md");
  const second = await service.generate("Definitions/Trend.md");
  deepEqual(vault.writes.map((write) => write.kind), ["create", "modify"]);
  equal(first.svg, second.svg);
});

test("malformed definitions and output collisions perform no writes", async () => {
  const malformed = new MemoryVault();
  malformed.documents[0] = { path: "Definitions/Trend.md", frontmatter: { ...frontmatter, series: [] } };
  await rejects(new DerivedArtefactService(malformed).generate("Definitions/Trend.md"));
  equal(malformed.writes.length, 0);
  const collision = new MemoryVault();
  collision.documents.push({ path: "Visualisations/Trend.md", frontmatter: {} });
  await rejects(new DerivedArtefactService(collision).generate("Definitions/Trend.md"), /collides/u);
  equal(collision.writes.length, 0);
});
