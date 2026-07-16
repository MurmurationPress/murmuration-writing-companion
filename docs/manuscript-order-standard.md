# Manuscript Order Standard

**Status:** Initial contract for #83  
**Parent milestone:** #82 — Manuscript structure and scene order

## Purpose

The manuscript order standard gives a recognised book one explicit, portable reading sequence. The same sequence is intended to power:

- the left-sidebar Manuscript navigator;
- drag-and-drop structural editing;
- PDF, EPUB and review compilation;
- previous/next scene navigation;
- #65's nearest preceding dated-scene lookup;
- later provenance-aware Story World authoring.

The standard removes filename order, filesystem order and recently opened files from the authority model.

## Authority split

Two ordinary Markdown concepts have deliberately separate ownership:

1. **Sequence** belongs to the recognised book note through `manuscript_order`.
2. **Containment** belongs to each part or scene through its existing `parent`, `part_of`, `manuscript_parent` or `up` relationship.

The order list does not duplicate hierarchy. Parent metadata does not imply sibling order.

Neither sequence nor containment is copied into MWC editorial storage.

## Book property

A recognised book may define:

```yaml
manuscript_order:
  - "[[Parts/EXPERIMENT]]"
  - "[[Scenes/Domestic Distance]]"
  - "[[Scenes/Tobias in the Wilderness]]"
  - "[[Parts/CONTAINMENT]]"
  - "[[Scenes/Prime Without Interpreter]]"
```

### Rules

- `manuscript_order` is a YAML list.
- Every item is an ordinary Obsidian wikilink string.
- Path-qualified links are preferred when names are ambiguous.
- Display aliases are permitted and do not change identity.
- A listed entry must resolve to a recognised part or scene owned by the same book.
- Each resolved note appears at most once.
- The list is flat and records reading sequence across the whole book.
- Parts appear at their intended reading position before their contained material.
- The list may include a scene whose parent is the book directly.

A scalar value is not silently interpreted as a one-item list. Malformed explicit order blocks fallback and is reported for correction.

## Why the list is flat

A flat sequence keeps sequence and containment independent:

- moving a scene within the same part changes only `manuscript_order`;
- moving a scene into another part changes `manuscript_order` and that scene's parent;
- moving a part preserves the relative order of its contained scenes as one structural operation;
- compilers can consume one deterministic reading sequence without recursively interpreting nested YAML.

The navigator derives its tree from the flat list plus parent relationships.

## Recognition and resolution

MWC resolves wikilinks using ordinary Obsidian link semantics relative to the book note. The domain service receives canonical records containing:

- vault path;
- basename;
- displayed title;
- kind (`book`, `part`, `scene` or preserved `other`);
- owning-book path;
- parent path.

Only parts and scenes participate in the initial manuscript sequence. General vault files, Story World notes, research, templates and publishing material remain outside it.

## Diagnostics

The contract reports structural problems without silently rewriting Markdown:

- invalid property shape;
- malformed wikilink;
- unresolved reference;
- duplicate entry;
- entry owned by another book;
- recognised part or scene omitted from explicit order;
- listed scene whose parent is absent from the order;
- parent cycle;
- ambiguous legacy filename order.

A diagnostic does not create a second authority. It explains why the current Markdown cannot yet produce a fully trusted tree.

## Legacy fallback and migration

Before a book adopts `manuscript_order`, MWC may derive a temporary migration proposal from numeric filename prefixes.

The fallback:

- groups siblings by authoritative parent;
- sorts numeric prefixes within each sibling group;
- walks the hierarchy depth first;
- places unnumbered or structurally disconnected entries into review rather than dropping them;
- marks missing or duplicate sibling prefixes as ambiguous;
- never writes Markdown automatically.

Fallback is a compatibility and migration mechanism, not a permanent authority.

When an explicit but malformed `manuscript_order` exists, MWC does not hide the error by reverting to filename order.

## Rename and move behaviour

When MWC performs or observes a note rename, its order-rewrite helper can update matching wikilink targets while preserving display aliases.

Example:

```yaml
- "[[Parts/1 EXPERIMENT|Experiment]]"
```

may become:

```yaml
- "[[Parts/EXPERIMENT|Experiment]]"
```

The write-through integration remains responsible for using Obsidian's file APIs, updating only the authoritative book note, and reporting any failed write. The domain contract itself does not rename files.

## Previous and next scene

Previous and next scene are derived from the ordered entries after non-scene structural nodes are removed. This means the lookup crosses part boundaries naturally.

The result is rebuildable and is never stored as a relationship.

## Initial scope boundaries

This contract does not yet provide:

- a left-sidebar view;
- drag-and-drop;
- scene creation or deletion;
- automatic prefix removal;
- compiler integration;
- automatic date changes after reordering;
- prose-derived order or hierarchy;
- hidden repair of malformed metadata.

Those behaviours belong to #84, #85, #86 and #65.