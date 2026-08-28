# Derived Artefacts

Derived artefacts are portable files generated from authoritative Markdown properties. The Markdown notes remain canonical; an SVG is a disposable projection that can be regenerated or deleted without losing source data. MWC does not read generated SVGs as data.

## Define a line chart

Create a Markdown note with frontmatter like this generic example:

```yaml
---
world_entity: derived-artefact
artefact_type: line-chart
source: "Research/Measurements"
x: measured_on
series:
  - property: water_level
    label: Water level
  - property: flow_rate
    label: Flow rate
window: 12 months
end: 2029-05-29
title: River measurements — rolling twelve months
subtitle: Field observations
x_axis_label: Measurement date
y_axis_label: Recorded value
output: "Visualisations/River measurements — 2029-05-29.svg"
---
```

The source must be a vault folder. Every Markdown file below it is one observation and must contain a valid `YYYY-MM-DD` value for the property named by `x`, plus a YAML number for every declared series. A series requires unique `property` and human-readable `label` values. One to four series are supported.

`title`, `source`, `x`, `series`, and an `.svg` `output` path are required. `subtitle`, `x_axis_label`, `y_axis_label`, `start`, `end`, and `window` are optional. A window is a positive number of `months` or `years`, such as `12 months`.

MWC rejects the whole definition if a source observation is incomplete or malformed. It does not skip points, interpolate, aggregate, sample, or smooth them.

## Dates and rolling windows

Observations are sorted by their x date, with source path as the stable tie-break for equal dates. Their horizontal positions reflect real elapsed time, so irregular event-driven observations remain visible.

The rolling window ends at `end`. If `end` is omitted, it ends at the latest source observation. Window boundaries are inclusive and use calendar month/year subtraction. If `start` is also present, MWC uses the later of the explicit start and rolling-window start; `end` remains the upper bound. This intersects the configured constraints without sampling the observations.

Use explicit `end` and dated output filenames for stable historical snapshots.

## Generate and embed

To generate one chart, open its definition note and run **Generate derived artefact** from the Command Palette. Run **Generate all derived artefacts** to regenerate every note marked `world_entity: derived-artefact`.

Generation creates missing parent folders and replaces an existing SVG at the output path. Invalid definitions do not write output or modify source/definition notes. Generated files are standalone SVG and do not require MWC to remain active. Embed one with normal Obsidian syntax:

```text
![[Visualisations/River measurements — 2029-05-29.svg]]
```
