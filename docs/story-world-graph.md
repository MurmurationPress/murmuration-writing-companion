# Story World graph views

Issue #112 adds a focused **Story World Graph** centre-pane view for the currently selected indexed entity, event or supporting model. Open it through the diamond action in the Story World Navigator, **Open graph** in the Entity Inspector, or the **Open Story World Graph** command.

## Derived content contract

The graph is a disposable projection over existing indexed identity and explicit metadata. Nodes carry the authoritative note path, indexed entity/model type, label, status, scope, #111 observation fingerprints and a compact #133 manuscript-impact count. Edges carry a stable derived ID, authored direction, explicit predicate or connection kind, source note and exact assertion path, status, validity evidence, provenance category and deterministic evidence identity.

The initial edge categories are:

- entity-owned `world_relationships` assertions;
- explicit event participants;
- optional event-to-manuscript `world_sources` provenance;
- explicit supporting-model subjects;
- explicit timeline assertions between indexed events.

Unknown entity types and predicates remain visible. Malformed or unresolved relationships do not become misleading complete edges; they remain in an adjacent diagnostic list linked to the same #111 observation identity.

No inverse registry currently exists. The graph therefore renders the authored edge direction only and does not invent inverse edges. If a future explicit predicate registry defines inverses, a derived inverse must retain the authored assertion identity and be labelled as derived.

## Neighbourhood and layout

The graph is intentionally a focused neighbourhood of exactly one explicit hop from the selection. Neighbours' unrelated edges are not traversed, and there is no whole-world or second-hop expansion. Filters apply to this neighbourhood, while the 36-node limit and omitted-count reporting protect readability and performance.

Layout is deterministic radial placement: the selection is centred and sorted neighbour IDs receive stable positions around it. Compact, Comfortable (default) and Spacious presets change bounded layout spacing only. There is no force simulation, continual motion, drag-to-edit behaviour or persisted position authority. The same centre, filters, density and viewport produce equivalent positions.

A maximum of 36 nodes protects large selections such as PRIME or JANUS. Truncation is explicit and reports the omitted count; predicate, status, node-type, validity and scope filters reduce the neighbourhood. Duplicate visual edges with equivalent authored semantics collapse deterministically while retaining a source assertion identity.

## Filters and interaction

Filters use only current structured data:

- predicate;
- relationship status;
- node category;
- all explicit scope, exact current-Book relevance, or unscoped items;
- active, future, expired or indeterminate validity against an explicitly entered reference date;
- optional manuscript-source Scene nodes for a selected event.

Validity uses the shared temporal interval parser and preserves the authored evidence. No current story date is invented. Node shape communicates type, with events using a chevron/process shape. Solid outlines and edges mean confirmed; dashed outlines and edges mean provisional or unconfirmed. Relationship labels show predicates without redundant status text; exact status remains in filters, accessible labels and detail inspection. Centre fill/emphasis is independent of status.

Nodes and edges are keyboard-focusable. Activating an entity, event or supporting-model node makes it the graph centre and rebuilds its one-hop neighbourhood without opening Markdown. Activating a source Scene selects its details without recentering. The selected-node panel provides the separate **Open note** action; native button Enter opens it. Activating an edge selects its predicate, status, validity and exact source assertion, while **Open source assertion** is a separate action. Review markers route to the existing Story World Review observation by fingerprint. The impact action deliberately opens the selected note's existing Entity Inspector and #133 impact section.

## Centre navigation and active-note following

Graph centre and Obsidian active note are distinct:

- on initial opening, and until the author traverses the graph, the centre follows the active indexed entity or supporting model;
- selecting a graph node starts manual graph navigation and no later active-note change silently replaces that centre;
- **Follow active note** explicitly resynchronises and resumes following;
- **Back** and **Forward** traverse local centre history, suppress consecutive duplicates and discard the Forward branch after new traversal;
- deletion removes unavailable history entries, ordinary rename translates them, and restoration is available again through current navigation or Follow active note;
- source-Scene selection and edge selection affect only transient details, not centre history.

Tab reaches controls, graph nodes and detail actions. Enter on a graph node selects or recentres it; Enter on **Open note** or **Open source assertion** performs the explicit Markdown navigation. Alt+Left and Alt+Right mirror Back and Forward. Escape clears transient node or edge detail. No double-click or hover is required.

## Temporal inspection

**Temporal mode** adds a read-only change-point slider to the same focused graph. Slider positions are meaningful dated evidence points, not calendar days. They are sorted by effective story date, authoritative distributed manuscript sequence where present, source path and stable assertion identity. The label shows the effective date, a supporting Scene or Event when available and the number of changes. Previous and Next move one evidence point; with zero or one point the irrelevant controls are disabled and explained. Changing perspective, display mode, density or ordinary filters retains the selected point when it still exists.

The disposable evidence normalizer uses explicit relationship bounds, Event `world_time`, dated `world_sources` Scenes and explicit relationship provenance. An unambiguous first dated source may supply an in-memory effective `valid_from`; it is labelled as derived and is never written back. `valid_to` and the established `valid_until` spelling are optional. A relationship persists after its introduction until an explicit end, contradiction, supersession or supported non-current status: silence and a lack of recent mentions never imply expiry. Event effective time and source-Scene reveal time remain separate: their dates may legitimately differ and do not constitute a contradiction. A genuinely malformed effective date is excluded with its exact source and parser reason in an expandable graph diagnostic; it is not described as a Continuity Review finding unless an existing continuity rule reports it.

The perspectives answer distinct questions:

- **World time** shows relationships supported as existing at the selected story date, independent of manuscript reveal order.
- **Entity knowledge** shows only evidence explicitly associated with the centred entity through participation, explicit knowledge metadata or explicit `world_context`; missing evidence stays unknown and graph proximity never supplies mental state.
- **Reader knowledge** accumulates by authoritative Book/Part/Scene order and resolved source evidence. It never falls back to filename order, so a later manuscript Scene can reveal an earlier-world fact.

The display modes are **Evidence at this date** for the exact point, **Known by this date** for cumulative still-current state and **Changes at this date** for additions, endings, contradictions and supersessions. Older cumulative edges are subdued but remain current. Strong introduction strokes, text markers (`+ introduced`, `⊣ ended`, `× contradicted`, `⇢ superseded`) and distinct line patterns keep temporal meaning available without colour alone; provisional dashed styling remains independent.

Selecting a temporal edge extends the existing graph detail surface with source note, supporting Scene/Event, effective date, manuscript sequence, change kind and explicit-versus-derived time. Ended, contradicted and superseded evidence remains inspectable at its change point even though it is absent from later current state. Undated evidence is excluded from the slider, counted explicitly and never assigned an arbitrary date.

## Refresh and authority

The graph follows the active indexed Story World note only before manual graph traversal or after **Follow active note**. It refreshes through existing metadata, create, rename, deletion, local-Trash restoration, index and selected-Book routes. Trash notes remain excluded by the existing index and resolver. Centre history is memory-only presentation state.

Story World and manuscript Markdown remain authoritative. Graph content, filters, temporal evidence, slider position and layout are presentation state only. Opening, filtering, selecting, temporal-mode activation, slider movement, perspective/display changes, provenance inspection and index rebuild call no Story World, manuscript or editorial-store write service. Relationship editing remains in the relationship workspace; event editing remains in the event and timeline workspaces.

## Deliberate exclusions

The first temporal version has no autoplay, animation, direct graph editing, automatic relationship expiry, mandatory temporal bounds, inferred mental state, unrestricted whole-world mode, automatic second-hop traversal, persistent temporal database, publication rendering, prose/backlink inference, AI summaries or export. Selective branch expansion may be considered later. Publication remains outside MWC and no Codex Press contract is involved.
