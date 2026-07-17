# Existing-manuscript preparation smoke test

Use a clean Git checkpoint or a copied manuscript for the first real-vault test.

## Preparation

1. Build and install Murmuration Writing Companion from `agent/prepare-existing-manuscript`.
2. Open the Manuscript navigator.
3. Select an existing manuscript that still relies partly or wholly on folder and filename structure.
4. Confirm the displayed part and scene order is correct before migration.

## Preview

1. Select the wand action **Prepare existing manuscript** in the navigator header.
2. Confirm the preview identifies the selected book.
3. Inspect several book, part and scene entries.
4. Confirm the proposal includes:
   - `type: book` and `manuscript_order` for the book;
   - `type: part` and `parent: [[Book path]]` for parts;
   - `type: scene` and `parent: [[Part path]]` or `parent: [[Book path]]` for scenes.
5. Confirm path-qualified parent links match the displayed navigator hierarchy.
6. Confirm no file rename, move or deletion is proposed.
7. Confirm existing numeric `book`, `Part` and `chapter` properties are not listed for removal or replacement.

Do not proceed when the preview reports ambiguity or conflicting explicit structure. Correct the named source note first.

## Apply

1. Select **Prepare manuscript**.
2. Wait for the completion notice.
3. Confirm the navigator order and hierarchy have not changed.
4. Inspect the book note and several part/scene notes in Source mode.
5. Confirm unrelated frontmatter and manuscript prose are unchanged.
6. Confirm no filenames or folders changed.
7. Run **Prepare existing manuscript** again and confirm MWC reports that the manuscript is already prepared and writes nothing.

## Undo

Immediately after a fresh preparation:

1. Select the navigator header action **Undo manuscript preparation**.
2. Confirm the exact previous frontmatter is restored across the book, parts and scenes.
3. Confirm the navigator returns to legacy-order presentation.

Repeat preparation, then deliberately edit one prepared note's structural frontmatter before selecting Undo. Confirm Undo refuses to overwrite the later edit and reports that the manuscript metadata changed.

## Reporting

1. Create or open a Base using `docs/manuscript-base-reporting.md`.
2. Confirm `manuscript_book_path` resolves for:
   - a part;
   - a scene inside a part;
   - a direct book-level scene.
3. Sort `manuscript_position` from smallest to largest.
4. Confirm the Base order matches the Manuscript navigator.
5. Confirm no book-specific path is present in the formulas.

## Compiler parity

With the prepared structure unchanged, compile the same book through Codex Press as:

1. PDF;
2. EPUB;
3. Manuscript (Markdown).

Confirm all three retain the approved navigator order and hierarchy.

## Pass condition

The test passes when preparation is previewed, atomic, idempotent and undoable; the reusable Base resolves owning book and sequence without a hard-coded path; and Codex Press consumes the resulting structure unchanged.
