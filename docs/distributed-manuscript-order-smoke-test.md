# Distributed manuscript order smoke test

Use a backed-up manuscript or a clean Git working tree.

## Preparation

1. Install the plugin build from `agent/distributed-manuscript-order`.
2. Open a chapter in the manuscript to be migrated.
3. Open the Manuscript navigator and confirm the displayed legacy order is correct.
4. Select **Prepare existing manuscript** from the navigator header or command palette.
5. Review the complete preview. It should show:
   - `type: part` or `type: scene` where required;
   - canonical `parent` links;
   - one `manuscript_order_key` on every part and scene;
   - removal of `manuscript_order` from the book note;
   - no removal of numeric `book`, `Part` or `chapter` reporting properties.
6. Cancel once and confirm no Markdown files changed.
7. Open the preview again and choose **Prepare manuscript**.

## Structural verification

Confirm:

- the book note has `type: book` and no `manuscript_order` array;
- each part has `type: part`, `parent: [[Book]]` and a ten-character key;
- each scene has `type: scene`, the correct part/book parent and a ten-character key;
- sibling keys sort in the same order displayed by the navigator;
- identical key values under different parents are allowed;
- the navigator order is unchanged from before migration.

## Sync-hotspot verification

1. Commit or discard the migration diff so the working tree is clean.
2. Move one scene earlier within its current part.
3. Inspect the Git diff.

Expected result: only the moved scene note changes, and only its `manuscript_order_key` changes.

4. Move the same scene into another part.
5. Inspect the Git diff.

Expected result: only that scene note changes; `parent` and `manuscript_order_key` change together.

A book-wide array must not be created or rewritten.

## Undo verification

After one move, use the navigator's Undo control. Confirm the changed note returns to its exact earlier parent and key. Edit that note manually after a move, then try Undo; Undo must refuse rather than overwrite the later edit.

After preparation, use **Undo manuscript preparation** before making other metadata edits. Confirm the old frontmatter is restored, including the legacy array where one existed.

## Invalid authority checks

On a temporary copy:

- remove one scene's key;
- make one key lowercase or the wrong length;
- copy a sibling's key onto another sibling;
- break a parent wikilink;
- insert Git conflict markers into structural frontmatter.

MWC should show structural diagnostics. Codex Press should block output before format selection. It must not use filename order to conceal partial distributed metadata.

## Compiler parity

With valid distributed metadata, compile the manuscript as:

- PDF;
- EPUB;
- Manuscript Markdown;
- DOCX.

Confirm the same direct scenes, parts and part scenes appear in the same order in all four outputs.
