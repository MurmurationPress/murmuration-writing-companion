# PRIME Story World manuscript-impact smoke test

Use disposable metadata changes in the PRIME trilogy vault and record file hashes before testing. The view is read-only.

1. Select a dated event referenced by `world_context` in several Scenes and open its Entity Inspector.
2. Confirm **Impact Across Manuscript** groups results by Book and Part in authoritative flattened Scene order.
3. Confirm titles, POV and story dates match current Scene frontmatter.
4. Confirm direct-reference and derived-temporal badges are distinct on a Scene carrying both.
5. Check credible before, during and after classifications, including month/year precision.
6. Select an entity referenced across multiple Parts and Books; verify all-book and current-Book filters.
7. Confirm a temporally relevant but unreferenced Scene is labelled derived, not direct.
8. Confirm a directly referenced undated Scene remains present and labelled direct.
9. Select an undated item and confirm the temporal-unavailable explanation while direct results remain.
10. Select an item with no impact and confirm the restrained empty state.
11. Follow a Scene result and confirm the exact authoritative Markdown note opens.
12. Add/remove a disposable `world_context` reference and confirm the open inspector refreshes.
13. Edit a disposable Scene `story_date` and confirm timing refreshes without invented precision.
14. Reorder a disposable Scene and confirm its result position follows manuscript order.
15. Delete and restore a disposable Scene and confirm the row disappears and returns through #149 settlement.
16. Rename a Story World item and an ordinary manuscript Scene; confirm current links and results rebuild without stale records.
17. Reopen/rebuild the index and confirm equivalent results.
18. Compare hashes and confirm opening, filtering and navigation changed no manuscript, Story World or editorial Markdown/data.

Relationship assertions currently have no standalone selection identity in the inspector. Validate entity/event impact now; relationship-specific selection remains an explicit documented limitation rather than inferred behavior.

## Completed PRIME result — 25 July 2026

The PRIME trilogy real-vault smoke test passed.

- Results grouped by Book and Part and followed the authoritative flattened Scene order across the tested manuscript scope.
- Scene titles, POV values and story dates matched current authoritative frontmatter.
- Direct and derived temporal evidence remained visibly distinct. A Scene carrying multiple evidence types appeared once with each applicable evidence label retained.
- Relative timing was credible at day, month and year precision without manufacturing narrower dates.
- Evidence, before/during/after and current-Book filters behaved deterministically.
- Scene-result navigation opened the correct authoritative Markdown note.
- Editing `world_context` and `story_date` refreshed the open impact projection.
- Reordering a Scene moved its result to the corresponding authoritative manuscript position.
- Scene deletion and same-path restoration removed and restored the result through the existing manuscript-integrity settlement.
- Story World and ordinary manuscript renames rebuilt results without stale paths.
- Rebuilding the index reproduced equivalent impact results.
- Undated and no-impact selections showed the expected partial or empty states.
- Recorded hashes confirmed that opening, filtering, navigating and rebuilding the view changed no manuscript, Story World or editorial Markdown/data.

Broadly referenced entities legitimately produced a large result set because of extensive explicit `world_context` evidence. The evidence and timing filters made those results manageable. This result is retained as editorial feedback; #133 adds no ranking, hidden suppression, automatic metadata changes or primary/background context model.
