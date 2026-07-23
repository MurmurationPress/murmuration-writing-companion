# Manuscript Part creation smoke test

Use a backed-up real vault and a provisional first Part named `FEVER` in Book 4.

1. Select Book 4 explicitly in the Manuscript navigator.
2. Confirm the labelled **Create part** action is enabled and clearly scoped to Book 4.
3. Enter `FEVER` and inspect the editable proposed filesystem path.
4. Confirm the preview parent is the full path-qualified Book 4 wikilink without `.md`.
5. Confirm an empty Book offers `At beginning — Book is empty` and shows one canonical ten-character key.
6. Confirm the preview distinguishes filesystem location, parent authority and manuscript position.
7. Cancel and verify that no file, folder or order metadata changed.
8. Repeat and create the Part.
9. Confirm exactly one Markdown note was written with only `type`, `title`, `parent` and `manuscript_order_key`.
10. Confirm FEVER appears directly under Book 4, becomes navigator context and opens natively.
11. Confirm Book 4 remains selected manuscript and Continuity Review scope.
12. Confirm no Scene was created, moved, wrapped, reparented or re-keyed.
13. Restart Obsidian and confirm containment and order persist from Markdown.
14. Attempt the same Part title with case or surrounding-whitespace differences and confirm it blocks in Book 4; confirm the title remains allowed in another Book.
15. In a disposable distributed structure, test beginning, middle and final insertion around kind-labelled direct Scenes and Parts.
16. Compare every pre-existing sibling byte-for-byte before and after each insertion.
17. Preview a boundary, change one of its neighbours or keys, and confirm creation stops without writing. Confirm an unrelated change away from the boundary does not stop it.
18. Confirm legacy, mixed, malformed, duplicate-key and exhausted boundaries block with reconciliation guidance.
19. Retain or manually remove the provisional Part only through an explicit author decision.

## Completed FEVER results

Completed in the real vault on 23 July 2026. All checks passed:

- FEVER was created as the first Part of an empty Book 4.
- The preview and created note used the exact full vault-relative Book 4 wikilink, without `.md`; no title-only or basename-only parent was substituted.
- The previewed canonical ten-character uppercase base-36 distributed order key matched the written key and retained the same order after restart.
- Book 4 remained `bookPath` and manuscript scope while FEVER became the transient navigator `contextPath` and was revealed and opened.
- Continuity Review remained scoped to the owning Book 4.
- Beginning, middle and end placement all produced the expected direct-child position in disposable distributed structures.
- Changing a chosen neighbour or its key made the preview stale and blocked creation without writing; an unrelated safe change elsewhere did not invalidate the boundary.
- Legacy, mixed, malformed, duplicate-key, unsafe-containment and exhausted-key structures blocked with reconciliation guidance.
- Byte-for-byte comparisons confirmed every pre-existing sibling remained unchanged after insertion.
- No Scene was created, moved or reparented, and no editorial, Story World, compiler or publishing record was written.
- Cancellation created nothing, and the successfully created Part remained recognised from its Markdown authority after restart.
