# Canonical Property Reference

This is the concise author-facing contract for current MWC Markdown. Normally, use MWC controls and ordinary wikilinks rather than maintaining these properties manually. Unless marked derived, values are authoritative Markdown. All listed properties are optional except the opt-in discriminator for the kind of note being created.

`R` means MWC reads the property; `W` means an MWC workflow can write it.

## Story World identity

| Property | Purpose and applies to | Canonical form | Required | MWC | Example |
|---|---|---|---|---|---|
| `world_entity` | Opts an entity note into the Story World index and declares its primary kind. | Non-empty scalar string; open vocabulary. | Required for an entity | R/W | `world_entity: character` |
| `world_name` | Preferred display name for entities and models. | Non-empty scalar text. | Optional | R/W | `world_name: Mara Venn` |
| `aliases` | Interchangeable lookup/link names. | Scalar text or list of text. | Optional | R | `aliases: [Mara, Dr Venn]` |
| `world_facets` | Additional roles without changing primary kind. | Scalar or list; open vocabulary. | Optional | R | `world_facets: [character, researcher]` |
| `pov_eligible` | Includes an indexed entity in POV suggestions. Characters default to eligible when absent. | Boolean; `true`/`false` strings are also read. | Optional | R | `pov_eligible: true` |
| `world_summary` | Concise description in Story World and context UI. | Scalar free text. | Optional | R | `world_summary: Lead hydrophone researcher.` |

Folders, tags, prose, filenames, backlinks, and ordinary `type` do not opt a note into the entity index. A list-valued `world_entity` is not valid opt-in. Unknown scalar kinds remain indexable.

## Scope, status, and provenance

| Property | Purpose and applies to | Canonical form | Required | MWC | Example |
|---|---|---|---|---|---|
| `world_scope` | Limits an entity/model to explicit scopes, commonly Books. | Scalar or list, normally wikilinks. | Optional | R/W | `world_scope: ["[[Book Two]]"]` |
| `world_status` | Note-level authorial state. | `confirmed`, `planned`, `candidate`, `unresolved`, `superseded`; unknown scalar values preserved. | Optional | R | `world_status: confirmed` |
| `world_status_note` | Explains note-level status. | Scalar free text. | Optional | R | `world_status_note: Outcome remains revisable.` |
| `world_sources` | Explicit provenance/support links; connects Events and References to manuscript evidence. | Scalar wikilink or list. | Optional | R/W | `world_sources: ["[[First Survey]]"]` |
| `world_first_appearance` | Earliest manuscript/published appearance. | Scalar wikilink. | Optional | R | `world_first_appearance: "[[Opening]]"` |
| `world_replaces` | Older material replaced by this note. | Scalar/list of wikilinks. | Optional | generic R | `world_replaces: ["[[Old Model]]"]` |
| `world_replaced_by` | Replacement for superseded material. | Scalar/list of wikilinks. | Optional | generic R | `world_replaced_by: "[[New Model]]"` |

Missing status means Unclassified, not Confirmed. Use modern `confirmed`; legacy `canon` is not a universal synonym.

## Manuscript Scene context

| Property | Purpose and applies to | Canonical form | Required | MWC | Example |
|---|---|---|---|---|---|
| `pov` | Scene viewpoint; a resolved indexed value contributes to derived World Context. | Free text or wikilink; semantic selection writes a wikilink. | Optional | R/W | `pov: "[[Pip]]"` |
| `location` | Sole Scene location property; a resolved indexed Location contributes to derived World Context. | Free text or one wikilink; semantic selection writes a full-path wikilink. | Optional | R/W | `location: "[[Story World/Locations/Reserve]]"` |
| `story_date` | When a Scene occurs/reveals material in manuscript chronology. | ISO-like scalar; guided flow writes `YYYY-MM-DD`. | Optional | R/W | `story_date: "2029-06-29"` |
| `world_context` | Broader explicit Story World relevance for a manuscript note. | One wikilink or list. | Optional | R/W | `world_context: ["[[Some Event]]"]` |

POV, Location, and explicit context are deduplicated by resolved entity path. MWC never writes semantic POV or Location into `world_context` automatically.

## Events and chronology

| Property | Purpose and applies to | Canonical form | Required | MWC | Example |
|---|---|---|---|---|---|
| `world_time` | Intrinsic fictional-world time, principally for Events. | Mapping with `at`, or `from` and `until`, plus supported `precision`. | Optional | R/W | `world_time: {at: "2029-06-29", precision: day}` |
| `world_participants` | Explicit Event participants. | Scalar wikilink or list. | Optional | R | `world_participants: ["[[Pip]]"]` |

Canonical precision values written by MWC are `year`, `month`, `day`, `hour`, and `minute`. The reader also understands valid second precision. Canonical mappings contain only the point/range keys and `precision`; extra keys make the mapping unsupported for reliable comparison/editing even though it is preserved.

## Entity-owned relationships

| Property | Purpose and applies to | Canonical form | Required | MWC | Example |
|---|---|---|---|---|---|
| `world_relationships` | Assertions whose implicit subject is the containing entity. | List of mappings. | Optional | R/W | See below. |

```yaml
world_relationships:
  - predicate: works_for
    target: "[[Pelagic Field Unit]]"
    status: confirmed
    source: "[[First Survey]]"
```

Each assertion requires `predicate` and exactly one of linked `target` or scalar `value`. Guided editing requires `status`; `source` and qualifiers are optional. `predicate_label` gives custom predicates a readable label.

## Supporting models and assertions

| Property | Purpose and applies to | Canonical form | Required | MWC | Example |
|---|---|---|---|---|---|
| `world_model` | Opts a note into supporting-model views. | Non-empty scalar; open vocabulary. | Required for a model | R | `world_model: timeline` |
| `world_model_subject` | Principal model focus. | Scalar wikilink or list. | Optional | R | `world_model_subject: "[[Signal]]"` |
| `world_assertions` | Assertions owned by a model. | List of mappings with explicit `subject`, `predicate`, and `target`/`value`. | Optional | R | See below. |
| `world_designations` | Qualified names that should not become ordinary aliases. | List of mappings requiring `name`. | Optional | generic R | `world_designations: [{name: PA-01}]` |

```yaml
world_model: timeline
world_assertions:
  - subject: "[[Signal Emerges]]"
    predicate: precedes
    target: "[[Return Survey]]"
    status: confirmed
```

The `world_model` vocabulary is open, but specialised graph/chronology behaviour is concentrated on timeline assertions.

## Reference entities

All Reference citation properties are optional and authoritative Markdown.

| Property | Purpose | Canonical form | MWC | Example |
|---|---|---|---|---|
| `reference_authors` | Authored display-order authors. | Scalar or list; writer emits list. | R/W | `reference_authors: ["Venn, Mara"]` |
| `reference_title` | Work title. | Scalar text/number. | R/W | `reference_title: Greywater field log` |
| `reference_date` | Publication year/date. | Scalar text/number. | R/W | `reference_date: 2026` |
| `reference_publication` | Journal, periodical, or container title. | Scalar text/number. | R/W | `reference_publication: Tidal Studies` |
| `reference_publisher` | Publisher. | Scalar text/number. | R/W | `reference_publisher: Pelagic Press` |
| `reference_volume` | Volume. | Scalar text/number. | R/W | `reference_volume: 7` |
| `reference_issue` | Issue. | Scalar text/number. | R/W | `reference_issue: 2` |
| `reference_pages` | Page/article range. | Scalar text/number. | R/W | `reference_pages: 14–19` |
| `reference_doi` | DOI without URL prefix. | Scalar text; import normalises lowercase. | R/W | `reference_doi: 10.1177/example` |
| `reference_link` | Canonical HTTP/HTTPS link. | Scalar URL. | R/W | `reference_link: https://example.org/log` |

## Derived report metadata

Generated reports may write `type: generated-report`, `report_type`, `report_scope`, `book`, and `generated_at`. These describe disposable projections, not Story World authority. Legacy `type: continuity-review-report` is also excluded from discovery.
