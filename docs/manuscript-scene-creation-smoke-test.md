# Manuscript Scene creation smoke test

## Completed FEVER results

Completed in the real vault on 23 July 2026. All checks passed:

- One Scene was created directly beneath the FEVER Part, and a separate Scene was created directly beneath Book 4.
- Both previews and created notes used the exact full vault-relative parent wikilink, without `.md`; no title-only or basename-only parent was substituted.
- Each previewed canonical ten-character uppercase base-36 distributed key matched the written `manuscript_order_key`.
- Direct-Book placement used Book 4's mixed Part/Scene children, while FEVER placement used its direct Scenes.
- The optional preceding-date proposal started unchecked. The Book-wide flattened lookup crossed a Part boundary, recognised the nearest supported preceding Scene date, and excluded `story_day`.
- Explicitly accepting the proposal wrote the previewed canonical `story_date`; the value became independent frontmatter with no stored source dependency and did not cascade after the source changed.
- Changing a selected neighbour or key made the insertion boundary stale and blocked creation without writing. Changing or moving the accepted date source also blocked creation, with no silent date substitution.
- Book 4 remained `bookPath` and manuscript scope while the recognised Scene became transient `contextPath`, expanded and revealed in the navigator, and opened natively.
- Writing Companion followed the opened Scene through the existing active-file lifecycle, while Continuity Review remained scoped to Book 4.
- Byte-for-byte comparisons confirmed all pre-existing sibling files remained unchanged after both Part and direct-Book insertion.
- The created notes contained no inferred POV, status, location, `world_context`, prose, editorial data or Story World data; no compiler or publishing data was written.
- Cancellation wrote nothing, and delayed or failed recognition preserved the verified note without setting an unverified `contextPath`.

## Reproduction checklist

Use a backed-up real vault with the provisional Book 4 and FEVER Part. Record exact paths, generated keys and sibling checks before deciding whether provisional Scenes remain canon.

1. Select Book 4 explicitly in the Manuscript navigator.
2. Select the FEVER Part and confirm the labelled **Create scene** action targets FEVER.
3. Enter a provisional Scene title.
4. Confirm the parent preview is the full path-qualified FEVER wikilink without `.md`.
5. Confirm the proposed filesystem path is editable and described as organisation rather than authority.
6. Confirm an empty FEVER offers `At beginning — Part is empty`.
7. Confirm the generated ten-character uppercase key and exact minimal Markdown.
8. Confirm any preceding-date proposal identifies its source and starts unchecked.
9. Cancel and verify that no file, folder, selection or metadata changed.
10. Repeat and create without accepting a date.
11. Confirm exactly one Scene note appears directly beneath FEVER with no `story_date`.
12. Confirm Book 4 remains `bookPath` and Continuity Review scope.
13. Confirm the Scene becomes `contextPath` only after recognition, and its parent expands and reveals it.
14. Confirm the Scene opens in an active Markdown leaf and Writing Companion follows it through the ordinary active-file lifecycle.
15. Confirm no POV, status, location, `world_context`, prose, editorial, Story World, compiler or publishing data was created.
16. Restart Obsidian and confirm containment and order persist from the Scene Markdown.
17. Create a second disposable Scene and explicitly accept a supported preceding date.
18. Confirm the exact previewed canonical `story_date` is written and no dependency on the source Scene is stored.
19. Change the source date after creation and confirm the accepted Scene date does not cascade.
20. In disposable distributed structures, test beginning, middle and end insertion beneath a Part.
21. Test direct-Book insertion among mixed Part and Scene children and confirm kind-qualified labels.
22. Compare all pre-existing sibling files byte-for-byte before and after each insertion.
23. Attempt the same trimmed case-insensitive title under the same parent and confirm it blocks; confirm the title remains allowed under another parent.
24. Preview a boundary, change an adjacent child or key, and confirm creation blocks without writing.
25. Preview and accept a date, then change or move its source Scene; confirm creation blocks without substituting another date.
26. Confirm an unrelated safe change away from the boundary and date source does not unnecessarily stale the plan.
27. Confirm legacy, mixed, malformed, duplicate-key, unsafe and exhausted structures block with reconciliation guidance.
28. Simulate delayed metadata recognition and confirm the verified note is preserved while `contextPath` remains unchanged.
29. Retain or manually remove provisional Scene notes only through an explicit author decision.
