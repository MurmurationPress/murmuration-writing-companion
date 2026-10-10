# Book scene reporting snapshots

Use **Renumber book scenes** from the command palette when you want to refresh a Book's reporting numbers. The active Book, Part or Scene determines the Book. Without an unambiguous context, choose a Book in the picker. The command checks only that Book's indexed structural notes, reports progress, offers Cancel, and reports how many files changed. An unchanged repeat writes no files.

**Scene numbers out of date** appears in the status bar for the active Book. Its tooltip names the Book and path; clicking it runs the same command. No Book context means no indicator. The indicator compares the saved snapshot with the settled Navigator hierarchy and reporting properties, including after reopening Obsidian. Ordinary prose, POV, dates, annotations and renames that preserve structure do not invalidate it. Insertion, deletion, restoration, reordering, parentage changes, cross-Book moves and external edits to reporting properties can invalidate it. A move between Books makes both snapshots stale; refresh each Book explicitly.

Editing, navigation, scene creation, deletion, restoration, movement, startup, preparation and index reconciliation **never automatically populate, renumber or remove reporting fields**. There is no delayed background reporting writer. Preparation only changes its reviewed structural properties and assets; its exact-content Undo remains available after explicit renumbering.

## Retained reporting fields and format migration

A refreshed Scene has, for example:

```yaml
manuscript_sequence: "0000000005.0000000007"
book_scene_number: 27
```

- `book_scene_number` counts Scenes continuously from 1 within this Book in authoritative Navigator traversal order. Parts do not increment it.
- `manuscript_sequence` now has **two ten-digit decimal segments**: root position within the Book, then Scene position inside that root. Both start at 1; a Scene directly under the Book has a final segment of `0000000000`. The common root position preserves lexical order when direct Scenes and Parts are interleaved. Fixed widths also preserve order above the old 99-root/999-Scene limits.
- There is no global Book ordinal, series order or cross-Book offset. Book titles do not determine numbering.

Previously the key had three segments, such as `02.05.007`, beginning with a library-wide Book position. Existing files keep that old snapshot until an explicit refresh. Startup and upgrades do not migrate it. The first selected-Book refresh replaces the format for that Book only. A cancelled or failed refresh may leave mixed old/new values: keep treating that Book's report as stale and rerun the command after resolving the reported problem.

### Bases and generic report consumers

Filter to one Book's actual manuscript membership before sorting `manuscript_sequence` ascending as **Text**, or `book_scene_number` ascending as **Number**. Two different Books can legitimately have identical keys and scene numbers. For combined reports, group/filter by an authored Book identity and choose your own Book ordering; these fields provide no series order. Do not filter by the old first-segment Book prefix or hard-code a supposed first Book.

Use your report's explicit membership filter (for example a Book-specific folder filter if your project actually keeps all that Book's Scenes there). A direct `parent` filter alone misses Scenes inside Parts. Sorting every Scene by `manuscript_order_key` alone mixes separate sibling groups. Detached notes may retain old snapshots and must be excluded by membership, not by presence of a reporting value. After structural edits, renumber before relying on a Bases report, chart/table property, Dataview query or Codex Press `=this.PROPERTY` expression that reads these persisted values. Generic consumers display stored snapshots, not live numbering.

Navigator order and Codex Press structural assembly continue to use `parent`, resolved hierarchy and sibling-local `manuscript_order_key`; they work while reporting values are absent or stale. Reporting values must never be used to repair structural authority.

## Snapshot metadata and restart safety

Explicit refresh also assigns a disposable `mwc_scene_numbering_token` to each Part/Scene and writes `mwc_scene_numbering_snapshot` on the Book. The snapshot is a JSON string `[1, roots]`; each root/child is `[kind, token, children]`. `1` is the snapshot schema version. Tokens have no narrative meaning and are not manuscript IDs or ordering authority. They let comparison recognise membership and parentage without depending on filenames, including renames with automatic link updates disabled. The Book snapshot detects removal of a final Scene even after restarting, when all remaining numbers could still match.

These properties travel with Markdown, contain no prose or editorial decisions, and may be deleted and regenerated with the command. Regeneration may assign different disposable tokens. Missing/duplicate tokens or an unknown snapshot version are stale. The Book snapshot is committed last; final verification rereads the selected scope. No snapshot state is automatically persisted in plugin settings.

A failed, cancelled, protected or concurrently changed run is not reported current. Committed partial changes are retained; the next explicit run repairs only differences. Unload prevents later mutations but cannot revoke a host write already committed. Notes protected by exact preparation Undo are left untouched. Resolve the reported issue or intentionally edit the restored note before retrying; numbering does not override restoration protection.

Invalid keys, unsupported nesting and unresolved selected structure must be repaired first. An orphan with a saved reporting token can be attributed to its Book snapshot. Previously unnumbered unassigned notes have no provable Book scope, so renumbering conservatively asks you to resolve them before declaring a snapshot current. Trash is excluded. No unrelated Book is modified or projected for numbering.

## Retired series fields

`series_scene_number` is obsolete and no longer calculated or supported for reporting. An explicit selected-Book refresh removes this MWC-owned field from that Book's indexed Book, Parts and Scenes in the same minimal frontmatter update. Untouched Books, detached notes and Trash retain inert old fields until deliberately addressed; there is no startup, upgrade or vault-wide cleanup.

The requested alias `manuscript_series_number` has no writer or ownership evidence in the repository/history audit. It is preserved as an unrelated authored property, including by preparation comparison/Undo protections. It is not interpreted as a supported MWC reporting field. Existing dedicated series reports need author-defined replacement ordering.

The updated #260 requirements supersede the automatic reporting contract from #168. Draft #257 was reviewed as a consumer inventory, not adopted as an implementation or merged prerequisite. There is no automatic/manual mode switch, and preparation from #261 cannot invoke the reporting writer. Older installed MWC versions can still automatically rewrite their old fields; update participating installations before relying on manual snapshot semantics.
