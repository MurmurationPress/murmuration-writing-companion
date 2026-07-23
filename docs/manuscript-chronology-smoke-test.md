# Manuscript chronology smoke test

Use a disposable copy of a vault containing a prepared distributed manuscript. Keep the Writing Companion open on a scene in the test book.

1. Give three consecutive scenes valid `parent` and `manuscript_order_key` values. Set their dates to `2028`, missing, and `2027` respectively.
   - Book Review opens on the first findings and its header shows **Continuity 2** with a restrained indicator.
   - The nested **Continuity** block is open with two review items.
   - One item reports the bounded undated run for the middle scene.
   - One item reports the final scene as earlier than the nearest preceding dated scene.
   - Every Open button navigates to the named manuscript note.
   - Collapse Book Review, edit either scene without removing both findings, and confirm it stays collapsed while the updated count remains visible in its header.
   - Use Tab then Enter or Space to reopen Book Review, including with the sidebar narrowed.
   - Select a different scene in the same editor pane and confirm Chapter Context, World Context, and Book Review all follow the newly opened scene/book without reopening the Writing Companion.
2. Change the final scene to `2028` without activating it.
   - Book Review refreshes and both observations disappear.
3. Set the final scene to `2027-06` while the first dated scene is `2027`.
   - No reversal appears because the intervals overlap.
4. Set a scene date to `2027.5`, then to `{ at: 2027 }` in YAML.
   - Each form produces a source-data review, not a reversal.
5. Remove the middle scene's date at the beginning or end of the book instead of between dated anchors.
   - No coverage observation appears.
6. Move a scene across a part boundary using the Manuscript Navigator.
   - Book Review refreshes and evaluates the new flattened authoritative order.
7. Introduce a duplicate sibling `manuscript_order_key`.
   - Manuscript chronology observations disappear while the structural order is unsafe.
   - The existing manuscript structure diagnostic remains available for reconciliation.
8. Restore a unique valid key.
   - Chronology observations return without restarting the plugin.

The smoke test must not create editorial-store entries or alter Markdown except for the deliberate test metadata edits.

## Intentional non-linear chronology

Flashbacks, framed narratives and other intentionally reordered scenes remain valid manuscript structures. A proven reversal is therefore an editorial review concern, not an error. #131 does not add an ignore or dismissal mechanism and never changes manuscript Markdown to suppress a finding.

Portable editorial dispositions such as **intentional**, **deferred** and **resolved** belong to #134. That issue should follow #131 immediately so authors can prevent repeated noise from reviewed intentional chronology without altering authoritative manuscript metadata.
