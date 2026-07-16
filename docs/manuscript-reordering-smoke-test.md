# Manuscript Reordering Smoke Test

**Issue:** #85  
**Branch:** `agent/manuscript-reordering`  
**PR:** #90

## Safety boundary

This iteration writes authoritative manuscript structure, but Codex Press does not consume `manuscript_order` until #86.

Perform the first test in a disposable manuscript copy or after a clean Git checkpoint. Do not use this branch to make final trilogy structure changes until PDF, EPUB and review compilation have been aligned and verified.

## Preparation

1. Check out `agent/manuscript-reordering`.
2. Build and copy the plugin into the test vault.
3. Reload or re-enable Murmuration Writing Companion.
4. Open the Manuscript navigator in the left sidebar.
5. Confirm that the displayed legacy order matches the intended current book before moving anything.

## First adoption

On a book still using filename-prefix order:

1. Drag one scene to a different position within its current part.
2. Confirm that the **Adopt manuscript order** explanation appears.
3. Cancel once and verify that no frontmatter changes.
4. Repeat the move and choose **Adopt and reorder**.

Verify:

- the book receives one `manuscript_order` list;
- the list uses path-qualified wikilinks;
- the requested move is already represented in that first authoritative list;
- filenames remain unchanged;
- scene prose and editorial storage remain unchanged;
- the navigator no longer displays the legacy-order notice.

If filename-order diagnostics are present, adoption must be blocked until they are reviewed.

## Same-part scene move

Move a scene earlier and later within one part.

Verify:

- only `manuscript_order` changes;
- the scene's `parent` property is not added or changed;
- the scene remains open and highlighted;
- the insertion marker clearly shows before or after placement.

## Cross-part scene move

Drag a scene into the middle of another part row, or use its **Move** menu.

Verify:

- `manuscript_order` reflects the new reading position;
- the moved scene receives or updates one authoritative `parent` wikilink;
- legacy numeric `Part` metadata, filenames and folders are not rewritten;
- the navigator rebuilds the scene beneath the new part;
- dropping before or after a part places the scene at book level rather than inside the part.

## Part move

Move a complete part before or after another top-level part.

Verify:

- the part and all its scenes move as one block;
- contained scene order is preserved;
- scene parent properties do not change;
- attempting to drop a part on one of its descendants is blocked.

## Undo

After each move:

1. use the visible **Undo** action;
2. repeat a move, keep keyboard focus inside the navigator and press `Ctrl+Z` or `Cmd+Z`.

Verify:

- a same-part undo restores the previous `manuscript_order`;
- a cross-part undo restores both order and parent together;
- no intermediate half-restored structure is visible;
- a second successful move replaces the previous one-step Undo action.

## Stale Undo protection

1. Make a move.
2. Before using Undo, edit the book's `manuscript_order` or the moved scene's `parent` directly in Markdown.
3. Use Undo.

Verify that MWC refuses the stale undo, reports that the structure changed, and preserves the later manual edit.

## Keyboard access

- Focus a scene or part title and use `Alt+ArrowUp` or `Alt+ArrowDown` for sibling movement.
- Tab to the compact **Move** button and open it with the keyboard.
- Move a scene to another part through the menu.

Verify that keyboard moves use the same confirmation, validation, write and undo behaviour as drag-and-drop.

## Invalid and failure cases

Confirm that MWC blocks or safely reports:

- a drop onto the same entry;
- a part dropped inside another part;
- a part dropped beneath one of its scenes;
- malformed explicit `manuscript_order`;
- a target that changed or disappeared before the write;
- a partial write failure, with the first structural write rolled back.

## Completion boundary

Do not remove File Order or numeric filename prefixes during this test. Their retirement, and all compiler adoption, remain #86.
