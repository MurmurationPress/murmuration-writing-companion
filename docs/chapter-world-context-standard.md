# Chapter World Context Standard

For practical authoring, start with [Writing with MWC](../Help/Writing_with_MWC.md). The [Canonical Property Reference](../Help/Property_Reference.md) is the concise author-facing schema; this standard provides the deeper derivation and preservation contract.

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

A resolved POV link to an indexed Story World entity contributes automatically to derived World Context. The author does not repeat it in `world_context`:

```yaml
pov: "[[Pip]]"
world_context:
  - "[[The Article]]"
```

In this example, Pip appears once with POV relevance and The Article appears as explicit broader context.

If the same resolved entity appears through both `pov` and `world_context`, MWC may retain both relevance reasons internally while displaying the entity only once. Plain-text POV values, unresolved POV links and POV-only characters do not affect World Context diagnostics.

## Relationship with `location`

`location` remains the canonical manuscript Scene property. Existing human-readable free text remains valid and editable:

```yaml
location: Halcyon Pharmaceuticals (Essex)
```

MWC never guesses an entity from free text or migrates it automatically. When the author selects an indexed Story World Location through Chapter Context, MWC writes a canonical wikilink to the same `location` property:

```yaml
location: "[[Story World/Locations/Halcyon Pharmaceuticals]]"
```

A resolved link contributes that entity automatically to derived World Context only when its target has `world_entity: location`, case-insensitively. Repeating it in `world_context` is unnecessary; if present, both references resolve to one displayed entity by canonical vault path. Unresolved links and links to non-Location entities remain authored values but do not contribute semantic Location context.

This retains the established compiler-facing `location` value while removing the need for duplicate Story World metadata. MWC does not introduce a `locations` property.

## No prose or backlink inference

MWC does not add context from ordinary prose mentions, prose wikilinks, backlinks, tags, folder placement, free-text `location`, filename similarity or model inference.

Derived World Context combines recognized semantic manuscript fields (`pov` and `location`) with explicit `world_context` entries.

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
- the same resolved Location in `location` and `world_context` displays once;
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
- convert plain-text locations into wikilinks without an explicit author selection;
- create missing entity notes;
- change entity status;
- write Story World data into `.murmuration/writing-companion/editorial-data.json`.

The chapter frontmatter and Story World notes remain authoritative Markdown.

## Example presentation

This source:

```yaml
pov: "[[Tobias Hale]]"
location: "[[Story World/Locations/Halcyon Pharmaceuticals]]"
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
>
> **Locations**
> Halcyon Pharmaceuticals

Tobias and Halcyon Pharmaceuticals contribute from their semantic manuscript fields without being copied into `world_context`.

## Compatibility

- Existing free-text or unresolved `location`, `pov`, `story_date`, compiler and editorial properties retain their authored meanings.
- Ordinary Obsidian wikilinks and aliases remain authoritative for navigation.
- Bases and Dataview may inspect `world_context` directly without MWC.
- Unknown frontmatter properties remain preserved.
- The convention does not require a particular folder structure.
- Temporal Reasoning may later add explainable relative timing to event cards without changing this authority model.
