# Reviews and Reports

MWC's reviews and reports are derived from authoritative manuscript and Story World Markdown. Opening or refreshing them does not make their findings canon.

For author-defined SVG line charts, see [Derived Artefacts](Derived_Artefacts.md).

- **Continuity Review** gathers manuscript chronology, Chapter Context, and Book-relevant Story World findings. Relevance follows authoritative manuscript membership and resolved derived Scene context, including semantic POV, Location, and explicit `world_context`; it does not infer from prose or folders.
- Informational orphan review counts recognised incoming semantic references, including manuscript body links, Scene `world_context`, resolved POV and resolved Location, Story World relationships, and typed entity-reference properties. Unresolved or ambiguous values are never guessed. An unreferenced entity may still be intentional preparatory canon.
- **Story World Review** checks explicit relationships, participants, provenance, scope, names, aliases, statuses, and temporal structures. It reports problems but does not repair notes.
- **Entity Index** creates a disposable Markdown report from explicit Scene links and established structured impact evidence. It does not infer plain-text mentions or page numbers.
- **Graph** visualises explicit indexed relationships and supported evidence.
- **Timeline** derives placement from Event `world_time` and Scene connections from explicit sources.
- **Impact Across Manuscript** projects where an entity is explicitly relevant.

Continuity dispositions are editorial decisions stored separately from Story World Markdown. Generated notes are marked as reports and excluded from entity/manuscript discovery, so later views do not treat them as source evidence.

## Story World Review

Story World Review checks the structure authors have explicitly recorded in Story World Markdown. It can flag deterministic name and alias collisions, ambiguous or explicitly Story-World-targeted broken manuscript links, duplicate relationship assertions, incompatible Event dates, conflicting recognised single-valued properties, and unreferenced entities.

Findings are review suggestions, not automatic truth. A similar name can be intentional, and an unreferenced entity can be useful preparation. **Keep both** or **Mark intentional** retains that author decision with the finding evidence; changed evidence returns for review. Active findings and retained/history findings remain separately inspectable.

Ambiguous links are never guessed. Where Story World Review offers **Relink**, the author chooses a target and confirms replacement of that one reviewed wikilink occurrence. Its display alias and surrounding prose are preserved. Review itself is read-only: opening or rerunning it does not rename, merge, delete, migrate, or rewrite any note.

Recognised typed-property conflicts use the central Story World property definition, including whether a property is single- or multi-valued. Custom and unknown YAML properties remain valid and are not assigned invented schema rules. General entity merging and note renaming are deliberately not automated because preserving arbitrary body prose, relationships, provenance, scopes, aliases, and custom YAML requires an author-led edit.

## Book scene numbers

Run **Renumber book scenes** from a Book, Part or Scene to refresh that Book's reporting numbers. With no Book context, choose a Book. **Scene numbers out of date** in the status bar names the active Book in its tooltip; click it to run the same command. Progress includes Cancel. Failed or interrupted runs stay stale; resolve the reported problem and rerun.

Numbers never update automatically during writing, structural edits, preparation or startup. Navigation and compilation still follow the authoritative hierarchy and order keys. Refresh before using a report that reads stored numbers.

`book_scene_number` starts at 1 for each Book. `manuscript_sequence` is now a book-local Text key, such as `0000000005.0000000007` (root 5, Scene 7); a direct Scene ends in `0000000000`. Filter Bases to the Book's manuscript membership before sorting this key or the numeric scene count. The old three-segment key's first segment no longer identifies a Book; do not use it for Book filtering or series ordering. Detached notes can retain old values, so filter membership explicitly.

The command removes obsolete MWC series fields only within the selected Book. Untouched Books retain their old snapshots. Disposable `mwc_scene_numbering_token` and `mwc_scene_numbering_snapshot` properties let the status survive restarts and neutral renames; they are not manuscript authority. See [reporting details](../docs/manuscript-reporting-sequence.md) for format migration, safety and Bases guidance.
