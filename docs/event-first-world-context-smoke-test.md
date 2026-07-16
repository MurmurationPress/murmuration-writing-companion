# Event-first World Context Smoke Test

Use a representative PLURALITY chapter with:

- a POV wikilink;
- at least one explicitly referenced event with `world_time`, `world_status` and `world_summary`;
- at least two explicitly referenced supporting entities;
- one supporting entity with a provisional or unresolved status.

## Hierarchy

- Open the chapter and expand World Context.
- Confirm Events appears first even when the event is later in the stored `world_context` list.
- Confirm each event keeps its name, authoritative date, status and summary.
- Confirm no relative before/after calculation appears yet.

## POV

- Confirm the POV character remains visible in Chapter Context.
- Remove that character from `world_context` and confirm it is not duplicated in World Context.
- Add the character explicitly to `world_context` and confirm it appears once under Characters.

## Supporting entities

- Confirm characters, organisations, locations, technologies and other supporting entities appear as compact linked names rather than full summary cards.
- Hover a supporting link and confirm Obsidian's page preview opens when the Page Preview core plugin is enabled.
- Move the pointer away and confirm the preview closes normally.
- Tab to a supporting link and confirm focus remains visible and requests the same native preview where supported.
- Activate the link with mouse and keyboard and confirm the authoritative Story World note opens.

## Preservation

- Confirm merely opening, hovering, focusing and navigating World Context does not change chapter frontmatter, Story World notes or editorial storage.
- Confirm unresolved explicit references remain a quiet diagnostic rather than interrupting the review.
