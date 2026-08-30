import { parseIsoDate, StateTableDefinition } from "./DerivedArtefactDefinition";
import { FrontmatterRecord } from "./LineChartData";

export interface StateTableObservation {
  readonly date: string;
  readonly timestamp: number;
  readonly values: readonly number[];
  readonly sourcePath: string;
}

export interface StateTableRow {
  readonly property: string;
  readonly label: string;
  readonly current: number;
  readonly previous: number | null;
  readonly delta: number | null;
}

export interface StateTableData {
  readonly definition: StateTableDefinition;
  readonly observations: readonly StateTableObservation[];
  readonly current: StateTableObservation;
  readonly previous: StateTableObservation | null;
  readonly rows: readonly StateTableRow[];
}

function numeric(value: unknown, property: string, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${path}: ${property} must be a finite number.`);
  return value;
}

export function normaliseStateTableData(
  definition: StateTableDefinition,
  records: readonly FrontmatterRecord[]
): StateTableData {
  const observations = records.map((record) => {
    const rawDate = record.frontmatter[definition.x];
    if (rawDate === undefined || rawDate === null || rawDate === "") throw new Error(`${record.path}: missing ${definition.x}.`);
    let date: string;
    try { date = parseIsoDate(rawDate, definition.x)!; }
    catch (error) { throw new Error(`${record.path}: ${error instanceof Error ? error.message : String(error)}`); }
    return {
      date,
      timestamp: Date.parse(`${date}T00:00:00.000Z`),
      values: definition.parameters.map((parameter) => numeric(record.frontmatter[parameter.property], parameter.property, record.path)),
      sourcePath: record.path
    };
  }).sort((left, right) => (
    left.timestamp - right.timestamp
    || (left.sourcePath < right.sourcePath ? -1 : left.sourcePath > right.sourcePath ? 1 : 0)
  ));
  if (observations.length === 0) throw new Error("The source folder contains no Markdown observations.");
  const endpoint = definition.end ?? observations[observations.length - 1].date;
  const available = observations.filter((observation) => observation.date <= endpoint);
  if (available.length === 0) throw new Error("No current observation exists at or before the configured endpoint.");
  const current = available[available.length - 1];
  const previous = available[available.length - 2] ?? null;
  const rows = definition.parameters.map((parameter, index) => ({
    property: parameter.property,
    label: parameter.label,
    current: current.values[index],
    previous: previous?.values[index] ?? null,
    delta: previous ? current.values[index] - previous.values[index] : null
  }));
  return { definition, observations, current, previous, rows };
}
