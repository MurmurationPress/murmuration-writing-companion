# Unresolved-link Story World creation smoke test

Use a disposable current Book 4-style vault. Record note hashes before and after each write and take screenshots of the action chooser, type-specific preview, source offer and collision diagnostic.

1. In an authoritative Scene, newly type unresolved links and create Character, Location, Organisation, Technology, Event and Reference notes. Confirm no type is initially selected, each exact authored link is unchanged and resolves after creation, and every note uses its established folder, fields and Markdown authority.
2. Repeat from an authoritative Part with two different entity types. Confirm the provenance label says **Add this Part as a source** and the exact Part wikilink is previewed.
3. Accept provenance once and confirm exactly one canonical entry is added to `world_sources`, preserving existing entries. Repeat through an alias and confirm no duplicate is written.
4. Decline provenance and confirm no `world_sources` change. Cancel independently from the combined action/type chooser, the selected type-specific form (including Event), and final confirmation; compare hashes to confirm every cancellation is write-free.
5. Exercise a unique canonical-name match and unique alias match. Confirm MWC offers the existing entity and never creates another note. Exercise ambiguous names, a path collision and a basename collision; confirm a clear diagnostic and no write.
6. Open a creation preview, then edit or remove the initiating wikilink. Confirm creation is blocked as stale and neither the manuscript nor Story World is partially rewritten.
7. Use an explicitly path-qualified unresolved link and confirm the created note occupies that target and the authored display text remains unchanged.
8. Restart Obsidian and rebuild/reopen the Story World Navigator, graph, timeline, Story World Review and Continuity Review. Confirm the created Markdown and `world_sources` remain authoritative and derived views refresh without editorial-store writes.

For each case record exact steps, expected result, actual result, changed paths, and representative SHA-256 hashes. A source-association failure after an existing entity is chosen must report the error and leave the entity recoverable; it must not claim full success or delete the entity.
