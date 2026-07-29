# FEVER Remove Book smoke test

Use disposable Books and manuscript notes. Keep the Obsidian local Trash enabled so restoration can also be checked.

1. Open the Manuscript Navigator, select an empty authoritative Book and open its actions menu with mouse and keyboard. Confirm **Remove Book** is present, keyboard reachable and uses the existing trash icon/menu pattern.
2. Activate **Remove Book**. Confirm the modal names the selected Book, says its Book note will move to Obsidian trash and says no Parts, Chapters or Scenes will be deleted.
3. Cancel. Confirm no file, frontmatter, selection, order key or navigator state changes.
4. Reopen and confirm. Verify only the Book note moves through Obsidian's configured trash behaviour and the navigator refreshes after the move.
5. Restore the note to the same path. Confirm existing deletion/restoration reconciliation recognises it without rewriting editorial data or manuscript structure.
6. For separate disposable Books, assign a Part, a direct Scene and a legacy `document_type: chapter` note. Confirm each blocks removal and the notice identifies the remaining content kind.
7. Confirm every blocking case leaves the Book and all assigned notes byte-for-byte unchanged; no content is detached, promoted, reassigned or cascade-deleted.
8. Leave a confirmation modal open, then externally add or assign a Scene to the Book. Confirm removal is rejected as stale/currently non-empty and nothing moves to trash.
9. Repeat with malformed distributed order, legacy filename order, a deleted/stale Book note and a non-Book note. Confirm removal is unavailable or rejected safely.
10. Simulate a trash failure if practical. Confirm the modal remains usable, the navigator does not falsely refresh and all manuscript notes remain intact.
11. Remove one empty Book from a multi-Book vault. Confirm remaining Book selection, Book/Part/Scene ordering and derived sequence values remain valid without key compaction or frontmatter writes.
12. Recheck **Remove Part** for an empty Part and for a Part containing a Scene. Confirm its #174 wording, blocking and trash behaviour remain unchanged.
