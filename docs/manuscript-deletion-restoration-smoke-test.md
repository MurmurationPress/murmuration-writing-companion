# FEVER unmanaged deletion/restoration smoke test

Completed successfully in the FEVER vault on 25 July 2026 using disposable Scene, Part and Book structures. No authored FEVER material was deleted.

## Result

**Passed.** The real-vault run verified Obsidian Trash moves, restoration, rapid event ordering, unresolved-parent projection, selection reconciliation, startup behavior, ordinary rename boundaries, editorial retention and the no-write guarantee.

## Record before each case

- paths, explicit parents and `manuscript_order_key` values;
- SHA-256 hashes of every disposable file;
- selected Book/context and active note;
- chronology and Continuity Review findings/counts;
- annotation, chapter-note, pass and disposition presence.

Keep Obsidian's developer console open and watch for plugin errors.

## Scene cases

1. Create three disposable Scenes under a disposable FEVER Part and add editorial data to the middle Scene.
2. Delete the middle Scene through Obsidian Trash.
   If Obsidian moves it to `.trash`, confirm the move is reported as deletion rather than rename migration and no editorial record is created under `.trash/...`.
3. Confirm it leaves the sequence, the next sibling is revealed, and all surviving keys and hashes are unchanged.
4. Confirm Writing Companion follows only Obsidian's actual active Markdown note or shows its empty state.
5. Confirm chronology and Continuity Review recollect without restart and no finding is automatically resolved.
6. Restore the Scene from Trash. Confirm its parent, key, position and editorial data return and it does not steal focus.
7. Repeat for first, last and only Scene, including a direct-Book Scene. Confirm fallback order: next, previous, Part, Book.
8. Rapidly Trash/Undo and then Undo/Trash. Confirm final UI matches current vault truth with no duplicate fallback or flicker.

### Recorded result

- First, middle and last Scene deletion all removed the correct projected row.
- Surviving sibling keys and recorded SHA-256 hashes were unchanged in every case.
- Fallback was deterministic: next sibling, then previous sibling, then Part or Book when no sibling survived.
- Deleting the active Scene cleared stale Writing Companion state; non-active deletion did not move editor focus.
- Chronology and Continuity Review refreshed without restart or automatic resolution.
- Trash restoration at the same path restored the original parent, key and projected position without selecting or opening the Scene.
- Editorial data reconnected at the original path; no page identity migrated to `.trash`.
- Rapid delete/restore and restore/delete sequences settled on final vault truth without duplicate fallback.

## Part case

1. Create a disposable Part containing disposable explicitly parented Scenes.
2. Record child hashes and keys, then Trash the Part.
3. Confirm the Scenes appear under **Unresolved manuscript notes**, are not folder-inferred or reparented, and remain byte-identical.
4. Restore the Part and confirm containment returns and diagnostics clear after metadata settlement.

### Recorded result

- Deleting the Part preserved all child Scene files, keys and hashes.
- Child Scenes appeared under **Unresolved manuscript notes**.
- Explicit missing-parent references remained unresolved and did not use folder inference.
- No Scene was automatically reparented.
- Restoring the Part restored original containment and cleared the diagnostics after settlement.

## Book case

1. Create a disposable Book with disposable Part and Scene children and select it.
2. Record every child hash, then Trash the Book.
3. Confirm shared Book/context selection clears or uses the existing deterministic Book fallback; the active note does not choose scope.
4. Confirm Continuity Review clears or retargets and children remain unresolved and byte-identical.
5. Restore the Book. Confirm children resolve and the Book does not steal scope from another explicit selection.

### Recorded result

- Deleting the selected Book reconciled the shared selected Book and context coherently.
- The active Markdown note did not establish replacement manuscript scope.
- Continuity Review cleared or followed the reconciled shared selection and retained no stale private Book path.
- Child files and metadata remained unchanged and unresolved until restoration.
- Restoring the Book resolved its children but did not steal scope from another selected Book.

## Startup and external changes

1. With Obsidian closed, remove one disposable manuscript file externally; restart and confirm stale persisted context is reconciled without sibling guessing.
2. Restore it externally and confirm current metadata is recognised without focus theft.
3. Repeat one Trash/restore case after a full Obsidian restart.
4. If sync is available, repeat with a sync-originated disappearance/reappearance.

### Recorded result

- Startup cleared missing persisted Book/context paths and rebuilt current authoritative structure.
- Restoration after restart was recognised from current Markdown metadata without focus theft.
- A normal non-trash rename retained identity migration and bypassed deletion fallback.
- A move into `.trash` ran deletion fallback, while restoration from `.trash` reconnected at the original path.

## No-write verification and cleanup

1. Compare recorded hashes for every surviving sibling and child after each operation.
2. Confirm no `type: scene-draft`, parent, Book reference or order key was written or changed.
3. Confirm no plugin command created, restored, moved, trashed or deleted a note.
4. Confirm same-path editorial data reconnects and no purge/cleanup occurred.
5. Remove disposable material manually after the results have been reviewed.

### Recorded result

- Hash comparison found no plugin-driven change to surviving manuscript or Story World notes.
- No parent, Book reference, order key or `type` value was rewritten.
- The plugin did not create, restore, move, Trash or delete any file.
- Editorial data was retained and reconnected; no purge or orphan cleanup ran.
- Disposable test material was cleaned up manually after review.

## Damaged-hierarchy compatibility (#97)

Use disposable notes only:

1. Temporarily point a disposable Scene's explicit parent at another disposable Scene.
2. Confirm both Scenes remain visible at Book level, the invalid-parent diagnostic appears, and neither Scene row gains hidden children or a disclosure control.
3. Confirm reconciliation offers only the Book or recognised Parts as replacement parents.
4. Temporarily point a disposable Part at a Scene, then at another Part.
5. Confirm the Part remains visible at Book level with a diagnostic and reconciliation offers only its Book as parent.
6. Restore valid parent metadata and confirm ordinary Part containment, collapse and active-note reveal return unchanged.

### Recorded result

Passed in the disposable real vault on 25 July 2026. Scene-to-Scene, Part-to-Scene and Part-to-Part parent damage kept every affected note visible at Book level with `invalid_parent_kind` diagnostics. Scene rows remained childless and gained no disclosure state. Reconciliation offered only the Book or recognised Parts for Scenes and only the recognised Book for Parts. Restoring valid metadata returned ordinary Part containment, collapse and active-note reveal without plugin-driven structural writes.
