import { StateTableData } from "./StateTableData";

function label(value: string): string {
  return value.replace(/\\/gu, "\\\\").replace(/\|/gu, "\\|");
}

export function formatStateTableNumber(value: number): string {
  const rounded = Math.abs(value) < 0.005 ? 0 : value;
  return `${rounded >= 0 ? "+" : ""}${rounded.toFixed(2)}`;
}

export function renderStateTableMarkdown(data: StateTableData): string {
  const lines = [
    "|parameter|current|previous|Δ|",
    "|---|---:|---:|---:|"
  ];
  for (const row of data.rows) {
    lines.push(`|${label(row.label)}|${formatStateTableNumber(row.current)}|${row.previous === null ? "—" : formatStateTableNumber(row.previous)}|${row.delta === null ? "—" : formatStateTableNumber(row.delta)}|`);
  }
  return `${lines.join("\n")}\n`;
}
