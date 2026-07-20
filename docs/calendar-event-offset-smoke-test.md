# Calendar event offset smoke test

Use a backed-up vault and a chapter whose `world_context` includes at least one dated Story World event.

## Baseline example

Create or use an event with:

```yaml
world_entity: event
world_name: Robin is Born
world_time:
  at: 2027-09-23
  precision: day
```

Use a chapter with:

```yaml
story_date: 2029-06-28
world_context:
  - "[[Robin is Born]]"
```

Open **World Context** in the Writing Companion. The event card must continue to show the exact formatted event date.

## Presentation modes

Use the compact **Intervals** selector above the event cards.

- **Automatic**: `1 year, 9 months, 5 days after Robin is Born`
- **Calendar interval**: `1 year, 9 months, 5 days after Robin is Born`
- **Total months**: `21 months, 5 days after Robin is Born`
- **Total days**: `644 days after Robin is Born`

Switching modes must change no Markdown file and no editorial-store data. Git status should remain clean.

## Review checks

- An interval shorter than one calendar month remains expressed in days in Automatic mode.
- An interval of several months but less than a year uses months and remaining days in Automatic mode.
- A same-date chapter reads `On the day of Robin is Born`.
- A chapter before the event uses `before`; a chapter after it uses `after`.
- Changing `story_date` refreshes the label immediately.
- Changing the event's authoritative `world_time` refreshes the label immediately.
- The selected mode persists after closing and reopening Obsidian in the same vault.
- The exact total-day form remains in the relative label's accessible name when another mode is displayed.

## Month-end check

For an event on `2026-01-31` and a chapter on `2026-02-28`, Calendar interval mode must show `1 month after ...`, not `28 days` or an invalid February date.

## Precision boundary

Events with only year or month precision, ranged events, malformed dates and chapters without a usable exact `story_date` must not display a derived day-level interval.
