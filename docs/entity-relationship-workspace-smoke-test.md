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
2. Select a predicate, choose a Story World target or literal value, and select an authorial status.
3. Optionally expand **Provenance and time** and add a source or validity date.
4. Confirm the complete readable sentence is visible before choosing **Confirm relationship**.
5. Verify one entity-owned assertion is added to the selected entity note with no explicit `subject` and no inverse written to the target.
6. Choose **Edit**, change the predicate, target/value or status, review the sentence, and confirm.
7. Verify existing provenance, time fields and `review_batch: alpha` survive unless deliberately changed.

## Links and lifecycle

1. Select the relationship target and confirm its authoritative Markdown note opens in the centre editor, its inspector refreshes, and editor focus returns to the centre pane.
2. Return to the source entity, choose **Supersede**, review the statement, and explicitly confirm. Verify the assertion remains with `status: superseded`.
3. Repeat with **Remove** and confirm only the selected assertion is removed.

## Authority and stale-write safety

1. Begin editing a relationship, then change and save the entity Markdown directly before confirming the form.
2. Confirm the workspace refuses the stale write and preserves the newer author change.
3. Confirm unrelated frontmatter and unknown qualifiers remain unchanged after successful operations.
4. Confirm `.murmuration/writing-companion/editorial-data.json` is unchanged.
5. Confirm no manuscript prose changes and no additional Writing Companion sidebar leaves are created.
