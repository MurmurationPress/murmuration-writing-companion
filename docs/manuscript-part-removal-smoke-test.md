# FEVER Remove Part smoke test

Use a disposable FEVER vault copy and record hashes for the selected Book, its Parts, Chapters/Scenes and retained editorial data before testing.

1. Open the Manuscript Navigator and use an empty authoritative Part's actions menu. Confirm **Remove Part** is present, keyboard reachable and uses the existing menu pattern.
2. Activate **Remove Part**. Confirm the modal names the Part and says its Part note will move to Obsidian trash while no Chapters or Scenes are deleted.
3. Cancel and confirm no file, frontmatter, selection, order key or navigator row changed.
4. Reopen and confirm. Verify only the Part note moves through Obsidian's configured trash behaviour and the Navigator refreshes promptly.
5. Confirm remaining Book-level Parts and Scenes keep their exact sparse `manuscript_order_key` values and derived sequence.
6. Restore the same Part note from local Obsidian trash. Confirm #149 restoration reconnects it at its authoritative position and retained editorial data remains associated with the original path.
7. Assign a Scene to a disposable Part and attempt removal. Confirm removal is blocked with instructions to move or remove contained manuscript items first; neither note changes.
8. Repeat with a legacy Chapter (`document_type: chapter`) recognised through the existing Scene model. Confirm removal is blocked and the Chapter is not deleted or reassigned.
9. Try a legacy-order, malformed, stale and non-authoritative Part context. Confirm the operation is unavailable or rejected clearly without a file or frontmatter change.
10. Compare hashes. Apart from the explicitly trashed empty Part, no manuscript or editorial file should differ.
