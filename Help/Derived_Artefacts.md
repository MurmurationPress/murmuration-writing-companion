# Derived Artefacts

Derived artefacts are portable files generated from authoritative Markdown properties. The Markdown notes remain canonical; generated files are disposable projections that can be regenerated or deleted without losing source data. MWC supports `line-chart` SVG projections and `state-table` Markdown projections. It does not read either format back as canonical data.

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

## Define a state table

A state table compares the current observation at an endpoint with the immediately preceding canonical observation. Define one with generic frontmatter like this:

```yaml
---
world_entity: derived-artefact
artefact_type: state-table
source: "Research/Measurements"
x: measured_on
end: 2029-05-29
parameters:
  - property: water_level
    label: Water level
  - property: flow_rate
    label: Flow rate
output: "Visualisations/River state — 2029-05-29.md"
---
```

`source`, `x`, `parameters`, and a `.md` `output` path are required. Each parameter has a unique property and a label. Declared parameter order becomes table row order. `end` is optional for consistency with line charts; when omitted, MWC uses the latest valid canonical observation.

MWC sorts every Markdown observation below `source` by the `x` date, using source path as the stable tie-break for equal dates. Current means the latest observation on or before `end`. Previous means the immediately preceding observation in that canonical sequence—not the previous chapter and not a sampled or aggregated value. Adding an intermediate observation therefore changes previous and delta on regeneration.

For every parameter, delta is `current - previous`. Values use deterministic signed two-decimal formatting: positive values and zero include `+`, negative values retain `-`. If current is the first observation, previous and delta are em dashes because MWC does not invent history.

Generated state tables are ordinary portable Markdown:

```markdown
|parameter|current|previous|Δ|
|---|---:|---:|---:|
|Water level|+0.94|+0.92|+0.02|
|Flow rate|+0.33|+0.37|-0.04|
```

MWC adds a deterministic HTML ownership comment to the generated file. This allows safe regeneration without treating an unrelated Markdown note as disposable output. A state-table output may not collide with a source note, definition note, folder, or unrelated Markdown file.

## Generate and embed

To generate one projection, open its definition note and run **Generate derived artefact** from the Command Palette. Run **Generate all derived artefacts** to regenerate every note marked `world_entity: derived-artefact`. Generate-all dispatches each mixed `line-chart` or `state-table` definition to its renderer; one invalid definition is reported without preventing valid definitions from being generated.

Generation creates missing parent folders and replaces an owned existing projection at the output path. Invalid definitions or malformed source observations do not write output or modify source/definition notes. Generated files do not require MWC to remain active. Embed one with normal Obsidian syntax:

```text
![[Visualisations/River measurements — 2029-05-29.svg]]
```

Markdown state tables can be embedded the same way, using their `.md` path.
