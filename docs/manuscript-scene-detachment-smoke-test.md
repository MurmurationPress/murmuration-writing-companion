# FEVER Scene detachment smoke test

Use a disposable Scene beneath FEVER in Book 4. Cleanup is a separate manual action after testing.

1. Create the Scene and add prose, `story_date`, POV, status, `world_context`, an unknown property, and an annotation or editorial note.
2. Record its path, body, sibling keys, and sibling file hashes.
3. Choose **Remove from manuscript** from the Scene action menu.
4. Verify the modal names FEVER as a Part, Book 4, both positions, the preserved path, actual Changed properties, and Preserved content.
5. Cancel. Verify every file and property is unchanged.
6. Reopen and confirm **Remove from manuscript**.
7. Verify the same file remains, its body and unrelated properties match, `type` is exactly `scene-draft`, and parent/order authority is absent.
8. Verify it disappears from FEVER, all sibling keys and hashes match, Book 4 remains selected, and navigator context uses next, previous, Part or Book as appropriate.
9. Keep the note open. Verify Writing Companion says it is not in the selected manuscript, retains note/editorial sections, and suppresses Book/manuscript-only continuity and authoring.
10. Verify chronology and Continuity Review recollect without restart and no finding is marked resolved merely because evidence disappeared.
11. Restart Obsidian. Verify the note remains detached and creates no reconciliation warning despite its scene-like properties and unchanged legacy folder location.
12. Manually set canonical `type: scene`, `parent` and a newly allocated valid `manuscript_order_key`. Verify it reappears in projection.
13. Remove the disposable note only through separate manual cleanup.

## Completed result — 24 July 2026

The Book 4/FEVER run passed every step above:

- The preview reported the precise Scene-type, parent and order-key aliases under **Changed**, and title, story date, POV, status, `world_context`, unknown YAML, prose, annotations and editorial notes under **Preserved**.
- Cancel produced no metadata, body, sibling, editorial-store or filesystem writes.
- Confirmation left the note at the same path with the same filename and body, wrote canonical `type: scene-draft`, removed structural parent/order metadata, and retained unrelated frontmatter, the annotation and editorial data.
- The explicit inference veto held despite Scene-like metadata and the unchanged legacy FEVER folder location. The note did not appear in manuscript records or reconciliation.
- Recorded sibling keys and full sibling-file hashes remained identical. No gap repair or rebalance occurred.
- Separate disposable position runs selected the next sibling, previous sibling, parent Part and owning Book respectively. Book 4 scope remained selected and no detached path remained as manuscript context.
- Writing Companion displayed the not-in-selected-manuscript state, retained note-centric metadata and editorial information, and suppressed manuscript-only ownership, continuity and authoring.
- Owning-Book chronology and Continuity Review refreshed from surviving Scenes. Disappearing observations followed historical disposition semantics and were not automatically resolved.
- Restarting Obsidian left the note detached with no persistent reconciliation warning.
- Manual restoration of canonical `type: scene`, `parent` and a new valid `manuscript_order_key` restored authoritative Scene recognition.
- No file was moved, deleted, trashed or archived. Disposable-note deletion occurred only as separate manual cleanup after verification.
