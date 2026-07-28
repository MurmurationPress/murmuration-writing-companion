# PRIME Story World refinement smoke test

Use a disposable copy of the PRIME vault. Before loading the development build, record `git status --short` (if the vault is versioned) or hashes for all Story World and manuscript Markdown. Keep the file explorer visible so unexpected writes are obvious.

1. Open Pip, PRIME and JANUS in the Story World Graph in turn. Confirm **Comfortable** is the default and each projection contains only the focused centre and its explicit direct neighbours.
2. For each centre, select Compact, Comfortable and Spacious. Confirm only spacing changes; the centre, filters, one-hop node set and Back/Forward history do not.
3. Exercise predicate, status, node-type, scope and validity filters. Confirm the 36-node cap remains enforced and the warning reports the deterministic omitted count.
4. Rebuild/reload the index with the same centre, viewport, filters and density. Confirm recognisably stable placement.
5. Confirm Characters are ellipses, Locations are rounded rectangles, Organisations are diamonds, Concepts/Technologies are hexagons and Events are chevrons.
6. Compare confirmed and planned/candidate nodes and assertions. Confirm solid means confirmed, dashed means provisional/unconfirmed, and centre fill remains obvious for either status.
7. Confirm edge labels contain the predicate only—not `confirmed`, `planned` or another status—while edge focus/detail and the status filter retain the exact status.
8. Traverse nodes using click, Enter and Space. Confirm entity/event/model activation recentres without opening Markdown; source Scenes remain detail-only. Exercise Back/Forward and Alt+Arrow history.
9. Use **Open note** and **Open source assertion** and confirm these explicit actions alone open their authoritative notes.
10. In Entity Inspector manuscript impact and Chapter Context, check `[[Tobias]]`, `[[Tobias|Tobias Hale]]`, a heading link, a block-reference link, a missing link, a list of links and a plain scalar. Confirm clean labels, authored aliases, accessible resolved links, readable non-linked unresolved labels and preserved list order.
11. Focus resolved metadata links and activate with Enter and Space; click them with the pointer. Confirm the intended note opens and no frontmatter changes. Confirm unresolved labels cannot navigate.
12. Create a disposable entity with Scope `[[Book 1]]`, another with `[[Book 1|Emergence]]`, another unresolved link and one legacy plain scalar. Confirm suggestions come from current vault notes, preview labels are clean, and created `world_scope` values preserve valid authored syntax. Reopen each in Entity Inspector and confirm the same presentation/resolution.
13. Confirm Intelligence entities appear in **Characters & intelligences**. With `pov_eligible: true`, confirm PRIME/JANUS appears in the POV selector and saving writes a wikilink. Confirm an Intelligence without the property is absent.
14. Confirm an existing Character without `pov_eligible` still appears. Set `pov_eligible: false` on a disposable Character and confirm it is excluded. Set `pov_eligible: true` on a disposable non-character and confirm it opts in.
15. Put malformed plain POV and unresolved `[[Missing POV]]` values on disposable Scenes. Run/open Continuity Review and confirm both use existing chapter-context observation cards rather than a new warning surface.
16. Repeat graph controls and metadata-link activation in a narrow pane, at increased zoom and keyboard-only. Confirm controls wrap, focus remains visible and no hover-only action is required.
17. Compare the initial hashes/status after graph navigation, density changes, filtering and metadata-link activation. Confirm no Story World or manuscript Markdown changed. Exclude the deliberately created/edited disposable notes and explicit authoring steps from this no-write comparison.

Record any renderer-specific chevron clipping, label collisions that remain at Spacious density, or desirable scope-schema migration as follow-up findings; do not repair or migrate authority during this pass.
