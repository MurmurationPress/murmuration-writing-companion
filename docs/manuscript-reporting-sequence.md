# Manuscript reporting sequence

MWC projects the Manuscript Navigator's authoritative hierarchy and order into ordinary Scene frontmatter so Obsidian Bases can sort and report manuscript position.

The managed properties are:

```yaml
manuscript_sequence: "02.05.007"
book_scene_number: 31
series_scene_number: 72
```

- `manuscript_sequence` is a zero-padded lexical key: Book position, root position within the Book, then Scene position within that root.
- For normal Book → Part → Scene structure, the middle segment is the Part position.
- A Scene directly under a Book uses `000` for the final segment, for example `02.01.000`. This preserves mixed book-level Navigator order without inventing a Part.
- `book_scene_number` is continuous within the Book.
- `series_scene_number` is continuous across Books in the Navigator library order.

These values are derived and disposable. `parent` and `manuscript_order_key` remain authoritative. Authors should not edit the generated values manually.

MWC reconciles the projection when the manuscript library settles and on plugin startup. It performs no frontmatter write when all three current values already match. Reordering, reparenting, insertion, deletion, restoration or hierarchy repair regenerates the affected projection. Renaming alone does not change the values.

Scenes whose structure cannot be represented safely, such as unsupported nested Part hierarchies, receive no generated sequence values. Any stale managed values are removed rather than preserving an invented position. Files in Obsidian local Trash are excluded.

Disabling or removing MWC leaves the last generated properties in Markdown. Re-enabling MWC reconciles them against current Navigator authority. They may also be deleted manually as a disposable projection; the next reconciliation recreates valid values.
