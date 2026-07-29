# Manuscript name alignment smoke test

Use a disposable copy of a representative vault. Keep the Manuscript Navigator,
Properties view and at least one linking note visible. Exercise a Book, Part and
both notes represented by the project as Chapter/Scene manuscript entries.

## Mismatch presentation

1. Give an authoritative note the filename `Domestic Distance.md` and authored
   title `Domestic Distances`.
2. Open the relevant Book in the Manuscript Navigator.
3. Confirm a restrained `≠` indicator appears on the Book heading or tree row.
4. Hover the indicator and use a screen reader to confirm it presents
   `Filename: Domestic Distance` and `Title: Domestic Distances` without YAML.
5. Confirm a matching title, surrounding-whitespace-only difference, and the
   established `12 Arrival.md` / `title: Arrival` convention show no indicator.
6. Confirm Story World notes, unrelated Markdown, detached drafts, malformed or
   unresolved manuscript notes and notes under `.trash` show no alignment action.

## Rename file from title

1. Open the row's keyboard-accessible actions menu and choose **Rename file from
   title**. Confirm the modal identifies both `.md` filenames.
2. Cancel. Confirm no file, frontmatter, links, ordering or Navigator state changed
   and focus returns to the actions button.
3. Repeat and confirm. Verify the file remains in its folder, is renamed through
   normal Obsidian behaviour, open panes follow it, incoming wikilinks update per
   the vault's Obsidian link-update setting, and `title` is untouched.
4. Confirm the mismatch clears after Obsidian's rename/metadata events settle and
   that keyboard navigation and focus remain usable.
5. Create the proposed destination first. Confirm the action blocks before a
   confirmation/write and both notes remain unchanged.
6. Try titles containing `/`, `\\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`, control
   characters, a trailing dot/space and a reserved name such as `CON`. Confirm a
   notice explains the block and no write occurs.
7. While the confirmation is open, edit the title or create the destination.
   Confirm acceptance reports stale/conflicting state and performs no rename.

## Update title from filename

1. Recreate a mismatch and choose **Update title from filename**. Confirm the
   modal identifies the current and proposed authored titles.
2. Cancel and verify the file and document are byte-for-byte unchanged.
3. Confirm the action. Verify only `title` changes; prose, other frontmatter,
   `manuscript_order_key`, parent/book links and derived sequence remain intact.
4. While the modal is open, change the title, rename/trash the note or break its
   authoritative relationship. Confirm acceptance rejects stale state with no
   write and the Navigator does not claim success.
5. Observe the live metadata-cache event: the Navigator should settle with no
   mismatch and must not trigger a reverse file rename or repeated write.

## Failure, trash and restoration

1. With developer tooling or a read-only test vault, force rename and metadata
   writes to fail. Confirm errors appear, the Navigator does not refresh as a
   successful operation, and no second/reverse synchronization is attempted.
2. Successfully rename a mismatched note, then move it to Obsidian's local Trash.
   Confirm it disappears without frontmatter repair or editorial-data deletion.
3. Restore it to the vault. Confirm normal deletion/restoration reconciliation
   retains editorial data, restores authoritative visibility when relationships
   resolve, and reports any remaining mismatch without automatic repair.
4. Compile the Book before and after a cancelled action and compare output. It
   must be identical. After an explicit resolution, only the chosen display-name
   representation and its normal link/heading consequences may differ.
