# Supporting Model Conventions

**Version:** 0.1.0  
**Status:** Foundation specification  
**Issue:** #52

## Purpose

Supporting models help an author understand relationships, chronology, character development, institutions, locations, technologies, continuity and knowledge across a story world.

They do not replace Story World entity notes or become a second store of copied canon.

> The Story World records what is true. Supporting models explain how those truths relate for a particular authorial purpose.

> Store relationships as precise, qualified assertions. Present them to the author as readable statements and guided forms.

## Three layers

### Entity notes

A Story World entity note owns an entity's identity and descriptive prose. It opts in through `world_entity` under the [Story World Entity Standard](story-world-entity-standard.md).

### Stored supporting models

A stored model is ordinary Markdown containing author-maintained structure or interpretation that cannot be reconstructed safely from entity notes alone. Examples include a changing relationship, relative event sequence, character-arc interpretation, disputed institutional model, point-of-view knowledge state or continuity constraint.

A model references entities and sources. It does not copy their names, summaries or core prose merely to be self-contained.

### Derived views and indexes

A derived view may group, filter, sort, render sentences, show registered inverses or assemble a graph. It owns no canon. Rebuilding it must not lose author-maintained knowledge.

## Explicit opt-in

A note is a supporting model only when it has a non-empty `world_model` property.

```yaml
---
world_model: relationship
---
```

Folder placement, filename, tags, backlinks and prose do not imply model status.

`world_model` and `world_entity` are separate opt-ins. A note may carry both deliberately, but separate notes are normally clearer when identity and interpretation have different lifecycles.

Recommended model kinds are:

- `relationship`;
- `timeline`;
- `character-arc`;
- `knowledge-state`;
- `institution`;
- `location`;
- `technology`;
- `continuity`;
- `assertion`.

The vocabulary is open. Unknown model kinds remain valid.

A model may use `world_model_subject` for its principal focus:

```yaml
world_model: character-arc
world_model_subject: "[[Tobias Hale]]"
```

This accepts one wikilink or a list. It is navigational context, not the subject of every assertion in the model.

## Ownership

### Simple entity-owned relationship

A relationship that belongs naturally to one entity may live in that entity note's `world_relationships`. The containing entity is the implicit subject.

```yaml
world_relationships:
  - predicate: parent_of
    target: "[[Robin]]"
    status: confirmed
    source: "[[Domestic Distance]]"
```

The assertion is authoritative there. Views may render it but must not create another authoritative copy.

### Dedicated assertion note

Use a dedicated model note when a relationship has its own lifecycle, substantial explanation, several sources, changing validity, disputed interpretations or no natural entity owner.

```yaml
---
world_model: relationship
subject: "[[Tobias Hale]]"
predicate: works_for
target: "[[Northbridge Systems]]"
status: confirmed
valid_from: "2026-04-05"
source: "[[Quiet Load]]"
---
```

A dedicated assertion requires an explicit `subject`. The note owns the assertion; entity notes should link to it rather than duplicate it.

### Several assertions in one model

A model may own several related statements through `world_assertions`:

```yaml
world_model: timeline
world_assertions:
  - subject: "[[First routing intervention]]"
    predicate: precedes
    target: "[[Halcyon incident]]"
    status: confirmed
    source:
      - "[[The Router]]"
      - "[[Quiet Load]]"
```

Each item requires an explicit subject because the containing note is a model, not an entity. Assertions already authoritative elsewhere must be referenced or derived, not copied into this list for convenience.

## Qualified assertions

The internal foundation is:

> subject | predicate | object

The object is represented by exactly one of:

- `target` — a wikilink to an addressable note;
- `value` — a literal string, number or boolean.

An inline entity-owned assertion requires a non-empty `predicate` and exactly one non-empty `target` or `value`. A dedicated or grouped assertion additionally requires a non-empty `subject` wikilink.

An incomplete or ambiguous assertion is preserved but must not be rendered as settled fact.

### Optional qualifiers

| Qualifier | Meaning |
|---|---|
| `predicate_label` | Readable phrase for a custom predicate |
| `status`, `status_note` | Authorial status and explanation |
| `source` | One source wikilink or a list |
| `as_of` | Snapshot date or datetime |
| `valid_from`, `valid_until` | In-world validity bounds |
| `time_precision` | Author-supplied precision such as `year` or `approximate` |
| `asserted_by` | Character, institution or model holding or issuing the claim |
| `confidence` | In-world confidence of that holder or model |
| `scope` | Book, series, timeline or model scope |
| `visibility` | Circulation state such as public, restricted or private |
| `audience` | Intended or actual audience |
| `hidden_from` | Explicit knowledge boundary |
| `replaces`, `replaced_by` | Assertion replacement history |

Unknown qualifier keys remain valid and are preserved.

## Status, provenance and time

The [Canon Status and Provenance Standard](canon-status-and-provenance.md) applies to assertions.

- Confirmed means the author has settled the assertion itself.
- Planned and Candidate remain visibly provisional.
- Unresolved preserves deliberate ambiguity.
- Superseded remains discoverable but is not current by default.
- Missing status is Unclassified, never implicitly Confirmed.

A source records evidence or decision history; it does not make a claim objectively true.

`as_of`, `valid_from` and `valid_until` describe story time and do not replace status. Omit unknown bounds rather than inventing precision. Intrinsic event time belongs on the event entity through `world_time`; a supporting model should not copy that date merely to sort a timeline.

## Perspective, belief and knowledge

Objective world truth, a character's belief and an institution's model are different things.

Use direct predicates such as `knows`, `believes`, `suspects`, `infers` or `doubts` when the statement is fundamentally about a holder. Use `asserted_by` when the ordinary subject and predicate should be retained but the claim belongs to a particular observer or institution.

`confidence` is in-world confidence and never supplies authorial status. `visibility`, `audience` and `hidden_from` record explicit boundaries only; they must not be inferred from absence or prose.

```yaml
subject: "[[JANUS]]"
predicate: believes
value: PRIME has been excluded
status: confirmed
confidence: low-moderate
source: "[[JANUS Monitoring]]"
as_of: "2029-01-20"
```

This confirms that JANUS holds the belief. It does not confirm the belief's object as objective truth.

## Predicates

Predicates use stable lowercase identifiers, normally `snake_case`. They should be directional from subject to object and specific enough to communicate meaning. Avoid `related_to` when a meaningful relationship is available.

Initial recommendations include:

| Predicate | Author-facing phrase | Explicit inverse |
|---|---|---|
| `works_for` | works for | `employs` |
| `parent_of` | is parent of | `child_of` |
| `member_of` | is a member of | `has_member` |
| `located_in` | is located in | `contains` |
| `created_by` | was created by | `created` |
| `participates_in` | participates in | `has_participant` |
| `precedes` | precedes | `follows` |
| `authored` | authored | `authored_by` |
| `performs` | performs | `performed_by` |
| `controls` | controls | none by default |
| `depends_on` | depends on | none by default |
| `opposes` | opposes | none by default |
| `observes` | observes | none by default |
| `conceals_from` | conceals from | none by default |
| `knows` | knows | none |
| `believes` | believes | none |
| `suspects` | suspects | none |
| `designates` | designates as | none by default |

This is an open registry, not a closed ontology. Custom predicates remain valid and may provide `predicate_label` for presentation.

## Derived inverses

A view may show an inverse without storing a duplicate only when the registry defines one explicitly.

From `Pip parent_of Robin`, it may derive “Robin is child of Pip.” The derived inverse swaps subject and target, uses the registered predicate, carries the same qualifiers and points back to the original assertion. It is never written into Robin's note merely by viewing it.

Unknown predicates have no guessed inverse. Symmetry and transitivity are not inferred in the foundation milestone.

## Entity relationship or dedicated model?

Keep a statement in `world_relationships` when it is simple, naturally owned by the entity, about one subject and one object, and understandable with few qualifiers.

Prefer a dedicated model when it changes over time, is disputed or observer-specific, has several sources, involves more than two entities, needs its own prose, appears across several models or must be reviewed and superseded independently.

Do not turn every simple relationship into a model note merely because the storage format permits it.

## Model-specific ownership

### Timeline

Event entities own their intrinsic dates and descriptions. A timeline model owns only author-maintained sequence, grouping, uncertainty or interpretation that cannot be rebuilt safely. A derived timeline may sort by `world_time` without storing the result.

### Character arc

A character entity owns identity and core facts. A character-arc model owns the author's interpretation of development across referenced events, choices and states. Planned arc material does not change the status of the character.

### Institutions, locations and technologies

Entity notes own identity and intrinsic description. Models own changing participation, dependency, control, jurisdiction, movement or cross-entity interpretation. A chart or graph is derived when all its edges already exist elsewhere.

### Continuity

A continuity model may store an author-maintained rule, constraint, question or chosen interpretation. Automated warnings are derived and are not canon.

### Knowledge state

A knowledge-state model records what a character, institution or system knows, believes, suspects, infers or conceals at a particular story point. It must not collapse the holder's model into objective truth.

## Stored Markdown or derived output?

Store Markdown when the model contains an authorial choice, interpretation, ordering, uncertainty, knowledge boundary or explanation that cannot be reconstructed safely.

Derive output when it only groups entities, resolves names, filters status, sorts existing time values, renders sentences, shows registered inverses, assembles a graph or produces reports.

Derived caches are disposable and must never become the only copy of author-maintained knowledge.

## Conflicts and incomplete information

- Conflicting assertions may coexist when perspective, time, source or status differs.
- A deliberate open conflict uses `status: unresolved` rather than being reconciled silently.
- Superseded assertions remain discoverable.
- Unknown predicates and qualifiers are preserved.
- Broken wikilinks remain unresolved references rather than being deleted.
- Incomplete assertions are retained but not rendered as settled facts.
- Similar assertions are not deduplicated automatically because qualifiers may differ.

Reading, indexing or displaying these states must not rewrite source Markdown.

## Author-facing rendering

Every valid assertion must be renderable as understandable language without exposing raw property names or triple syntax.

Examples:

> Pip is Robin's parent. Confirmed; established in *Domestic Distance*.

> Candidate: Tobias Hale works for Northbridge Systems from 5 April until sometime in 2026. The end date remains unsettled.

> The first routing intervention precedes the Halcyon incident. Confirmed; established from *The Router* and *Quiet Load*.

> As of 20 January 2029, JANUS believes PRIME has been excluded. This is JANUS's belief, held with low–moderate confidence; it is not objective world truth.

Presentation must not turn missing status into Confirmed or omit a perspective holder in a way that makes a belief sound objective.

## Future authoring

A non-technical author must never be required to type raw triples, predicate identifiers or qualifier keys during normal use.

Future guided authoring should ask who or what the statement concerns, offer a readable relationship phrase, ask for the target or state, reveal qualifiers only when useful, and render the complete sentence before acceptance.

Simple statements remain simple. Recording “Pip is Robin's parent” must not require dates, confidence or knowledge qualifiers.

## Compatibility

Consumers must preserve unknown model kinds, predicates and qualifiers; accept documented scalar-or-list forms; distinguish model-note status from assertion status; avoid implicit status inheritance; retain unresolved references non-destructively; and never place Story World authority in `.murmuration/writing-companion/editorial-data.json`.

Existing manuscript, compiler, Bases, Dataview and wikilink behaviour remains unaffected. MWC uses supporting models read-only during the 0.14.0 foundation milestone.

## Examples

See [`docs/examples/story-world/`](examples/story-world/) and [`docs/examples/story-world/models/`](examples/story-world/models/) for PRIME-based examples of a simple entity relationship, a time-bounded relationship, a timeline relationship and a point-of-view knowledge state.

These examples are schema illustrations. They are not written into the PRIME Trilogy vault and do not independently establish canon.