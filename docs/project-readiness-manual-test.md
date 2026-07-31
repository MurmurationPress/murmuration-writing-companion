# Project readiness manual validation

Use disposable vaults or Git-restorable copies. Before each case, record `git status --short` (or checksums for non-Git vaults), open and dismiss readiness, and confirm manuscript and Story World Markdown is unchanged.

Test: (1) an empty vault; (2) unrelated Markdown only; (3) simple folder order; (4) numeric filename order; (5) a valid legacy `manuscript_order`; (6) partial distributed metadata; (7) conflicting parent or order keys; (8) a fully prepared Book; (9) multiple Books in mixed states; (10) Story World without manuscript; (11) manuscript without Story World; (12) existing portable editorial storage; (13) preparation completed while readiness can be reopened/rechecked; (14) preparation Undo; (15) first invitation, dismissal, plugin reload, metadata refresh, and manual reopening; and (16) upgrade from V1 settings/data.

For each manuscript Book, compare the readiness state and diagnostics with **Prepare existing manuscript**. A safe preparation action must open that existing property-level preview. A blocked Book must not expose an enabled preparation action. Verify counts after adding, deleting, moving, or editing notes and choosing **Recheck project readiness**.

For first run, enable the plugin only after the vault is indexed. Confirm no temporary “empty vault” result appears, the invitation occurs once, reload and metadata changes do not repeat it, and **Open project readiness** in the command palette and Settings still work. Confirm dismissal does not create `.mwc/editorial-data.json`.

## PRIME smoke test

Use a safe PRIME branch or disposable copy. Confirm all three Books are listed independently and match #91; prepared Books have no redundant migration action; Book/Part/Scene and Story World/Event counts are reasonable; Navigator, Story World Review and Continuity Review actions work; and no action changes Markdown unless it enters an existing explicit write workflow. Complete and Undo one preparation in a disposable copy, rechecking after each. Restart Obsidian and verify dismissal persists while manual reopening recalculates. Finally confirm the graph, Continuity Review, entity index and references reports are unchanged.
