# PRIME Story World Review smoke test

Use disposable Story World notes and record their paths and hashes before testing. Do not damage authored PRIME canon.

1. Open **Story World Review** from the Story World Navigator and confirm global review works without an active Book.
2. Add a relationship whose target is a missing wikilink; confirm one understandable conflict with the exact property path and source value.
3. Give two disposable entities the same alias with different case; confirm one collision finding names both notes.
4. Add an event with a reversed or malformed explicit `world_time` range; confirm a chronology finding.
5. Add a valid undated event; confirm it is not flagged.
6. Add an unresolved explicit event participant; confirm the event and participant property are shown.
7. Omit optional `world_scope` from a valid entity; confirm no finding.
8. Add a malformed or unresolved explicit `world_scope`; confirm a restrained review finding.
9. Add an unknown custom `world_entity` value and unknown relationship predicate; confirm both remain valid.
10. Put one valid and one malformed relationship in one note; confirm the valid assertion remains usable and only the malformed assertion is reported.
11. Reference a finding's entity through a selected Book Scene's exact `world_context`; confirm Continuity Review shows the same fingerprint/evidence identity.
12. Keep another global finding outside that Book; confirm Book filtering excludes it while global review retains it.
13. Exercise severity and kind filters, expand evidence, and confirm navigation opens the correct authoritative note.
14. Edit each defect and confirm settled metadata refresh removes or replaces only the affected finding.
15. Rename a disposable note through Obsidian; confirm links continue resolving and identity behaves according to the documented path-based best-effort contract.
16. Move a disposable note into local Trash; confirm the trash copy is excluded and dependent unresolved findings refresh.
17. Restore the note; confirm indexing and findings reconnect.
18. Rebuild the Story World index and confirm materially equivalent findings from unchanged Markdown.
19. Compare hashes and confirm viewing, filtering, expanding evidence and navigation changed no Story World, manuscript or editorial data.

Record the completed PRIME result here before merge, including finding sparsity, severity credibility, exact evidence, navigation, unknown/custom compatibility, optional-field silence, Book/global filtering, shared Continuity identity, rename/deletion/restoration, reproducibility and the no-write hash comparison.

## Completed PRIME result — 25 July 2026

The PRIME real-vault procedure passed. Book 2 findings were genuine structural defects rather than presentation noise. Most findings came from malformed legacy relationships created during the initial manual Story World seeding, before guided relationship authoring existed; the review also exposed copy-and-paste metadata errors from that seeding work. Guided relationship authoring now prevents most of this defect class, so the initial volume represents one-time legacy cleanup rather than expected steady-state noise.

- Broken targets, participants, sources, scope, relationship structure and event chronology produced sparse, understandable findings with credible severity.
- Canonical-name, alias and canonical-to-alias collisions explained the normalised collision while preserving the authored source values.
- Expanded rows showed exact property paths and structured Markdown evidence, and every navigation action opened the correct authoritative note.
- A note containing one valid and one malformed relationship retained the valid assertion and reported only the malformed record.
- Valid undated events, omitted optional scope, unknown predicates and custom entity types remained quiet. No material false-positive pattern was identified.
- Global review remained useful without an active Book. Current-Book filtering followed exact `world_context` and `world_scope`, excluding unrelated global findings.
- A Book-relevant finding appeared in Continuity Review with the same fingerprint and evidence identity as Story World Review.
- Metadata corrections refreshed affected findings deterministically. Ordinary rename kept references coherent within the documented path-identity limits.
- Deletion and movement into local Trash excluded the note and refreshed dependent findings; restoration reconnected the indexed note and current observations.
- Rebuilding the Story World index over unchanged Markdown reproduced materially equivalent findings.
- Before-and-after hashes confirmed that viewing, filtering, expanding evidence and navigating changed no Story World, manuscript or editorial Markdown/data.
