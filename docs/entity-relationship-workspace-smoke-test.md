# Entity relationship workspace smoke test

Use a backed-up real vault with two indexed Story World entity notes and an ordinary manuscript chapter. Open one entity from the Story World navigator so its authoritative Markdown remains in the centre editor and its inspector appears in the Writing Companion.

## Read existing relationships

1. Give the selected entity a valid `world_relationships` target assertion, a literal assertion, and one incomplete assertion.
2. Include a custom predicate with `predicate_label`, plus an unknown qualifier such as `review_batch: alpha`.
3. Confirm valid assertions appear as readable sentences rather than raw triples.
4. Confirm the incomplete assertion remains visible with a warning and is not presented as settled fact.
5. Confirm statuses, provenance and qualifiers are visible under progressive disclosure.

## Add and edit

1. Choose **Add relationship**.
2. Confirm the guided form stays inline in the selected entity inspector and the authoritative entity Markdown remains open in the centre editor.
3. Choose **Cancel**, confirm the relationship list remains in the same inspector, then reopen the form.
4. Select a predicate, then choose a Story World target by its ordinary canonical name. Confirm a unique alias also resolves without typing `[[wikilink syntax]]`.
5. Enter an unresolved name and an ambiguous alias in turn. Confirm each shows a clear error and neither is guessed or saved.
6. Optionally choose a literal value instead, then select an authorial status.
7. Expand **Provenance and time** and choose exact dates with the **As of**, **Valid from** and **Valid until** date controls. Confirm Markdown stores the unchanged `YYYY-MM-DD` values.
8. Before editing, add an imprecise or structured temporal qualifier directly in Markdown. Confirm the form shows it as preserved and does not clear it; use **Replace with exact date** and verify it changes only after an exact date is deliberately chosen.
9. Confirm the complete readable sentence uses the target's canonical/display name before choosing **Confirm relationship**.
10. Verify one entity-owned assertion is added with the shortest unambiguous wikilink, no explicit `subject`, and no inverse written to the target.
11. Confirm the open centre editor synchronises with the successful write and the same entity inspector rerenders with the relationship.
12. Choose **Edit**, change the predicate, target/value or status, review the sentence, and confirm.
13. Verify existing provenance, time fields and `review_batch: alpha` survive unless deliberately changed.

## Links and lifecycle

1. Select the relationship target and confirm its authoritative Markdown note opens in the centre editor, its inspector refreshes, and editor focus returns to the centre pane.
2. Return to the source entity, choose **Supersede**, review the statement, and explicitly confirm. Verify the assertion remains with `status: superseded`.
3. Repeat with **Remove** and confirm only the selected assertion is removed.

## Authority and stale-write safety

1. Begin editing a relationship, then change and save the entity Markdown directly before confirming the form.
2. Confirm the workspace refuses the stale write and preserves the newer author change.
3. Repeat with an unsaved centre-editor change and confirm it is neither discarded nor overwritten.
4. Confirm a normal successful write is verified from the saved vault content even if the visible editor takes a moment to refresh; no false rollback notice should appear.
5. Confirm unrelated frontmatter and unknown qualifiers remain unchanged after successful operations.
6. Confirm `.murmuration/writing-companion/editorial-data.json` is unchanged.
7. Confirm no manuscript prose changes and no additional Writing Companion sidebar leaves are created.
