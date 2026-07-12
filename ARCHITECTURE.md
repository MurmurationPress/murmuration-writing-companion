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

## Chapter heading

The Companion derives the displayed chapter heading from the Markdown `title`
property. When no usable title is present, it falls back to the file basename.
The heading is a presentation of manuscript metadata and never renames the file.
Metadata-cache changes refresh the heading without introducing a second stored
copy.

## Chapter Context write-through

Chapter status, editorial pass and change summary are edited in the Companion but
remain ordinary Markdown frontmatter. The plugin updates an existing recognised
property alias when present, otherwise it creates the canonical properties
`chapter_status`, `editorial_pass` and `change_summary`. Empty values remove the
property. No copy is stored in the editorial data model.
