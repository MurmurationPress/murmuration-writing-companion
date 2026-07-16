# Manuscript Navigator Smoke Test

**Issue:** #84  
**Stack:** #88 → #89

## Purpose

Verify the first read-only left-sidebar Manuscript navigator against a real Obsidian manuscript without changing order, hierarchy or frontmatter.

## Preparation

1. Build the plugin from `agent/manuscript-navigator`.
2. Copy the built plugin files into the PRIME Trilogy vault plugin folder.
3. Reload or re-enable Murmuration Writing Companion.
4. Keep File Order installed; this iteration must coexist with it.

## Open the view

Use either:

- the ribbon icon labelled **Open Manuscript navigator**; or
- the command **Murmuration Writing Companion: Open Manuscript navigator**.

Confirm that the view opens in Obsidian's left sidebar and remains separate from the Writing Companion on the right.

## Book recognition

With a scene from PLURALITY active:

- the owning book is selected automatically;
- the book title is displayed rather than its filename;
- only recognised manuscript material appears;
- Story World, research, publishing and template notes are absent.

When several recognised books exist, use the compact book selector. Close or activate a non-manuscript note and confirm that the last selected book remains selected.

## Hierarchy

Verify both supported structures where available:

### Book with parts

```text
Book
  Part
    Scene
    Scene
```

- parts appear as collapsible groups;
- scenes appear beneath their authoritative parent;
- collapsing a part does not change Markdown;
- activating a scene inside a collapsed part reveals it again.

### Book without parts

```text
Book
  Scene
  Scene
```

- scenes appear directly beneath the book;
- no synthetic or required part is introduced.

## Ordering

Before `manuscript_order` has been adopted:

- the navigator states that it is previewing filename-prefix order;
- the displayed sequence matches the current File Order manuscript;
- ambiguous or unnumbered entries produce structure notices rather than disappearing.

For a test book with explicit `manuscript_order`:

- the navigator follows that list rather than filenames;
- malformed explicit order produces a warning;
- malformed explicit order does not silently fall back to filename order.

## Navigation and active scene

- click a scene title and confirm that the note opens normally;
- modifier-click a scene and confirm that Obsidian opens another leaf/tab;
- the active scene is highlighted;
- switching scenes updates the highlight and scrolls it into view;
- titles come from `title` frontmatter where present;
- numeric filename prefixes are omitted from fallback display titles.

## Metadata tooltip

Hover a scene row, then keyboard-focus its title.

Only available metadata should appear:

- POV;
- story date in readable form;
- chapter status;
- editorial pass.

Confirm that missing values are omitted and that no browser-native duplicate tooltip appears.

## Read-only boundary

During all tests confirm:

- no `manuscript_order` property is created or changed;
- no `parent` property is changed;
- no file is renamed;
- no editorial-store structure is created;
- compiler output is unaffected by this PR.

Compiler adoption and File Order migration remain #86. Drag-and-drop writes remain #85.
