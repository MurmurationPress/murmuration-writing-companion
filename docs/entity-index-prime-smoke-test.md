# PRIME entity-index smoke test

Use a clean PRIME vault and record hashes or Git status before starting.

1. Select each of the three Books in turn and run **Generate entity index**. Confirm the preview contains only that Book's Scenes and follows Manuscript Navigator order.
2. Where explicitly linked, confirm Pip, Tobias, PRIME, JANUS and Divergent/Skip resolve to their canonical Story World headings. Confirm aliases do not create extra headings and repeated links in one Scene create only one Scene reference.
3. Confirm Part-qualified references remain readable and duplicate Scene titles are distinguishable.
4. Disable and re-enable **Reference**. Confirm only that canonical category changes and the counts update.
5. Cancel. Confirm no Markdown or editorial data changed.
6. Reopen, preview, and save. Confirm only `Entity Index - <Book>.md` is created at the vault root (or the explicitly edited destination) and an existing destination cannot be overwritten.
7. Generate twice from unchanged input (using the same `generated_at` when comparing the projection) and confirm all content ordering is identical.
8. Rebuild/reopen the Manuscript Navigator, Story World Navigator, Graph, Story World Review, Continuity Review and Dataview queries. Confirm the saved report is not a Scene, entity, graph node, continuity source or entity-index occurrence source.
9. Confirm report wikilinks open the canonical entity and Scene notes in Obsidian. Confirm no page numbers or manuscript edits were introduced.
10. Select **Vault** scope. Confirm the destination becomes `Entity Index - Vault.md`, all three Books appear in deterministic order, Scene labels include their Book, and the report has no redundant title heading.

Expected result: preview and filtering are read-only; saving creates one disposable generated report; Book scope, canonical alias resolution, category filtering and Navigator order remain authoritative.
