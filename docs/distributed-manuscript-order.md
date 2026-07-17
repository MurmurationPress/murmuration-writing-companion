# Distributed manuscript order

## Purpose

Manuscript sequence is distributed across the part and scene notes that own it. A book-wide mutable sequence array is not permanent authority because it becomes a sync hotspot when several devices edit the same manuscript.

## Canonical Markdown

A book note is identified by:

```yaml
type: book
```

A part is a direct child of the book:

```yaml
type: part
parent: "[[BOOK 2 - PLURALITY]]"
manuscript_order_key: C000000000
```

A scene may be a direct child of the book or a child of one part:

```yaml
type: scene
parent: "[[ABSENCE]]"
manuscript_order_key: I000000000
```

`parent` owns containment. `manuscript_order_key` owns sequence only among notes with the same parent.

## Derivation

MWC derives a manuscript by:

1. resolving every canonical parent;
2. requiring parts to belong directly to the book;
3. requiring scenes to belong to the book or one recognised part;
4. grouping notes by resolved parent;
5. sorting each sibling group by its fixed-width order key;
6. walking root entries and each part's child scenes in that order.

The same key may legitimately occur under two different parents. Duplicate keys are invalid only within one sibling group.

## Key format

Keys are ten uppercase base-36 characters using `0-9` and `A-Z`.

The fixed width means ordinary lexical comparison is sufficient. A new key is normally allocated between the previous and next sibling without changing either note. Moving a scene to another part changes `parent` and the key on that scene together.

When there is no remaining lexical gap, MWC may propose a local rebalance. Only the destination sibling group is rewritten, and the preview must show every affected note.

## Write safety

Structural writes:

- reject unresolved Git or sync conflict markers;
- compare the expected file version and frontmatter immediately before mutation;
- write only the moved note for an ordinary reorder;
- read the file back and verify the structural properties;
- roll back all verified earlier writes if a multi-file operation fails;
- provide stale-aware immediate Undo;
- never use recovery history or the editorial store as manuscript authority.

## Legacy migration

A valid legacy `manuscript_order` array may be used once to preserve a reviewed sequence. Keys are allocated independently within each sibling group. The migration canonicalises `type` and `parent`, writes and verifies every child note, then removes the old array as its final write.

When no valid array exists, reviewed deterministic filename/folder order may be used. Ambiguous filename structure blocks migration.

The legacy array must not remain as a second authority after migration.

## External changes and reconciliation

A newly added note with no key is unranked. MWC does not invent its position. A deleted note simply disappears from the derived sibling set rather than leaving a dangling central-array item. Missing keys, duplicate sibling keys, broken parents, cycles and conflict markers are reconciliation conditions and block publishing until resolved.

## Reporting

Reusable reports should follow `parent` to identify the owning book and use a hierarchical value derived from root/part key plus scene key. Numeric `book`, `Part` and `chapter` properties are not compiler authority and may remain temporarily for legacy reports.
