import { deepEqual, equal, match, rejects } from "node:assert/strict";
import { test } from "node:test";
import { parseLineChartDefinition, parseStateTableDefinition } from "../src/derived-artefacts/DerivedArtefactDefinition";
import { ArtefactDocument, DerivedArtefactService, DerivedArtefactVault } from "../src/derived-artefacts/DerivedArtefactService";
import { normaliseLineChartData } from "../src/derived-artefacts/LineChartData";
import { renderLineChartSvg } from "../src/derived-artefacts/LineChartSvg";
import { normaliseStateTableData } from "../src/derived-artefacts/StateTableData";
import { formatStateTableNumber, renderStateTableMarkdown } from "../src/derived-artefacts/StateTableMarkdown";

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
  contents = new Map<string, string>();
  markdownDocuments() { return this.documents; }
  entryKind(path: string) { return this.entries.get(path) ?? null; }
  async createFolder(path: string) { this.entries.set(path, "folder"); }
  async create(path: string, content: string) {
    this.entries.set(path, "file"); this.contents.set(path, content); this.writes.push({ kind: "create", path, content });
    if (path.endsWith(".md") && !this.documents.some((document) => document.path === path)) this.documents.push({ path });
  }
  async modify(path: string, content: string) { this.contents.set(path, content); this.writes.push({ kind: "modify", path, content }); }
  async read(path: string) { return this.contents.get(path) ?? ""; }
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

const stateFrontmatter = {
  world_entity: "derived-artefact", artefact_type: "state-table", source: "Observations", x: "date",
  end: "2029-05-29",
  parameters: [
    { property: "recurrence", label: "Recurrence extent" },
    { property: "containment", label: "Containment leverage" }
  ],
  output: "Visualisations/State 2029-05-29.md"
};
const stateDefinition = parseStateTableDefinition(stateFrontmatter);
const stateRecords = [
  { path: "Observations/January.md", frontmatter: { date: "2029-01-20", recurrence: 0.86, containment: 0.31 } },
  { path: "Observations/April.md", frontmatter: { date: "2029-04-28", recurrence: 0.95, containment: 0.39 } },
  { path: "Observations/May 06.md", frontmatter: { date: "2029-05-06", recurrence: 0.92, containment: 0.37 } },
  { path: "Observations/May 29.md", frontmatter: { date: "2029-05-29", recurrence: 0.94, containment: 0.33 } }
];

test("state-table definitions parse generic ordered parameters and optional endpoints", () => {
  equal(stateDefinition.artefactType, "state-table");
  deepEqual(stateDefinition.parameters.map((parameter) => parameter.label), ["Recurrence extent", "Containment leverage"]);
  equal(parseStateTableDefinition({ ...stateFrontmatter, end: undefined }).end, undefined);
});

test("state-table definition validation rejects malformed parameters, dates, and output paths", async () => {
  for (const invalid of [
    { ...stateFrontmatter, artefact_type: "comparison-table" },
    { ...stateFrontmatter, source: undefined },
    { ...stateFrontmatter, source: "../Observations" },
    { ...stateFrontmatter, x: undefined },
    { ...stateFrontmatter, parameters: [] },
    { ...stateFrontmatter, parameters: [{ property: "", label: "Missing" }] },
    { ...stateFrontmatter, parameters: [{ property: "score", label: "" }] },
    { ...stateFrontmatter, parameters: [{ property: "score", label: "One" }, { property: "score", label: "Two" }] },
    { ...stateFrontmatter, end: "2029-02-30" },
    { ...stateFrontmatter, output: "Visualisations/State.svg" },
    { ...stateFrontmatter, output: "../State.md" }
  ]) await rejects(Promise.resolve().then(() => parseStateTableDefinition(invalid)));
});

test("state-table deterministically selects current and immediately preceding canonical observations", () => {
  const data = normaliseStateTableData(stateDefinition, [stateRecords[3], stateRecords[0], stateRecords[2], stateRecords[1]]);
  deepEqual(data.observations.map((observation) => observation.date), ["2029-01-20", "2029-04-28", "2029-05-06", "2029-05-29"]);
  equal(data.current.date, "2029-05-29"); equal(data.previous?.date, "2029-05-06");
  equal(data.rows[0].current, 0.94); equal(data.rows[0].previous, 0.92);
  equal(Number(data.rows[0].delta?.toFixed(2)), 0.02);
});

test("inserting an intermediate canonical observation changes previous and delta", () => {
  const inserted = { path: "Observations/May 20.md", frontmatter: { date: "2029-05-20", recurrence: 0.93, containment: 0.35 } };
  const data = normaliseStateTableData(stateDefinition, [...stateRecords, inserted]);
  equal(data.current.date, "2029-05-29"); equal(data.previous?.date, "2029-05-20");
  equal(data.rows[0].previous, 0.93); equal(Number(data.rows[0].delta?.toFixed(2)), 0.01);
});

test("state-table uses the latest observation when end is omitted", () => {
  const data = normaliseStateTableData({ ...stateDefinition, end: undefined }, stateRecords.slice(0, 3));
  equal(data.current.date, "2029-05-06"); equal(data.previous?.date, "2029-04-28");
});

test("the first observation renders em dashes without invented history", () => {
  const data = normaliseStateTableData(stateDefinition, stateRecords.slice(0, 1));
  equal(data.previous, null);
  match(renderStateTableMarkdown(data), /\|Recurrence extent\|\+0\.86\|—\|—\|/u);
});

test("state-table Markdown is deterministic, ordered, and formats signed values consistently", () => {
  const data = normaliseStateTableData(stateDefinition, stateRecords);
  const expected = "|parameter|current|previous|Δ|\n|---|---:|---:|---:|\n|Recurrence extent|+0.94|+0.92|+0.02|\n|Containment leverage|+0.33|+0.37|-0.04|\n";
  equal(renderStateTableMarkdown(data), expected);
  equal(renderStateTableMarkdown(data), renderStateTableMarkdown(data));
  deepEqual([formatStateTableNumber(1), formatStateTableNumber(-1), formatStateTableNumber(0), formatStateTableNumber(-0)], ["+1.00", "-1.00", "+0.00", "+0.00"]);
});

test("state-table rejects missing current and every malformed canonical source value", async () => {
  await rejects(Promise.resolve().then(() => normaliseStateTableData({ ...stateDefinition, end: "2028-01-01" }, stateRecords)), /No current observation/u);
  for (const frontmatter of [
    { date: "bad", recurrence: 1, containment: 2 },
    { date: "2029-01-01", recurrence: "1", containment: 2 },
    { date: "2029-01-01", recurrence: 1 }
  ]) await rejects(Promise.resolve().then(() => normaliseStateTableData(stateDefinition, [{ path: "Observations/Bad.md", frontmatter }])), /date|finite number/u);

  const malformedPrevious = stateRecords.map((record) => record.path === "Observations/May 06.md"
    ? { ...record, frontmatter: { ...record.frontmatter, recurrence: "0.92" } }
    : record);
  await rejects(Promise.resolve().then(() => normaliseStateTableData(stateDefinition, malformedPrevious)), /May 06\.md: recurrence must be a finite number/u);
});

function stateVault(): MemoryVault {
  const vault = new MemoryVault();
  vault.documents = [{ path: "Definitions/State.md", frontmatter: stateFrontmatter }, ...stateRecords];
  vault.entries.set("Observations", "folder");
  return vault;
}

test("service generates and safely regenerates deterministic state-table Markdown without source mutation", async () => {
  const vault = stateVault(); const before = JSON.stringify(vault.documents); const service = new DerivedArtefactService(vault);
  const first = await service.generate("Definitions/State.md"); const second = await service.generate("Definitions/State.md");
  deepEqual(vault.writes.map((write) => write.kind), ["create", "modify"]);
  equal(first.markdown, second.markdown); match(first.content, /mwc-derived-artefact:state-table/u);
  equal(JSON.stringify(vault.documents.filter((document) => document.path !== stateFrontmatter.output)), before);
});

test("state-table validation and collisions produce no writes", async () => {
  const cases = [
    { mutate: (vault: MemoryVault) => vault.entries.delete("Observations"), pattern: /existing vault folder/u },
    { mutate: (vault: MemoryVault) => { vault.documents[0] = { path: "Definitions/State.md", frontmatter: { ...stateFrontmatter, parameters: [] } }; }, pattern: /parameters/u },
    { mutate: (vault: MemoryVault) => { vault.documents.push({ path: stateFrontmatter.output, frontmatter: {} }); vault.entries.set(stateFrontmatter.output, "file"); vault.contents.set(stateFrontmatter.output, "unrelated"); }, pattern: /collides/u },
    { mutate: (vault: MemoryVault) => { vault.documents[0] = { path: "Definitions/State.md", frontmatter: { ...stateFrontmatter, output: "Observations/State.md" } }; }, pattern: /collides/u },
    { mutate: (vault: MemoryVault) => { vault.documents[0] = { path: "Definitions/State.md", frontmatter: { ...stateFrontmatter, output: "Definitions/State.md" } }; }, pattern: /collides/u }
  ];
  for (const item of cases) {
    const vault = stateVault(); item.mutate(vault);
    await rejects(new DerivedArtefactService(vault).generate("Definitions/State.md"), item.pattern);
    equal(vault.writes.length, 0);
  }
});

test("mixed renderer definitions generate independently and an invalid definition does not corrupt valid outputs", async () => {
  const vault = stateVault();
  vault.documents.unshift({ path: "Definitions/Trend.md", frontmatter });
  vault.documents.push({ path: "Definitions/Invalid.md", frontmatter: { ...stateFrontmatter, parameters: [] } });
  const sourceBefore = JSON.stringify(vault.documents); const service = new DerivedArtefactService(vault);
  const failures: string[] = [];
  for (const item of service.definitions()) {
    try { await service.generate(item.path); } catch (error) { failures.push(String(error)); }
  }
  deepEqual(vault.writes.map((write) => write.path).sort(), ["Visualisations/State 2029-05-29.md", "Visualisations/Trend.svg"]);
  equal(failures.length, 1); match(failures[0], /parameters/u);
  equal(JSON.stringify(vault.documents.filter((document) => !document.path.startsWith("Visualisations/"))), sourceBefore);
});
