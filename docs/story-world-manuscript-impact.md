# Story World impact across the manuscript

Issue #133 adds a read-only **Impact Across Manuscript** section to the existing Story World Entity Inspector. Selecting an indexed entity or event in the Story World Navigator opens the ordinary inspector and derives the current impact projection from current vault metadata.

## Evidence model

- **Direct manuscript reference** means the Scene's authoritative `world_context` resolves exactly to the selected Story World note. Prose, backlinks, filenames and approximate names are never searched.
- **Derived temporal relevance** compares the Scene's explicit story-date alias with the selected item's `world_time` or explicit validity range using the shared `TemporalInterval` parser and comparison rules. Before, during and after are emitted only when the authored intervals prove them; partial precision is retained and may produce an indeterminate label.
- **Structured evidence** currently includes explicit Story World source/support links that resolve to an authoritative Scene.
- **Continuity involvement** reuses current Continuity Review observations only when their existing primary/evidence notes include both the selected item and Scene. No continuity rule is recreated here.

Evidence categories collapse into one Scene row and remain visibly separate badges. Results use each Book's authoritative flattened Scene projection and are grouped by Book and recognised Part. Clicking a result opens that exact authoritative Scene through normal Obsidian navigation.

## Authority and refresh

The projection is disposable and rebuilt on render. It stores no canon, dependency or editorial state and calls no Markdown mutation service. Existing Story World indexing, manuscript integrity reconciliation, metadata-cache, selected-Book and inspector refresh paths cover changes to references, dates, order, relationships, observations, rename, deletion and restoration.

Filters include evidence category, proven temporal relation and current selected Book. With no selected Book, the current-Book filter is empty rather than inferring scope from the active note.

Broadly referenced entities can legitimately produce many rows because every exact `world_context` reference is authoritative evidence. The view exposes evidence and timing filters but does not rank, suppress or reinterpret authored references.

## Partial support

Indexed entities, events and unconventional entity types share the same projection. Events use `world_time`; other items may use explicit `valid_from`/`valid_until`. Relationship validity is supported by the pure impact contract, but relationships are embedded assertions without standalone indexed identity or a settled selection surface. The initial UI therefore remains entity/event selected and does not fabricate relationship identity; a future relationship-selection entry point can feed the same contract.

The [Story World Graph](story-world-graph.md) shows the selected item's current impact count and routes to this existing inspector section. It does not reproduce impact rules or render all impacted Scenes as graph nodes. Scene nodes are limited to explicitly enabled event-source provenance.

Undated or malformed selected items explain why temporal evidence is unavailable while retaining direct, structured and continuity evidence. Undated Scenes can likewise appear through non-temporal evidence.
