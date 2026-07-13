# Story World Entity Standard

**Version:** 0.1.0  
**Status:** Foundation specification  
**Issue:** #50

## Purpose

The Story World Entity Standard defines the smallest useful contract for describing fictional people, places, organisations, intelligences, systems, objects, events, concepts and documents in ordinary Obsidian Markdown.

It is deliberately permissive. The prose in an entity note remains the rich description; properties provide only enough structure for discovery, linking and later supporting models.

> Story-world canon belongs to Markdown notes. MWC presents and indexes it; MWC does not own or duplicate it.

## Explicit opt-in

A Markdown note is a Story World entity only when it has a non-empty `world_entity` property.

```yaml
---
world_entity: character
---
```

MWC must not infer entity status from folder placement, filename, tags, ordinary prose, `type`, `pov`, `location` or backlinks.

This allows gradual adoption and prevents existing manuscript notes from being reclassified accidentally.

## Primary kind and facets

`world_entity` is one scalar primary kind. It provides a stable, author-chosen answer to “what is this principally?” and is the default grouping value in derived views.

`world_facets` is an optional scalar or list describing additional roles or aspects.

```yaml
world_entity: intelligence
world_facets:
  - character
  - distributed-system
```

This is preferred to assigning hidden meaning to the first item in a multi-valued `world_entity` list. PRIME and JANUS can therefore be intelligences while also participating in the narrative as characters and technical systems.

### Recommended primary kinds

The initial recognised vocabulary is:

- `character`
- `location`
- `organisation`
- `intelligence`
- `system`
- `technology`
- `object`
- `event`
- `concept`
- `document`

The vocabulary is open. Unknown or custom values remain valid and indexable. Recognition may improve labels or grouping, but must never be a validation gate.

## Common properties

Only `world_entity` is required.

| Property | Accepted form | Meaning |
|---|---|---|
| `world_entity` | non-empty scalar string | Explicit opt-in and primary kind |
| `world_facets` | scalar string or list of strings | Additional roles or aspects |
| `world_name` | scalar string | Optional canonical display name |
| `aliases` | native Obsidian scalar or list | Ordinary interchangeable names |
| `world_designations` | list of mappings | Qualified observer-, institution- or time-specific names |
| `world_scope` | scalar or list of strings/wikilinks | Series, book, timeline or shared-world scope |
| `world_status` | scalar string | Canon/planning state; vocabulary is defined by #51 |
| `world_summary` | scalar string | Concise human-readable description |
| `world_first_appearance` | wikilink string | First manuscript or published appearance |
| `world_time` | ISO string or time mapping | Event or state time where relevant |
| `world_relationships` | list of mappings | Qualified relationship assertions; detailed conventions are defined by #52 |

Extra properties are permitted and preserved.

## Name resolution

A derived display name is resolved in this order:

1. non-empty `world_name`;
2. non-empty existing `title`;
3. Markdown filename without extension.

The resolved display name is derived. MWC must not write it back automatically.

## Ordinary aliases and qualified designations

Use native Obsidian `aliases` for names that are broadly interchangeable for the same note.

```yaml
aliases:
  - Tobias
  - Tobias Hale
```

Do not use an ordinary alias when a name belongs to a particular observer, institution, date or level of confidence. Use `world_designations` instead.

```yaml
world_designations:
  - name: PA-01
    assigned_by: "[[JANUS]]"
    as_of: "2029-01-20"
    source: "[[JANUS Monitoring]]"
    scope: internal
```

Each designation is a mapping with:

- required `name`;
- optional `assigned_by` wikilink;
- optional `as_of`, `valid_from` and `valid_until` ISO strings;
- optional `source` wikilink;
- optional `scope` string or list;
- optional `confidence` string or number;
- any additional qualifiers needed by the author.

Unknown qualifier keys are preserved. A designation is not promoted to an ordinary alias automatically.

## Time values

`world_time` may be an ISO 8601 date or datetime string:

```yaml
world_time: "2026-04-03T03:18:00+01:00"
```

Use a mapping when time is approximate, ranged or qualified:

```yaml
world_time:
  from: "2026-04-03T03:17:00+01:00"
  until: "2026-04-03T03:19:38+01:00"
  precision: observed-window
  source: "[[The Router]]"
```

A time mapping may contain:

- `at`, or `from` and/or `until`;
- optional `precision`;
- optional `timezone` when it is not encoded in the value;
- optional `source`;
- additional preserved qualifiers.

The standard must not manufacture precision. Conflicting source times remain separate qualified assertions rather than being silently reconciled.

## Relationship foundation

Relationships are not stored as a vague list of related notes. They are precise qualified assertions.

When stored on an entity note, the note is the implicit subject. Each item requires:

- a non-empty `predicate`;
- either a linked `target` or a literal `value`.

```yaml
world_relationships:
  - predicate: works_for
    target: "[[Northbridge Systems]]"
    source: "[[Quiet Load]]"
    as_of: "2026-04-05"
```

The architectural model is a qualified subject–predicate–object assertion. The author-facing concept is a **relationship statement** or, for broader facts and beliefs, a **world assertion**.

A non-technical author must never be required to understand or type raw triple syntax during normal use. Future authoring must use readable phrases, guided forms, progressive disclosure and sentence rendering.

Detailed predicate vocabulary, inverse handling, epistemic qualifiers, dedicated assertion notes and authoring behaviour belong to #52. Unknown predicates and qualifiers remain valid.

## Scope

`world_scope` limits where an entity or interpretation is intended to apply. It accepts one value or a list.

```yaml
world_scope:
  - "[[PRIME Trilogy]]"
  - "[[EMERGENCE]]"
```

Scope does not replace provenance or time. A note may be series-scoped while an individual designation or assertion is book- or date-specific.

## Status boundary

`world_status` is reserved for the canon/planning state defined by #51. Until that vocabulary is finalised:

- readers must preserve unknown values;
- missing status must not imply confirmed canon;
- planned or candidate material must not be presented as confirmed merely because the note is indexable.

## Parsing and preservation rules

Consumers of this standard must:

- accept scalar values where this specification permits scalar-or-list forms;
- normalise scalar-or-list fields to lists internally without rewriting the note;
- trim strings for interpretation while preserving the original Markdown;
- omit empty optional fields from derived presentation;
- ignore an individually malformed optional field without rejecting an otherwise valid entity;
- preserve unknown primary kinds, facets, predicates, qualifier keys and extra properties;
- distinguish duplicate names and aliases by vault path and scope;
- retain unresolved wikilinks as unresolved references rather than deleting them;
- never modify a note merely because it was read or indexed.

A missing or empty `world_entity` means the note is not opted into this standard.

## Entity notes and supporting models

An entity note describes a thing in the story world and remains the authority for its core identity and descriptive prose.

A supporting model explains relationships, chronology, knowledge, interpretation or editorial concerns across entities. It references entity notes rather than copying their core facts.

Complex, disputed, changing or multi-party assertions may later live in dedicated model/assertion notes under #52. The existence of those models does not make a derived index authoritative.

## Discovery by Obsidian tools

### MWC

MWC identifies entities by the presence of a non-empty `world_entity` property. The future index is derived and rebuildable and must not be stored in the editorial store.

### Dataview

A basic query may select entities with:

```dataview
TABLE world_entity, world_facets, world_status, world_summary
WHERE world_entity
```

### Bases

An Obsidian Base may filter for records where `world_entity` is present. Folder placement remains optional navigation rather than identity.

## Author-facing principle

The stored representation may be structured. The author experience must remain literary and readable.

> Store relationships and designations precisely. Present them as ordinary language, guided choices and understandable statements.

## Compatibility and ownership

- Manuscript prose remains authoritative in chapter Markdown.
- Existing chapter properties retain their current meanings.
- Story-world properties use the `world_` namespace to avoid accidental collisions.
- No story-world fact is stored in `.murmuration/writing-companion/editorial-data.json`.
- Merely adopting the standard does not require changing existing prose links, `pov`, `location` or compiler metadata.
- Existing compiler, Bases, Dataview and ordinary Obsidian wikilink behaviour must remain unaffected.

## Examples

See [`docs/examples/story-world/`](examples/story-world/) for PRIME-based examples covering a character, location, organisation, intelligence/system and event.

These are schema examples only. They are not written into the PRIME Trilogy vault and do not independently establish canon.