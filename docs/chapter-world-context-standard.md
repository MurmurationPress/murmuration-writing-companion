# Chapter World Context Standard

**Version:** 0.2.0  
**Status:** Event-first presentation  
**Issues:** #55, #67, #68

## Purpose

A chapter often depends on people, places, organisations, systems, events and concepts that are not present in its ordinary chapter metadata. The `world_context` property gives the author one explicit, lightweight way to identify those relevant Story World entities without scanning prose or turning the manuscript into a database.

> The chapter identifies what matters here. The Story World note remains authoritative about what that thing is.

MWC consumes this context read-only. It does not infer relevance from prose and it does not copy Story World facts into editorial storage.

## Canonical property

The canonical chapter property is `world_context`.

```yaml
world_context:
  - "[[The Article]]"
  - "[[Tobias Hale]]"
  - "[[Northbridge Systems]]"
```

`world_context` records relevance to the chapter. It does not establish canon, copy entity facts or change the status of a referenced entity.

The property accepts either one wikilink string or a list of wikilink strings.

```yaml
world_context: "[[PRIME]]"
```

```yaml
world_context:
  - "[[PRIME]]"
  - "[[JANUS]]"
```

Quoted wikilinks are recommended because they remain unambiguous YAML and work naturally with Obsidian Properties, Bases and Dataview.

Consumers normalise a scalar to a one-item list internally. They do not rewrite the chapter merely to change its stored form. Empty values, non-string list items and unsupported nested structures are ignored for presentation but remain untouched in Markdown.

## What may be referenced

A resolved `world_context` entry contributes to World Context only when its target note has a non-empty `world_entity` property under the [Story World Entity Standard](story-world-entity-standard.md).

A link to an ordinary note does not promote that note into the Story World. Events, documents, concepts and intelligences are valid context because they are recognised entity kinds, not because they occupy a particular folder.

## Link resolution

References use ordinary Obsidian wikilink forms.

```yaml
world_context:
  - "[[Tobias Hale]]"
  - "[[Characters/Tobias Hale|Tobias]]"
  - "[[Story World/Characters/Tobias Hale|Tobias Hale]]"
```

Consumers resolve links relative to the chapter using normal vault link semantics.

- A simple link may resolve by note name or registered alias.
- A display alias after `|` changes presentation, not identity.
- A path-qualified link disambiguates notes with the same name.
- Different links that resolve to the same vault path identify one entity.
- An unresolved link remains an unresolved reference; it is not deleted, rewritten or converted into a new note.

The resolved entity's own `world_name`, title and filename rules determine its canonical display name. The link label does not overwrite that identity.

## Relationship with `pov`

`pov` remains the authoritative chapter property for point of view and is presented in Chapter Context.

A POV character is not automatically duplicated in World Context. To include that character in the event-and-supporting context for a particular chapter, the author references the character explicitly:

```yaml
pov: "[[Pip]]"
world_context:
  - "[[The Article]]"
  - "[[Pip]]"
```

In this example, Pip appears once in World Context because the explicit reference says that Pip is relevant beyond merely being the current POV.

If the same resolved entity appears through both `pov` and `world_context`, MWC may retain both relevance reasons internally while displaying the entity only once. Plain-text POV values, unresolved POV links and POV-only characters do not affect World Context diagnostics.

## Relationship with `location`

`location` keeps its existing manuscript meaning and may remain human-readable free text.

```yaml
location: Halcyon Pharmaceuticals (Essex)
```

MWC does not rewrite, parse or automatically promote `location` into World Context. To include a location entity, the author adds it explicitly:

```yaml
location: Halcyon Pharmaceuticals (Essex)
world_context:
  - "[[Halcyon Pharmaceuticals]]"
```

This avoids changing established compiler, reporting and authoring behaviour.

## No prose or backlink inference

MWC does not add context from ordinary prose mentions, prose wikilinks, backlinks, tags, folder placement, `location`, filename similarity or model inference.

Only explicit `world_context` entries form the displayed World Context set.

## Event-first hierarchy

World Context uses one intentional information hierarchy:

1. explicitly referenced events;
2. supporting entities grouped by their Story World entity type.

The source property remains in the author's stored order. Event-first ordering is a derived presentation only and does not rewrite Markdown.

Events receive the substantive presentation because they normally explain what the chapter is responding to, continuing or reframing. An event card may show:

- canonical name;
- authoritative `world_time` when present;
- canon status;
- concise `world_summary`;
- a link to the authoritative event note.

No relative date is calculated at this stage. Relative chapter timing belongs to Temporal Reasoning.

## Supporting entities

Characters, organisations, locations, technologies, intelligences and other non-event entities appear as compact linked names rather than permanent description cards.

The compact treatment keeps reference material available without crowding out the event context. Supporting links:

- open the authoritative Story World note through normal Obsidian navigation;
- use Obsidian's native hover-link interaction for transient preview where available;
- request the same preview on keyboard focus where the host interaction supports it;
- do not create, pin or store a separate preview object;
- do not expose density or per-type display settings.

Moving the pointer or keyboard focus away leaves preview lifecycle management to Obsidian's established page-preview behaviour.

## Canon status and context

An explicit chapter reference says that an entity is relevant. It does not say that every fact in the entity note is confirmed.

Consumers apply the [Canon Status and Provenance Standard](canon-status-and-provenance.md):

- Confirmed material may appear as current canon.
- Planned and Candidate material remains visibly provisional.
- Unresolved material retains its ambiguity.
- Superseded material is not restored to current canon by being referenced.
- Missing status remains Unclassified.

Event cards retain visible canon-status treatment. Supporting entity previews continue to read status and summary from authoritative Markdown or the rebuildable index.

## Missing, duplicate and unresolved references

Consumers degrade quietly:

- missing `world_context` means no displayed World Context;
- an empty list means no displayed World Context;
- duplicate links display one resolved entity;
- alias and path variants resolving to the same note display one entity;
- unresolved explicit links are omitted from normal presentation or shown through a quiet diagnostic treatment;
- links to notes without `world_entity` are ignored for Story World presentation;
- one malformed entry does not invalidate the other entries.

No missing or unresolved reference interrupts writing.

## Read-only and preservation rules

Reading, indexing, presenting or previewing chapter context must never:

- add or reorder `world_context` automatically;
- copy POV into `world_context`;
- normalise scalar values into lists on disk;
- rewrite aliases or path-qualified links;
- convert plain-text locations into wikilinks;
- create missing entity notes;
- change entity status;
- write Story World data into `.murmuration/writing-companion/editorial-data.json`.

The chapter frontmatter and Story World notes remain authoritative Markdown.

## Example presentation

This source:

```yaml
pov: "[[Tobias Hale]]"
world_context:
  - "[[Northbridge Systems]]"
  - "[[The Article]]"
  - "[[Pip]]"
```

is presented approximately as:

> **Events**  
> **The Article** · 2029-04-19 · Confirmed  
> Tobias publicly names PRIME and changes the operational environment.
>
> **Characters**  
> Pip
>
> **Organisations**  
> Northbridge Systems

Tobias remains visible in Chapter Context as POV but is not duplicated in World Context because Tobias was not explicitly referenced there.

## Compatibility

- Existing `pov`, `location`, `story_date`, compiler and editorial properties retain their meanings.
- Ordinary Obsidian wikilinks and aliases remain authoritative for navigation.
- Bases and Dataview may inspect `world_context` directly without MWC.
- Unknown frontmatter properties remain preserved.
- The convention does not require a particular folder structure.
- Temporal Reasoning may later add explainable relative timing to event cards without changing this authority model.
