# Events and Time

MWC keeps manuscript timing separate from intrinsic Story World timing.

## Scene `story_date`

`story_date` belongs to a manuscript Scene. It records when the Scene occurs or reveals material in manuscript chronology. Chapter Context normally writes a calendar date:

```yaml
story_date: "2029-06-29"
```

## Event `world_time`

`world_time` belongs principally to Story World Events and records when the fictional-world event itself occurs. Use the Event time editor where possible.

Canonical point:

```yaml
world_entity: event
world_name: Example Event
world_time:
  at: "2029-06-29"
  precision: day
world_participants:
  - "[[Pip]]"
```

Canonical range:

```yaml
world_time:
  from: "2029-06-29"
  until: "2029-07-02"
  precision: day
```

The editor writes `year`, `month`, `day`, `hour`, or `minute` precision. Readers also understand second precision where supplied by valid evidence. ISO-like scalars and numeric four-digit years are supported compatibility forms; legacy mappings may use `date` for `at` and `to` for `until`.

Keep canonical mappings limited to the point/range keys and `precision`. Additional keys such as `source` or `timezone` are preserved, but the shared chronology parser treats mappings with unsupported extra keys as unsuitable for reliable comparison or editing.

## Participants

Use `world_participants` for explicit Event participants:

```yaml
world_participants:
  - "[[Pip]]"
  - "[[Divergent]]"
```

MWC does not infer participants from prose. Old `participants` and `world_participant` fields have uneven compatibility across consumers; use only `world_participants` in new material. Details are in the [Developer and Legacy Appendix](Developer_and_Legacy_Appendix.md).
