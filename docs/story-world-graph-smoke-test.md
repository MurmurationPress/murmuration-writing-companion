# PRIME Story World graph smoke test

Use representative PRIME selections and record hashes for affected Story World, manuscript and editorial files before testing.

1. Select a central character with several explicit incoming and outgoing relationships and open the graph from the Navigator diamond action.
2. Confirm the central selection is obvious, labels are readable, predicates and arrow directions match the authored assertions, and indexed node types are visible.
3. Open the same graph through Entity Inspector and the **Open Story World Graph** command.
4. Select PRIME or JANUS. Confirm the one-hop limit, 36-node cap, truncation message and filters prevent an unusable default hairball.
5. Exercise predicate, relationship-status, node-type, current-Book, unscoped and global filters.
6. Select an entity with active and superseded relationships; confirm status remains distinguishable without colour alone.
7. Enter an explicit reference date for a validity-dated relationship and confirm active, future, expired and indeterminate classifications are credible and precision is not invented.
8. Select a dated event with multiple explicit participants. Confirm participant nodes and authored event-to-participant direction.
9. Enable manuscript sources for an event with explicit `world_sources`; confirm only explicit source Scenes appear and ordinary impact Scenes do not become graph nodes.
10. Confirm explicit timeline assertions connect related events and no temporal-proximity edge is inferred.
11. Select an unknown/custom entity type and an unknown predicate; confirm both remain visible and valid.
12. Select a node with a current Story World Review observation. Confirm the marker opens the same observation fingerprint.
13. Put one malformed and one valid relationship in a disposable note; confirm the valid edge remains and the malformed record appears only in **Incomplete connections**.
14. Select an entity with no neighbours and confirm the restrained empty state.
15. Traverse through at least three entity/event nodes with pointer and keyboard. Confirm each single activation recentres the graph without changing the active Markdown editor, and the deterministic one-hop neighbourhood and selected-node details update.
16. Select a source-Scene node and confirm details appear without opening it or incorrectly making it a Story World centre.
17. Use Back, Forward, Alt+Left and Alt+Right. Confirm duplicate centres are suppressed and navigating a new branch after Back clears Forward.
18. Change the active Markdown note after manual graph traversal and confirm the graph centre remains distinct. Use **Follow active note** and confirm it explicitly resynchronises.
19. Use **Open note** from selected-node details and confirm only that explicit action opens authoritative Markdown. Confirm Enter recentres a focused graph node while Enter on the focused Open note button opens it.
20. Activate an edge and confirm only its predicate, status, validity, source note and exact assertion path are shown; then use **Open source assertion** explicitly.
21. Use **Open Impact Across Manuscript** and confirm it routes to the existing #133 Entity Inspector section without adding Scene nodes by default.
22. Delete or move the current centre and a history node into local Trash; confirm history reconciles safely. Restore them and confirm current navigation can select them again.
23. Rename a current or historical entity through Obsidian and confirm settled links and local graph history translate to current indexed truth.
24. Rebuild the Story World index and confirm materially equivalent graph content and recognisably stable radial layout.
25. Repeat in a narrow pane, keyboard-only and increased zoom; confirm controls, focus and navigation remain usable.
26. Compare hashes and confirm traversal, Back/Forward, filtering, selection and review routing changed no Story World, manuscript or editorial Markdown/data. Only explicit Open note, Open source assertion or impact routing may change the active editor.

## Completed PRIME result — 25 July 2026

The full procedure passed in the PRIME trilogy vault. The Story World Navigator diamond, Entity Inspector **Open graph** action and command all opened the same derived centre-pane view. Entity, event and supporting-model selection rebuilt the expected deterministic one-hop neighbourhood in place. Multi-step pointer and keyboard traversal did not activate Markdown; **Open note** and **Open source assertion** were the only actions that opened authoritative notes. The author explicitly preferred: **“Navigate the graph first, then open the authoritative item deliberately.”**

Back and Forward centre history, duplicate suppression, branch clearing, active-note separation and explicit **Follow active note** resynchronisation behaved correctly. Source-Scene selection remained a detail-only interaction. PRIME and JANUS remained readable under the 36-node limit; truncation reported the omitted count, and predicate, status, node-category, scope and validity filters reduced the neighbourhood credibly in narrow and wide layouts.

Authored predicates and directions, event participants, relationship statuses and validity classifications were accurate at the available precision. Unknown predicates and entity types remained visible. A malformed relationship appeared only under **Incomplete connections** while valid assertions in the same note remained graph edges. Review markers opened the matching #111 fingerprint, #133 impact routing used the existing Entity Inspector section, and optional `world_sources` added only explicit source Scenes.

Ordinary rename, deletion, local-Trash movement, restoration and index rebuild refreshed or reconciled graph content and local centre history safely. Repeated rebuilds produced materially equivalent content and stable radial placement. Recorded Story World, manuscript and editorial hashes were unchanged after graph traversal, filtering, selection, history navigation and review/impact inspection; the graph performed no Markdown or editorial mutation.
