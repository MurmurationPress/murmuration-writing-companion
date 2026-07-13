# Chapter World Context Standard

**Version:** 0.1.0  
**Status:** Foundation specification  
**Issue:** #55

## Purpose

A chapter often depends on people, places, organisations, systems, events and concepts that are not present in its existing metadata. The Chapter World Context Standard gives the author one explicit, lightweight way to identify those relevant Story World entities without scanning prose or turning the manuscript into a database.

> The chapter identifies what matters here. The Story World note remains authoritative about what that thing is.

The convention is read-only for MWC during the 0.14.0 foundation milestone.

## Canonical property

The canonical chapter property is `world_context`.

```yaml
world_context:
  - "[[Tobias Hale]]"
  - "[[Northbridge Systems]]"
  - "[[Halcyon Pharmaceuticals]]"
  - "[[Halcyon incident]]"
```

`world_context` records relevance to the chapter. It does not establish canon, copy entity facts or change the status of a referenced entity.

The property does not make a note into a chapter. Existing manuscript structure and chapter detection remain unchanged.

## Accepted forms

`world_context` accepts either:

- one wikilink string; or
- a list of wikilink strings.

### Scalar

```yaml
world_context: "[[PRIME]]"
```

### List

```yaml
world_context:
  - "[[PRIME]]"
  - "[[JANUS]]"
```

Quoted wikilink strings are recommended because they remain unambiguous YAML and work naturally with Obsidian Properties, Bases and Dataview.

Consumers normalise a scalar to a one-item list internally. They must not rewrite the chapter merely to change its stored form.

Empty values, non-string list items and unsupported nested structures are ignored for derived presentation but remain untouched in Markdown.

## What may be referenced

In the foundation milestone, a resolved `world_context` entry contributes to World Context only when its target note has a non-empty `world_entity` property under the [Story World Entity Standard](story-world-entity-standard.md).

A link to an ordinary note does not promote that note into the Story World. A note with only `world_model` is not included unless it also deliberately opts in as a `world_entity`.

Events, documents, concepts and intelligences are valid context because they are recognised entity kinds, not because they occupy a particular folder.

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

`pov` remains the authoritative chapter property for point of view. It is not copied into `world_context`.

A POV reference is included automatically in the derived World Context set when:

1. the `pov` value is a wikilink string, or a list containing wikilink strings;
2. the link resolves successfully; and
3. the target note has a non-empty `world_entity` property.

```yaml
pov: "[[Pip]]"
world_context:
  - "[[Robin]]"
```

The derived set contains Pip and Robin. The author does not need to repeat `[[Pip]]` in `world_context`.

This is not prose inference. `pov` is already explicit, author-maintained manuscript metadata.

Plain-text POV values, unresolved POV links and POV notes that have not opted into the Story World do not contribute automatically. A value such as `[[External]]` is included only when it resolves to a deliberately opted-in Story World entity.

## Relationship with `location`

`location` keeps its existing manuscript meaning and may remain human-readable free text.

```yaml
location: Halcyon Pharmaceuticals (Essex)
```

MWC does not rewrite, parse or automatically promote `location` into World Context during the foundation milestone, even when the value resembles a link. To include a location entity, the author adds it explicitly:

```yaml
location: Halcyon Pharmaceuticals (Essex)
world_context:
  - "[[Halcyon Pharmaceuticals]]"
```

This avoids changing established compiler, reporting and authoring behaviour.

## No prose or backlink inference

MWC does not add context from:

- ordinary prose mentions;
- prose wikilinks;
- backlinks;
- tags;
- folder placement;
- `location`;
- filename similarity;
- model inference.

Only recognised POV references and explicit `world_context` entries form the chapter's context set in the first implementation.

## Combining and ordering

The derived chapter context set is assembled as follows:

1. resolved Story World entities from `pov`, in stored order;
2. resolved Story World entities from `world_context`, in stored order;
3. duplicate targets removed by resolved vault path.

The original Markdown order remains unchanged. A later view may group entities by kind for readability, but grouping is a derived presentation and does not reorder the property.

When the same entity appears through POV and explicit context, the derived item may retain both reasons for relevance while displaying the entity only once.

## Canon status and context

An explicit chapter reference says that an entity is relevant. It does not say that every fact in the entity note is confirmed.

Consumers apply the [Canon Status and Provenance Standard](canon-status-and-provenance.md):

- Confirmed material may appear as current canon.
- Planned and Candidate material remains visibly provisional.
- Unresolved material retains its ambiguity.
- Superseded material is not restored to current canon by being referenced.
- Missing status remains Unclassified.

The reference itself carries no inherited status in version 0.1. More specific, role-qualified chapter references are outside this foundation story.

## Missing, duplicate and unresolved references

Consumers must degrade quietly:

- missing `world_context` means no explicit additions;
- an empty list means no explicit additions;
- duplicate links display one resolved entity;
- alias and path variants resolving to the same note display one entity;
- unresolved links are omitted from normal World Context or shown through a quiet diagnostic treatment;
- links to notes without `world_entity` are ignored for Story World presentation;
- one malformed entry does not invalidate the other entries.

No missing or unresolved reference is treated as an error that interrupts writing.

## Read-only and preservation rules

Reading, indexing or presenting chapter context must never:

- add `world_context` automatically;
- copy POV into `world_context`;
- normalise scalar values into lists on disk;
- rewrite aliases or path-qualified links;
- convert plain-text locations into wikilinks;
- create missing entity notes;
- change entity status;
- write Story World data into `.murmuration/writing-companion/editorial-data.json`.

The chapter frontmatter and Story World notes remain authoritative Markdown.

## Author-facing presentation

A future World Context section should present resolved references as concise entity cards or rows using the entity's name, kind, summary and clearly labelled status. The raw property name and wikilink syntax should not dominate the normal writing experience.

For example, this source:

```yaml
pov: "[[Tobias Hale]]"
world_context:
  - "[[Northbridge Systems]]"
  - "[[Halcyon incident]]"
```

may be presented as:

> **Tobias Hale** — Character · POV  
> Engineer and systems investigator.
>
> **Northbridge Systems** — Organisation  
> Infrastructure-resilience consultancy.
>
> **Halcyon incident** — Event  
> The investigation that follows the first routing intervention.

The presentation is derived and rebuildable. It owns no canon.

## Compatibility

- Existing `pov`, `location`, `story_date`, compiler and editorial properties retain their meanings.
- Ordinary Obsidian wikilinks and aliases remain authoritative for navigation.
- Bases and Dataview may inspect `world_context` directly without MWC.
- Unknown frontmatter properties remain preserved.
- The convention does not require a particular folder structure.
- MWC consumes the property read-only during the foundation milestone.

## Examples

See [`docs/examples/story-world/chapters/`](examples/story-world/chapters/) for a simple POV-plus-entity chapter and a chapter referencing several entity kinds.

These examples are schema illustrations only. They are not written into the PRIME Trilogy vault and do not independently establish canon.