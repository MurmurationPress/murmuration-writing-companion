# Temporal Presentation Smoke Test

## Purpose

Verify #69 in a real vault without changing authoritative chapter or Story World Markdown.

## Preparation

Use a chapter with an ISO `story_date` and an explicitly referenced Story World event.

```yaml
story_date: 2026-07-15
world_context:
  - "[[The Article]]"
```

Use an event note with structured time.

```yaml
world_entity: event
world_name: The Article
world_status: confirmed
world_time:
  from: 2026-07-16T14:22:37+01:00
  precision: minute
```

## Expected result

The event card shows:

- `Thursday, 16 July 2026, 14:22`
- `1 day before The Article`

The source remains exactly:

```yaml
from: 2026-07-16T14:22:37+01:00
precision: minute
```

## Precision checks

Change only `precision` and confirm:

- `year` → `2026`
- `month` → `July 2026`
- `day` → `Thursday, 16 July 2026`
- `hour` → `Thursday, 16 July 2026, 14:00`
- `minute` → `Thursday, 16 July 2026, 14:22`
- `second` → `Thursday, 16 July 2026, 14:22:37`

The Companion must never show finer detail than the declared precision.

## Relative timing checks

Set chapter `story_date` to:

- `2026-07-15` → `1 day before The Article`
- `2026-07-16` → `On the day of The Article`
- `2026-07-18` → `2 days after The Article`

## Offset preservation

Use:

```yaml
world_time:
  at: 2026-07-16T00:30:00+14:00
  precision: minute
```

The card must show `Thursday, 16 July 2026, 00:30`. It must not shift to another date or clock time because of the computer's timezone.

## Conservative cases

- A range with both `from` and `until` displays as a range and does not show a relative-day label.
- Year-only and month-only events do not show a relative-day label.
- An unknown precision value preserves the ISO text rather than inventing a human precision.
- Missing or malformed values are omitted quietly.

## Authority check

After viewing, switching chapters and reopening Obsidian, confirm that no formatted date or relative label has been written to:

- chapter frontmatter;
- Story World notes;
- `.murmuration/writing-companion/editorial-data.json`.
