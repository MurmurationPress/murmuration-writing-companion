# Disposable-vault manuscript preparation test

Use a disposable vault under version control. For each fixture, record file hashes and preview before approving.

1. Create a clean folder-ordered Book with Parts and direct Scenes. Confirm deterministic detection, independent sibling keys, unchanged paths/prose, successful preparation, and exact Undo.
2. Repeat with numeric filename prefixes. Confirm Navigator order is retained without renaming.
3. Add a complete valid `manuscript_order` array. Confirm every entry resolves and the array is removed only after child read-back.
4. Test a scalar/malformed array, unresolved link, duplicate entry, omitted recognised note, and outside-Book entry. Each must block with no writes.
5. Mix valid distributed properties with missing keys. Confirm partial status blocks unless the existing Navigator contract has already established a safe complete sequence.
6. Add conflicting parent/type values, duplicate or malformed keys, a parent cycle, and ambiguous hierarchy candidates. Confirm precise blocking diagnostics.
7. Test a Story World-only vault. Confirm no manuscript can be prepared.
8. Add editorial and reporting metadata. Confirm it remains byte-for-byte represented after preparation/Undo and editorial storage is untouched.
9. Inject failures during a child write, read-back, and legacy-array removal. Confirm all earlier files return to exact original bytes; make rollback itself fail and confirm the affected path is prominent.
10. After success, edit one prepared note before Undo. Confirm Undo refuses without overwriting the edit. Without edits, confirm exact restoration and that preparation becomes available again.
11. Restart Obsidian after successful preparation. Confirm Navigator hierarchy/order and Codex Press acceptance, and that a second preview reports no changes.

For PRIME, use analysis-only previews in the live vault. Perform writes only on a Git-restorable branch or disposable copy. Across all three Books confirm Navigator order/hierarchy, stable keys, unchanged paths and prose, untouched reporting metadata, stable Story World/Graph/Continuity Review, idempotent second analysis, exact Undo, and a Git diff containing only previewed frontmatter changes.
