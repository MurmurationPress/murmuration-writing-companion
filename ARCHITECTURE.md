# Architecture

## Companion

User-facing experience.

Responsible for:

- Sidebar
- Dashboard
- Navigation

---

## Editorial

Editorial knowledge.

Responsible for:

- Chapter Notes
- Selected Text Notes
- Editorial Passes
- Checklists

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

Manuscript Markdown remains outside this storage layer. The only deliberate editorial projection into frontmatter is the derived `mwc_open_annotations` reporting property.

---

## UI

Reusable interface components.

Responsible for:

- Cards
- Buttons
- Lists
- Empty states

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
