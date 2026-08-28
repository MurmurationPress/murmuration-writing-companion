import { LineChartData } from "./LineChartData";

const WIDTH = 960, HEIGHT = 540, LEFT = 86, RIGHT = 30, TOP = 92, BOTTOM = 76;
const COLOURS = ["#2457a7", "#b54708", "#16803a", "#7a3e9d"];
const esc = (value: string) => value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;").replace(/'/gu, "&apos;");
const number = (value: number) => Number(value.toFixed(2)).toString();

function ticks(min: number, max: number): number[] {
  if (min === max) { min -= 1; max += 1; }
  const rough = (max - min) / 5;
  const power = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / power;
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
  const start = Math.floor(min / step) * step, end = Math.ceil(max / step) * step;
  const values: number[] = [];
  for (let value = start; value <= end + step / 2; value += step) values.push(value);
  return values;
}

function dateLabel(iso: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [year, month, day] = iso.split("-").map(Number);
  return `${String(day).padStart(2, "0")} ${months[month - 1]} ${year}`;
}

export function renderLineChartSvg(data: LineChartData): string {
  const plotWidth = WIDTH - LEFT - RIGHT, plotHeight = HEIGHT - TOP - BOTTOM;
  const all = data.points.flatMap((point) => [...point.values]);
  const yTicks = ticks(Math.min(...all), Math.max(...all));
  const yMin = yTicks[0], yMax = yTicks[yTicks.length - 1];
  const xMin = data.points[0].timestamp, xMax = data.points[data.points.length - 1].timestamp;
  const x = (timestamp: number) => LEFT + (xMax === xMin ? plotWidth / 2 : (timestamp - xMin) / (xMax - xMin) * plotWidth);
  const y = (value: number) => TOP + (yMax - value) / (yMax - yMin) * plotHeight;
  const labelIndexes = [...new Set([0, ...Array.from({ length: Math.min(5, data.points.length) }, (_, i) => Math.round(i * (data.points.length - 1) / Math.max(1, Math.min(5, data.points.length) - 1))), data.points.length - 1])].sort((a, b) => a - b);
  const lines: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="chart-title chart-desc">`,
    `  <title id="chart-title">${esc(data.definition.title)}</title>`,
    `  <desc id="chart-desc">Line chart with ${data.definition.series.length} series and ${data.points.length} observations.</desc>`,
    "  <rect width=\"960\" height=\"540\" fill=\"#ffffff\"/>",
    `  <text x="${LEFT}" y="34" font-family="system-ui, sans-serif" font-size="22" font-weight="600" fill="#17212b">${esc(data.definition.title)}</text>`
  ];
  if (data.definition.subtitle) lines.push(`  <text x="${LEFT}" y="58" font-family="system-ui, sans-serif" font-size="13" fill="#52606d">${esc(data.definition.subtitle)}</text>`);
  yTicks.forEach((tick) => {
    const py = y(tick);
    lines.push(`  <line x1="${LEFT}" y1="${number(py)}" x2="${WIDTH - RIGHT}" y2="${number(py)}" stroke="#d9e0e7" stroke-width="1"/>`);
    lines.push(`  <text x="${LEFT - 10}" y="${number(py + 4)}" text-anchor="end" font-family="system-ui, sans-serif" font-size="11" fill="#52606d">${esc(number(tick))}</text>`);
  });
  lines.push(`  <line x1="${LEFT}" y1="${TOP}" x2="${LEFT}" y2="${HEIGHT - BOTTOM}" stroke="#52606d"/>`);
  lines.push(`  <line x1="${LEFT}" y1="${HEIGHT - BOTTOM}" x2="${WIDTH - RIGHT}" y2="${HEIGHT - BOTTOM}" stroke="#52606d"/>`);
  labelIndexes.forEach((index) => lines.push(`  <text x="${number(x(data.points[index].timestamp))}" y="${HEIGHT - BOTTOM + 22}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" fill="#52606d">${esc(dateLabel(data.points[index].date))}</text>`));
  data.definition.series.forEach((series, seriesIndex) => {
    const colour = COLOURS[seriesIndex];
    const coordinates = data.points.map((point) => `${number(x(point.timestamp))},${number(y(point.values[seriesIndex]))}`).join(" ");
    lines.push(`  <polyline data-series="${esc(series.property)}" points="${coordinates}" fill="none" stroke="${colour}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`);
    data.points.forEach((point) => lines.push(`  <circle data-series="${esc(series.property)}" data-date="${point.date}" cx="${number(x(point.timestamp))}" cy="${number(y(point.values[seriesIndex]))}" r="3.5" fill="#ffffff" stroke="${colour}" stroke-width="2"/>`));
  });
  const legendWidth = Math.floor(plotWidth / data.definition.series.length);
  data.definition.series.forEach((series, index) => lines.push(`  <g transform="translate(${LEFT + index * legendWidth} ${HEIGHT - 18})"><line x1="0" y1="-4" x2="22" y2="-4" stroke="${COLOURS[index]}" stroke-width="3"/><circle cx="11" cy="-4" r="3" fill="#ffffff" stroke="${COLOURS[index]}" stroke-width="2"/><text x="29" y="0" font-family="system-ui, sans-serif" font-size="11" fill="#17212b">${esc(series.label)}</text></g>`));
  if (data.definition.xAxisLabel) lines.push(`  <text x="${LEFT + plotWidth / 2}" y="${HEIGHT - 42}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" fill="#17212b">${esc(data.definition.xAxisLabel)}</text>`);
  if (data.definition.yAxisLabel) lines.push(`  <text transform="translate(20 ${TOP + plotHeight / 2}) rotate(-90)" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" fill="#17212b">${esc(data.definition.yAxisLabel)}</text>`);
  lines.push("</svg>", "");
  return lines.join("\n");
}
