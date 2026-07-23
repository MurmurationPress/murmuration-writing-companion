# Manuscript book creation

The Manuscript navigator can create an authoritative manuscript book as an ordinary Markdown note. The note is the only durable book identity; creation does not write editorial storage, continuity storage, Story World data, plugin settings, parts, scenes, compiler configuration or publishing metadata.

## Authoritative contract

The exact minimal note is:

```yaml
---
type: book
title: "Author-supplied title"
---
```

The title is trimmed and serialized as a safely quoted YAML string. It is not changed to make a filename valid. No heading, parent, manuscript order, status, publishing metadata, compiler metadata, Part or Scene is added.

## Default location and naming

The deterministic default folder hierarchy is:

1. the common direct parent of all recognised book notes, when they share one unambiguous parent;
2. otherwise the parent of the currently selected recognised book;
3. otherwise the vault root.

Placement and filename are convenience only and never manuscript authority. The author may edit the proposed path. The author-visible title retains Unicode and ordinary punctuation after surrounding whitespace is trimmed. Only the proposed filename is sanitized: unsupported filename characters are replaced, unsafe trailing characters are removed, Windows-reserved names are made safe, and `.md` is appended exactly once. The preview explains any change and clearly distinguishes filename from title.

## Collision rules

The live preview shows the final path, exact Markdown bytes, and every missing folder that confirmation would create. It blocks unsafe or absolute paths, traversal and empty segments, unsupported or reserved filenames, existing path items including case-only collisions, file-valued parent segments, and duplicate recognised-book titles. A matching basename in another folder is allowed.

Path comparisons are case-insensitive for portable no-overwrite behaviour. A recognised-title collision compares trimmed titles case-insensitively. The workflow does not introduce global Markdown-basename uniqueness: the same filename in a different folder remains valid unless an existing settled manuscript rule makes the recognised identity ambiguous.

## Stale-confirmation protection

Opening, editing, previewing, cancelling, or closing the modal does not write. Confirmation takes a fresh vault snapshot and repeats title, path, collision, parent-segment, missing-folder, and Markdown serialization checks. It creates only the missing folders displayed in the confirmed preview, takes another snapshot, and revalidates before creating the note without overwrite.

The exact bytes are read back after creation. Overlapping submissions for the same destination share one request. A stale collision stops before the note write. Read-back mismatch cleanup is limited to the exact newly-created `TFile` while its creation-time modification marker proves it has not subsequently changed; pre-existing folders are never removed.

## Metadata recognition, selection, and navigation

Once recognised, the new path is selected through `ManuscriptBookSelectionService`, the navigator refreshes, and the note opens through native Obsidian navigation. The selection is UI scope, not a duplicate book record; restart recognition comes from Markdown.

This explicit selection is shared with Continuity Review, so both surfaces remain coherent. The active Markdown leaf is used only for native navigation and is never consulted as book authority or as the source of selected-book state. No second book identity is stored in navigator state, continuity data, editorial storage, or plugin settings.

Metadata recognition uses a bounded, coalesced retry against the existing authoritative projection. If the note bytes verify but recognition remains delayed, the authored note is preserved and the modal reports the partial success with an **Open note** action. Normal metadata-cache refresh can complete recognition later. A navigation failure likewise preserves a successfully created note and any established selection state.

## Shared boundary

`ManuscriptBookCreation.ts` contains pure title, location, serialization, and validation planning. `ManuscriptBookCreationExecution.ts` owns the testable confirmation sequence. `ObsidianManuscriptBookCreation.ts` adapts that sequence to the vault and metadata projection. This is the reusable creation boundary for later part and scene work; there is no generic creation registry.

Issue #141 remains responsible for Part creation, including its authoritative parent and placement contract. Issue #142 remains responsible for Scene creation, including parent choice and manuscript-order placement. This book-creation work does not pre-implement either workflow, create automatic manuscript templates, configure publishing or compilers, delete books, edit book titles, or create Story World entities.
