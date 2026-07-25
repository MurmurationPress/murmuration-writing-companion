# Preceding story-date offer

Issue #65 adds an optional Chapter Context action for an active authoritative manuscript Scene whose date aliases are genuinely empty.

## Authoritative-order search

The feature reuses `precedingStoryDate` from #142. It receives the owning Book's authoritative flattened Scene projection and walks backward from the active Scene. Books and Parts never enter the resolver input. Undated, malformed, unsupported and range-shaped preceding values are skipped; the nearest supported explicit point value is offered.

The shared Chapter Context alias contract recognises `story_date`, `storydate` and `narrative_date`. `story_day` is deliberately unrelated and is never read as a date. A target with any non-empty recognised date alias is not treated as genuinely undated, so the offer is not metadata migration or correction.

## Presentation and acceptance

Chapter Context shows a restrained optional block naming the human-readable value and authoritative source Scene. Nothing is written during rendering. The author must choose **Use this date**.

Acceptance rebuilds the manuscript library and requires the reviewed and current proposal to match on:

- active target path, owning Book, direct parent, sparse order key and flattened Scene position;
- target modification state and date-alias fingerprint;
- source path, source position, source property, raw value, canonical value, precision and modification state;
- current manuscript structural safety and nearest-preceding resolution.

Any mismatch blocks the write, refreshes the offer and reports that chronology changed. A manually added target date is never overwritten.

On success, the existing safe Obsidian frontmatter service writes canonical `story_date` to the target Scene only. Empty legacy aliases are removed; unrelated frontmatter and prose remain. The source, siblings, Book, Part, Story World and editorial storage are untouched. Chapter Context, manuscript chronology and Continuity Review then refresh.

## Refresh and independence

The offer is derived on render and is not persisted or cached. Existing active-file, metadata, structural-change and #149 integrity refresh paths therefore recalculate it after order changes, date changes, create, detach, delete, restore, reconciliation and metadata settlement.

An accepted value is ordinary authoritative frontmatter. No source identity, inheritance marker or dependency record is stored. Later source rename, redating or deletion—and later target reorder—cannot cascade into the accepted value. Authors may edit, replace or clear it through the ordinary Story date field; clearing allows a new current offer to appear.

## Relationship to #142 and scope

#142 uses the same resolver to offer a preceding date while creating a new Scene. #65 applies that resolver to an existing active Scene and adds stale-confirmation protection around a target-only edit.

Automatic date arithmetic, next-day calculation, Story World event inference, bulk filling, `story_day` conversion, inherited dates and continuity correction remain out of scope.
