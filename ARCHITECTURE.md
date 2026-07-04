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
