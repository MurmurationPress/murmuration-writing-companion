# Story World

A Story World entity is an ordinary Markdown note that explicitly opts into MWC's index:

```yaml
world_entity: character
world_name: Pip
aliases: [Pippa]
world_status: confirmed
```

Only a non-empty scalar `world_entity` opts in. Matching is case-insensitive. Common kinds are `character`, `intelligence`, `event`, `location`, `organisation`, `technology`, `concept`, `system`, `object`, `document`, and `reference`. The vocabulary is open: custom scalar kinds remain valid and indexable.

`world_name` provides the preferred display name; otherwise MWC falls back to `title`, then filename. `aliases` are interchangeable lookup names. `world_facets` add secondary roles without changing the primary kind. `world_summary` supplies a concise description.

## Create and connect entities

Use Story World Navigator's creation actions, or accept an explicit creation offer for an unresolved wikilink in prose. Review the proposed note and confirm it before MWC writes. Folders, tags, prose, backlinks, and ordinary `type` never make a note an entity.

Use ordinary wikilinks to connect notes. Use Chapter Context for POV and Scene Location, and `world_context` for broader Scene relevance. `world_sources` records explicit provenance or manuscript evidence on an entity.

## Browse and review

- **Story World Navigator** browses entities and supporting models.
- **Entity Inspector** shows identity, status, time, relationships, sources, and manuscript impact.
- **Graph** projects explicit relationships, participants, provenance, and supported temporal evidence.
- **Timeline** places Events from explicit `world_time` and connects manuscript Scenes through explicit sources.
- **Story World Review** reports malformed or unresolved structured evidence without repairing it.
- **Entity Index** generates a disposable Markdown index from explicit occurrence evidence.

These are derived views. They do not replace or silently edit the source notes.

## Scope, status, and provenance

`world_scope` limits an entity or model to one or more explicit scopes, commonly Books. `world_status` describes the note-level authorial state: `confirmed`, `planned`, `candidate`, `unresolved`, or `superseded`. Missing means Unclassified; unknown values are preserved. Use `world_status_note` to explain the choice.

Use `confirmed` for settled current truth. Do not use legacy `canon` as a modern synonym: relationship compatibility is narrower, and entity-level `world_status: canon` is treated as a custom value.

`world_sources` holds explicit support links. `world_first_appearance` identifies the earliest manuscript or published appearance. Neither prose proximity nor backlinks become provenance automatically.

## Supporting models

A note with a non-empty scalar `world_model` joins supporting-model views. The vocabulary is open, but indexability does not imply specialised behaviour. Timeline models receive the established specialised assertion/chronology projection; other models remain useful structured authorial material without automatically receiving every graph or chronology feature. See the [Property Reference](Property_Reference.md) and technical [supporting-model conventions](../docs/supporting-model-conventions.md).
