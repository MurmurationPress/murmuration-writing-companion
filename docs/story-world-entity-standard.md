# Story World Entity Standard

**Version:** 0.1.2  
**Status:** Foundation specification  
**Issue:** #50

For ordinary authoring, start with [Story World Help](../Help/Story_World.md) and the [Canonical Property Reference](../Help/Property_Reference.md). This standard is the deeper entity contract and defers to the Help reference for the concise current property list.

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

The Story World Navigator projects this value as a collapsible category tree. Recognised kinds receive stable labels and ordering; unknown kinds receive a derived, readable category and remain visible. Collapse and search state are presentation preferences only. Moving a note between folders cannot change its category, relationships, scope or context behaviour.

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
| `world_status` | scalar string | Canon/planning state defined by the Canon Status and Provenance Standard |
| `world_status_note` | scalar string | Brief human explanation of the current status |
| `world_sources` | scalar or list of wikilinks | Notes, chapters or records supporting the item |
| `world_replaces` | scalar or list of wikilinks | Older items replaced by this item |
| `world_replaced_by` | scalar or list of wikilinks | Current replacement for a superseded item |
| `world_summary` | scalar string | Concise human-readable description |
| `world_first_appearance` | wikilink string | First manuscript or published appearance |
| `world_time` | ISO string or time mapping | Event or state time where relevant |
| `world_participants` | scalar or list of wikilinks | Canonical explicit Event participants |
| `world_relationships` | list of mappings | Simple entity-owned qualified assertions defined by the Supporting Model Conventions |
| `pov_eligible` | boolean | Explicit capability to appear in manuscript POV selectors; Character defaults to eligible when omitted |

Extra properties are permitted and preserved.

## Recognised type-specific properties

MWC may recognise an additive set of properties for a particular `world_entity` type. Recognition lets the creation and inspector UI label values semantically, constrain entity-reference choices, and make selected values available to derived consumers. It does not create a closed schema: unrecognised types and custom author properties remain valid, indexed and untouched.

The model is deliberately layered:

```text
common Story World properties
  -> recognised type-specific properties
  -> optional specialised profiles or behaviours
```

Type-specific values remain ordinary YAML in the entity note. Reading or displaying them never migrates or rewrites the note.

Typed properties may optionally name a reusable controlled vocabulary. Vocabularies are presentation and validation aids, not storage authority: closed technical vocabularies constrain only new guided selections, while permissive vocabularies can allow custom fictional values. Existing authored values outside a current vocabulary remain visible and untouched.

### POV guidance

`pov_eligible` and `pov_profile` are recognised for Character and Intelligence entities. `pov_profile` is constrained by the shared entity-reference mechanism to indexed `world_entity: pov-profile` notes. Assigning a profile implies POV eligibility unless an authored `pov_eligible: false` explicitly overrides it.

A POV Profile stores substantial narrative and representation guidance in its Markdown body. It may declare one semantic `pov_extends` link to another POV Profile. Effective resolution follows the Scene's semantic `pov` link to its entity, then follows the profile chain and presents profiles base-first. Paths already being visited terminate a cycle; each profile appears at most once. Missing and wrong-type references produce no writes and do not prevent ordinary Chapter Context from rendering.

The first implementation represents a variant as a specialised profile with `pov_extends`, rather than storing a `pov_variant` name on the entity. This keeps the effective variant's authored Markdown and provenance explicit without introducing a separate variant language.

POV guidance is a distinct Chapter Context projection, not an ordinary canon fact and not an implicit `world_context` entry. The pure projection is available to existing and future Chapter Context consumers without adding a second index or scanning the vault. Scene-local context remains authoritative for immediate state and exceptions.

### Location metadata

Location entities may use this initial recognised set:

| Property | Accepted form | Meaning |
|---|---|---|
| `address` | string | Author-useful street, postal or descriptive address |
| `latitude` | number from -90 to 90 | Geographic latitude |
| `longitude` | number from -180 to 180 | Geographic longitude |
| `timezone` | canonical IANA timezone identifier | Searchable guided selection such as `Europe/London` or `America/New_York`; offsets and abbreviations are not stored as authority |
| `parent_location` | wikilink to a Location entity | Containing place or region |

The guided parent selector offers only indexed Location entities. The timezone selector obtains the practical canonical identifier set from the supported JavaScript runtime, with a bundled IANA fallback for compatible older runtimes. Existing unknown timezone values, free-form properties, and custom location properties remain untouched, and none of these fields is required.

### Reference metadata

`Reference` entities remain ordinary Story World notes. The following optional properties are the canonical structured citation contract:

| Property | Accepted form | Meaning |
|---|---|---|
| `reference_authors` | string or list of strings | Authors in authored display order |
| `reference_title` | string | Work title |
| `reference_date` | string or number | Publication year or authored date |
| `reference_publication` | string | Journal, periodical or publication |
| `reference_publisher` | string | Publisher |
| `reference_volume` | string or number | Volume |
| `reference_issue` | string or number | Issue |
| `reference_pages` | string | Page or article range |
| `reference_doi` | string | Normalised lowercase DOI without a URL prefix |
| `reference_link` | HTTP/HTTPS URL | Canonical link, including the normalised DOI URL when a DOI is imported |

Readers accept common existing property spellings such as `authors`, `author`, `journal`, `year`, `doi` and `url`; guided creation writes only the canonical `reference_*` names. Missing values stay missing. Reference Markdown is the only authority: projections, Bases and Dataview tables are read-only presentations and must not be indexed as entities.

### POV capability

Entity type and narrative viewpoint capability are separate. `character` entities remain POV-eligible when `pov_eligible` is omitted, preserving existing vaults. Any entity type, including `intelligence`, may opt in with `pov_eligible: true`; a Character may explicitly opt out with `false`. New POV selections are stored as valid wikilinks. Malformed or unresolved authored POV targets remain in Markdown and are surfaced through the existing continuity observation model.

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
    status: confirmed
```

Each designation is a mapping with:

- required `name`;
- optional `assigned_by` wikilink;
- optional `as_of`, `valid_from` and `valid_until` ISO strings;
- optional `source` wikilink;
- optional `scope` string or list;
- optional `status` from the Canon Status and Provenance Standard;
- optional `confidence` string or number;
- any additional qualifiers needed by the author.

Unknown qualifier keys are preserved. A designation is not promoted to an ordinary alias automatically.

## Time values

`world_time` may be an ISO 8601 date or datetime string:

```yaml
world_time: "2026-04-03T03:18:00+01:00"
```

Use a canonical mapping for a point or range:

```yaml
world_time:
  from: "2026-04-03"
  until: "2026-04-05"
  precision: day
```

A canonical time mapping contains:

- `at` for a point, or `from` and `until` for a range;
- optional supported `precision`: `year`, `month`, `day`, `hour`, or `minute` as written by the editor.

Readers also accept valid second precision, ISO-like scalar values, numeric four-digit years, legacy `date` for `at`, and `to` for `until`. Authored mappings with unsupported extra keys are preserved and may remain displayable, but are not reliable chronology comparison/editing evidence. Put provenance in `world_sources` rather than adding `source` to the canonical time mapping.

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
    status: confirmed
    source: "[[Quiet Load]]"
    as_of: "2026-04-05"
```

The architectural model is a qualified subject–predicate–object assertion. The author-facing concept is a **relationship statement** or, for broader facts and beliefs, a **world assertion**.

A non-technical author must never be required to understand or type raw triple syntax during normal use. Future authoring must use readable phrases, guided forms, progressive disclosure and sentence rendering.

The [Supporting Model Conventions](supporting-model-conventions.md) define required fields, predicates, inverses, epistemic qualifiers, dedicated model notes, derived views and author-facing rendering. Unknown predicates and qualifiers remain valid.

## Scope

`world_scope` limits where an entity or interpretation is intended to apply. It accepts one value or a list.

```yaml
world_scope:
  - "[[PRIME Trilogy]]"
  - "[[EMERGENCE]]"
```

Scope does not replace provenance or time. A note may be series-scoped while an individual designation or assertion is book- or date-specific.

## Canon status and provenance

The companion [Canon Status and Provenance Standard](canon-status-and-provenance.md) defines the canonical values:

- `confirmed`;
- `planned`;
- `candidate`;
- `unresolved`;
- `superseded`.

Missing status is unclassified and must never imply confirmed canon. Unknown values are preserved. Planned and candidate material must not be presented as confirmed, unresolved material retains its ambiguity, and superseded material remains discoverable without appearing current by default.

Status describes the author’s commitment to an item. Provenance records why it is present. A source link does not automatically make an assertion true, and an in-world statement may be a confirmed record of a character’s uncertain or mistaken belief.

## Parsing and preservation rules

Consumers of this standard must:

- accept scalar values where this specification permits scalar-or-list forms;
- normalise scalar-or-list fields to lists internally without rewriting the note;
- trim strings for interpretation while preserving the original Markdown;
- omit empty optional fields from derived presentation;
- ignore an individually malformed optional field without rejecting an otherwise valid entity;
- preserve unknown primary kinds, facets, statuses, predicates, qualifier keys and extra properties;
- distinguish duplicate names and aliases by vault path and scope;
- retain unresolved wikilinks as unresolved references rather than deleting them;
- never modify a note merely because it was read or indexed.

A missing or empty `world_entity` means the note is not opted into this standard.

## Entity notes and supporting models

An entity note describes a thing in the story world and remains the authority for its core identity and descriptive prose.

A supporting model explains relationships, chronology, knowledge, interpretation or editorial concerns across entities. It opts in separately through `world_model` and references entity notes rather than copying their core facts.

Simple relationships may remain on their natural entity owner. Complex, disputed, changing, observer-specific or multi-party assertions use dedicated model notes under the [Supporting Model Conventions](supporting-model-conventions.md). Derived indexes, graphs, inverses and rendered sentences own no canon.

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

### Creating entities from manuscript wikilinks

A newly authored unresolved wikilink in an authoritative Scene or Part may open the Story World authoring flow. The author can keep it unresolved, cancel without a write, reuse a uniquely matching canonical name or alias, or create any entity type exposed by the Story World Navigator `+` action. Event is available but is not assumed or preselected. Creation uses the same type registry, planning, validation, filenames, folders and collision checks as Navigator creation; an explicitly path-qualified authored target remains path-qualified so the original prose wikilink resolves without rewriting its text.

The creation preview can explicitly add the initiating Scene or Part to `world_sources`. The exact canonical wikilink is shown before confirmation and the option is off until chosen. Existing provenance is preserved and a source already resolving to the same manuscript note is not duplicated. Declining, cancelling, stale input and blocked collisions do not change manuscript or Story World Markdown. The initiating manuscript note remains authoritative prose; no prose is copied and no editorial-store record is created.

The stored representation may be structured. The author experience must remain literary and readable.

> Store relationships, designations, status and provenance precisely. Present them as ordinary language, guided choices and understandable statements.

## Compatibility and ownership

- Manuscript prose remains authoritative in chapter Markdown.
- Existing chapter properties retain their current meanings.
- Story-world properties use the `world_` namespace to avoid accidental collisions.
- No story-world fact or model authority is stored in `.murmuration/writing-companion/editorial-data.json`.
- Merely adopting the standard does not require changing existing prose links, `pov`, `location` or compiler metadata.
- Existing compiler, Bases, Dataview and ordinary Obsidian wikilink behaviour must remain unaffected.

## Examples

See [`docs/examples/story-world/`](examples/story-world/) and [`docs/examples/story-world/models/`](examples/story-world/models/) for PRIME-based examples covering entities, canon status, provenance, simple relationships and dedicated supporting models.

These are schema examples only. They are not written into the PRIME Trilogy vault and do not independently establish canon.
# Maintenance observations

The read-only [Story World Review](story-world-review.md) checks explicit opted-in metadata for unresolved structured references, lookup-name collisions, malformed event time, scope, provenance and missing classification. Unknown entity types and optional omitted fields remain valid, and the review never repairs Markdown automatically.
