# Architecture

## Companion

User-facing experience.

Responsible for:

- Sidebar
- Dashboard
- Navigation

The Companion uses progressive disclosure for supporting material. Chapter Context, Editorial Passes and Chapter Notes collapse independently, while Annotations remains open as the active work queue. Collapsed summaries are projections of the same frontmatter and editorial models already rendered by the expanded sections.

---

## Editorial

Editorial knowledge.

Responsible for:

- Chapter Notes
- Selected Text Notes
- Editorial Passes
- Checklists

Editorial-pass completion is represented as an append-only event history on each chapter record. Valid events identify the pass, action (`completed` or `reopened`), timestamp and stable event ID. The seven-item checklist is derived by replaying valid unique events in storage order. Reopening changes current checklist state without erasing earlier completion events.

The current author-facing `editorial_pass` property is separate Markdown metadata. It identifies the present editing focus; it is not copied into the editorial store and has no automatic relationship with checklist completion.

---

## Storage

Persistence.

Responsible for:

- Saving
- Loading
- Migration
- Recovery
- Schema versioning

The authoritative editorial store is the versioned vault file:

```text
.murmuration/writing-companion/editorial-data.json
```

The storage engine is separated from Obsidian through a small file-system adapter so serialization, migration, recovery and failure behaviour can be tested with an in-memory implementation.

Writes use three related paths:

- `editorial-data.json` — current authoritative data;
- `editorial-data.json.tmp` — complete candidate written before publication;
- `editorial-data.json.bak` — previous complete version retained after a successful replacement.

A malformed current file may be moved to `editorial-data.json.corrupt` only when a valid temporary or backup file has already been verified and is being restored. Unsupported newer schema versions are never replaced or downgraded.

The plugin's historical Obsidian `data.json` is a migration source only when no portable file exists. After the first successful migration the vault file is authoritative. The legacy source is not deleted automatically.

Editorial-pass history is a backward-compatible page field. Missing history behaves as an empty checklist. If an existing value is malformed, it is wrapped into the append-only history array and retained; invalid entries are ignored by checklist derivation rather than deleted.

Deleting a chapter soft-deletes its editorial record by adding `deletedAt` while leaving the Chapter Note, annotations and editorial-pass history intact. A create event at the same path restores the record. Startup reconciliation performs the same comparison against the vault so offline and sync-driven file changes reach the same state.

An active rename may reuse a path occupied by a soft-deleted record. Before the incoming chapter is placed there, the deleted record is moved into the store's `orphanedPages` archive with its original path and deletion timestamp. This prevents invisible stale records from blocking valid manuscript operations without discarding editorial history. Permanent cleanup is intentionally separate from file deletion.

Manuscript Markdown remains outside this storage layer. The only deliberate editorial projection into frontmatter is the derived `mwc_open_annotations` reporting property.

---

## UI

Reusable interface components.

Responsible for:

- Cards
- Buttons
- Lists
- Empty states

The editorial-pass checklist uses native checkboxes in canonical workflow order. Completion timestamps are shown quietly beside completed items, and the section reports overall completed progress without becoming a separate dashboard.

Collapsible section headings use native buttons with `aria-expanded` and `aria-controls`; hidden section content is removed from the tab order by the platform. Section states are independent rather than accordion-controlled.

Expanded/collapsed state is a local per-vault UI preference stored through browser local storage. The key includes the vault resource root, parsing falls back safely to defaults, and storage failure degrades to session-only state. These preferences are deliberately excluded from manuscript frontmatter, plugin editorial data and the portable vault store.

## Derived reporting properties

`mwc_open_annotations` is a projection of the annotation store into chapter
frontmatter for Obsidian Bases and other native reporting tools. The editorial
store remains authoritative. Manual changes to the property do not create,
resolve, or otherwise modify annotations; the plugin reconciles the projection
from stored annotation state.

## Annotation lifecycle

Open and resolved annotations remain in the same editorial store. The Companion
projects them into separate active and resolved views; reopening changes only the
annotation status and the derived `mwc_open_annotations` frontmatter count.

## Chapter Context write-through

Title, POV, story date, chapter status, editorial pass and change summary are
edited in the Companion but remain ordinary Markdown frontmatter. The plugin
updates an existing recognised property alias when present, otherwise it creates
the canonical property name. Empty values remove the property. No copy is stored
in the editorial data model.

Title is presented as the first Chapter Context field rather than as a separate
heading. A missing title may use the file basename as placeholder guidance, but
the basename is never written automatically and changing the title never renames
the file.

POV retains its Markdown source value for editing and renders a clickable preview
for Obsidian links. Story date uses an ISO date control when the stored value is
compatible and falls back to text editing for existing non-ISO values. Metadata
cache changes refresh the displayed values without introducing a second source of
truth.
