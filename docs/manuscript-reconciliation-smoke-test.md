# Manuscript reconciliation smoke test

Use a clean Git working tree or a disposable manuscript copy. The manuscript must already use distributed `manuscript_order_key` values.

## 1. External scene addition

1. Create a Markdown scene outside the Manuscript navigator, preferably through Obsidian Files.
2. Give it:

   ```yaml
   type: scene
   parent: "[[Owning Part]]"
   ```

   Do not add `manuscript_order_key`.
3. Confirm the navigator shows **Reconciliation needed** and Codex Press blocks output.
4. Choose **Reconcile manuscript** from the navigator header.
5. Confirm the new scene appears under **Position required**.
6. Select a deliberate location before or after an existing scene.
7. Expand **Markdown changes**.

Expected preview: only the new scene gains `manuscript_order_key`; its existing canonical parent remains unchanged.

8. Apply reconciliation.
9. Confirm the scene appears in the selected position and Codex Press can continue.
10. Inspect Git: only the new scene note should have changed.

## 2. Broken parent link

1. In a disposable scene, replace `parent` with an unresolved wikilink.
2. Confirm reconciliation is required and publishing is blocked.
3. Open reconciliation and select both the intended parent and a deliberate position.

Expected preview: the scene's `parent` and `manuscript_order_key` change together. Unrelated notes are untouched unless the selected position has no available key gap; in that case the preview must show a rebalance limited to the destination sibling set.

## 3. Duplicate sibling key

1. Copy one scene's `manuscript_order_key` onto another scene under the same parent.
2. Open reconciliation.
3. Confirm the affected parent appears under **Duplicate sibling keys**.
4. The Apply button must remain disabled until **Rebalance only this sibling set in the order currently displayed** is explicitly selected.
5. Review the exact sibling files listed in the preview, then apply.

Expected result: only that parent's children receive replacement keys. Keys under other parts do not change.

## 4. Canonical parent repair

1. Remove `parent` from a scene while leaving it physically inside its recognised part folder.
2. Open reconciliation.

Expected result: the inferred existing containment appears under **Unambiguous repairs**. The preview writes the canonical `parent` without changing the valid order key.

## 5. Conflict marker protection

1. On a disposable note, insert unresolved Git conflict markers such as `<<<<<<<`, `=======`, and `>>>>>>>`.
2. Open reconciliation.

Expected result: the note appears under **Resolve before continuing** and Apply remains disabled. Reconciliation must not modify any file until the conflict is resolved.

## 6. Undo safety

1. Apply one reconciliation repair.
2. Use **Undo manuscript reconciliation** immediately.

Expected result: every affected frontmatter block returns exactly to its earlier state.

3. Apply the repair again, then edit one affected note manually before using Undo.

Expected result: Undo refuses rather than overwriting the later edit.

## 7. Compiler verification

After valid reconciliation, compile PDF, EPUB, Manuscript Markdown and DOCX. All four outputs must use the navigator sequence.

Before reconciliation, Codex Press must block malformed distributed structure rather than falling back to filenames.

## Deletion behaviour

Deleting a scene outside the navigator does not leave a central dangling sequence entry because order authority is distributed. Reconciliation does not recreate deleted notes. Broken parent or other structural links to the deleted note remain separate repair conditions where they can be detected.
