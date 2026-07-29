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

## Refresh and authority

The graph follows the active indexed Story World note only before manual graph traversal or after **Follow active note**. It refreshes through existing metadata, create, rename, deletion, local-Trash restoration, index and selected-Book routes. Trash notes remain excluded by the existing index and resolver. Centre history is memory-only presentation state.

Story World and manuscript Markdown remain authoritative. Graph content, filters and layout are presentation state only. Opening, filtering, selecting and navigating call no Story World write service and never create, repair, merge, rename or delete notes. Relationship editing remains in the relationship workspace; event editing remains in the event and timeline workspaces.

## Deliberate exclusions

The graph has no direct graph editing, unrestricted whole-world mode, second-hop traversal, persistent/collaborative layout, graph history beyond local in-memory centre navigation, semantic clustering, knowledge inference, co-occurrence edges, prose/backlink analysis, AI summaries or export. Selective branch expansion may be considered as a future enhancement, but it is not part of this focused implementation. Series-specific filtering is represented through current explicit scope values and the unscoped/current-Book choices; an arbitrary visual query language is out of scope.
