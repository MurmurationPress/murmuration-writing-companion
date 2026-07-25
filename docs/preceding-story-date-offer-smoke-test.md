# FEVER preceding story-date offer smoke test

## Result

Passed in Obsidian on 25 July 2026. The offer used the preceding Scene from manuscript order, explicit acceptance wrote the target's canonical `story_date`, the offer disappeared, and subsequent source changes did not cascade into the accepted value. The sidebar-focus acceptance regression was corrected and retested successfully.

## Checklist

Use disposable Scenes in Book 4. Record target and source frontmatter, file hashes, chronology results, Continuity Review results and editorial-data presence before testing. Do not alter authored FEVER material.

1. Select a dated disposable Scene under FEVER and create a following undated Scene.
2. Open the undated Scene and confirm Chapter Context offers the dated Scene's value and names the source Scene.
3. Confirm rendering the offer changes no frontmatter or file hash.
4. Select **Use this date** and confirm canonical `story_date` is written to the target only.
5. Confirm unrelated target metadata and prose, the source Scene, siblings, editorial storage and Story World data remain unchanged.
6. Confirm Chapter Context updates immediately, the offer disappears, and chronology and Continuity Review refresh.
7. Redate and rename the source Scene; confirm the accepted target value does not change.
8. Delete and restore the source Scene; confirm the accepted target value still does not change.
9. Reorder the target; confirm the accepted value does not change.
10. Clear the target date normally and confirm a new offer appears from current authoritative order.
11. Insert an undated Scene between source and target and confirm backward search still finds the dated source.
12. Insert a nearer dated Scene and confirm the unaccepted offer changes to the nearer source.
13. Leave an old offer visible, then redate, move or delete its source; confirm acceptance is blocked rather than silently substituted.
14. Leave an offer visible, then manually date or move the target; confirm acceptance is blocked and the manual date is preserved.
15. Make manuscript order structurally unsafe and confirm no offer appears.
16. Test the first flattened Scene and a Book with no preceding valid date; confirm no offer appears.
17. Confirm malformed, unsupported and range-shaped preceding dates are ignored.
18. Confirm `story_day` alone leaves a target eligible but is never proposed as a date.
19. Confirm no offer for a Book, Part, `scene-draft`, Trash note, unresolved Scene, Story World note, research note or other non-manuscript Markdown.
20. Delete and restore a preceding disposable Scene and confirm an unaccepted offer refreshes after metadata settlement.
21. Rapidly delete/restore a preceding Scene and confirm the final offer matches current vault truth.
22. Verify no dependency or inheritance metadata was created and no cascading write occurred.
23. Clean up disposable test material manually after reviewing results.
