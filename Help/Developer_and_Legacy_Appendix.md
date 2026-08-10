# Developer and Legacy Compatibility Appendix

This appendix preserves the implementation-led audit behind the Help rewrite. It is not required for normal authoring. Current runtime/tests are authoritative when compatibility differs between consumers.

## Resolution and precedence

| Canonical | Compatibility input | Current behaviour |
|---|---|---|
| `world_name` | `title`, filename | First non-empty: `world_name`, then `title`, then basename. |
| `world_scope` | `scope` | Fallback in supporting-model/World Builder paths; the entity index reads canonical `world_scope`. |
| `world_status` | `status` | Fallback in supporting-model/World Builder paths; the entity index reads canonical `world_status`. |
| `world_sources` | `source` | Fallback for models; entity projections expect canonical `world_sources`. |
| `world_model_subject` | `subject` | Used as a model navigation/graph fallback. |
| `world_time.at` | `date`, scalar, numeric four-digit year | Accepted compatibility point forms. |
| `world_time.until` | `to` | Both read; the editor writes `until`. |
| `valid_until` | `valid_to` | Both read; `valid_until` wins when both exist. |
| `world_relationships` | separator/case variants | Matching removes spaces, underscores, and hyphens; editing preserves an existing spelling. |
| `world_time` property name | case-only variants | Event editing preserves an existing key spelling. |

Reference resolution uses the first property whose value is not `null`/`undefined`, in this order:

| Canonical | Legacy properties read after it |
|---|---|
| `reference_authors` | `authors`, `author` |
| `reference_title` | `citation_title` |
| `reference_date` | `publication_date`, `publication_year`, `year` |
| `reference_publication` | `journal`, `publication` |
| `reference_publisher` | `publisher` |
| `reference_volume` | `volume` |
| `reference_issue` | `issue` |
| `reference_pages` | `pages` |
| `reference_doi` | `doi` |
| `reference_link` | `url`, `link` |

An empty or malformed canonical Reference value can therefore block fallback to a populated legacy value before normalisation removes the empty value. MWC does not migrate or remove legacy fields automatically.

## Unsupported near-aliases

| Property | Behaviour |
|---|---|
| `world_source` | Not entity provenance. Generic `world_*` link scanning may encounter it, but provenance/timeline/review consumers do not treat it as `world_sources`. |
| `reference_journal` | Not read; use `reference_publication`. |
| `published_in` | Not read; use `reference_publication`. |
| `reference_url` | Not read; use `reference_link`. |
| `type: character` | Does not opt into Story World indexing. |
| Entity-level `scope`, `status`, `source` | Not general entity-index aliases; limited model/World Builder fallback only. |
| `locations` | Not a Scene property and not introduced by #205. |

## Scene metadata aliases and preservation

Chapter Context recognises property spelling using case-insensitive separator normalisation. Canonical/accepted aliases are:

- `pov`, `point_of_view`, `viewpoint`;
- `location` only;
- `story_date`, `storydate`, `narrative_date`;
- `chapter_status`, `status`;
- `editorial_pass`, `current_editorial_pass`, `current_pass`, `editing_pass`, `pass`;
- `change_summary`, `changes`, `what_changed`, `whats_changed`, `change_log`.

Editing retains the matched property spelling and removes competing aliases for that field. Merely opening Chapter Context does not rewrite values. #205 keeps free-text, unresolved, and non-Location linked `location` values non-destructively. Only a resolved indexed Location receives semantic Location context/navigation.

## Event participant inconsistency

`world_participants` is canonical. Compatibility is not uniform:

- Graph reads `world_participants`, then `participants`, then `world_participant`.
- Story World Review reads canonical `world_participants` or legacy `participants`, but not singular `world_participant`.
- Manuscript impact reads all three.

Do not rely on the aliases in new content.

## Status compatibility

Canonical modern status is `confirmed`. Missing entity status is Unclassified. Unknown values are preserved.

- Entity-level `world_status: canon` remains a custom status and is not uniformly presented as Confirmed.
- Nested relationship/assertion `status: canon` is accepted by legacy relationship validation and preserved, but is not rewritten.
- Guided relationship choices are `confirmed`, `planned`, `candidate`, and `unresolved`; Supersede writes `superseded`.

## Relationship and assertion qualifiers

Unknown qualifier keys remain valid and are preserved. Current interpreted or displayed fields include:

| Qualifier | Behaviour |
|---|---|
| `as_of` | Preserved/displayed snapshot time. |
| `validity` | Complete temporal scalar/mapping; graph checks it before fallback fields. |
| `valid_from` | Graph/impact validity start. |
| `valid_until`, `valid_to` | Validity end; canonical key wins. |
| `world_time` | Assertion-local graph validity fallback. |
| `time_precision` | Preserved author precision. |
| `asserted_by` | Preserved/displayed holder or issuer. |
| `confidence` | In-world confidence, not canon status. |
| `scope`, `visibility`, `audience` | Preserved/displayed qualification. |
| `hidden_from`, `known_to` | Used by temporal perspective evidence. |
| `status_note` | Preserved/displayed explanation. |
| `replaces`, `replaced_by` | Preserved assertion history. |
| `change` | Recognised introduction/ending/contradiction/supersession classifications influence temporal presentation. |

## `world_time` compatibility boundary

Canonical mapping shapes use `at` or `from`/`until` and optional supported `precision`. Scalars, numeric years, `date`, `to`, and older `shape: point/range` structures have reader compatibility. A mapping with unsupported additional keys is preserved and may be displayed, but `parseTemporalInterval` classifies it as unsupported comparison evidence; guided editing should not silently normalise it.

## Supporting-model breadth

Any non-empty scalar `world_model` is indexable. Recommended vocabulary includes `relationship`, `timeline`, `character-arc`, `knowledge-state`, `institution`, `location`, `technology`, `continuity`, and `assertion`, but it is open. Specialised `world_assertions` graph/chronology processing is concentrated on `world_model: timeline`; indexability alone promises no specialised semantics.

Model assertions require explicit `subject`, `predicate`, and exactly one of `target`/`value`. Model-level `subject`, `status`, and `source` fallbacks are deliberately narrower than entity properties.

## Preservation and generic indexing contract

- Unknown properties are defensively copied into in-memory records.
- Wikilinks are recursively collected from properties beginning `world_`; this generic link collection does not grant property-specific meaning.
- Malformed optional fields do not invalidate an otherwise valid opted-in entity.
- Unknown entity kinds, statuses, predicates, qualifiers, and extra properties are preserved.
- Unresolved wikilinks remain authored data rather than being deleted or invented.
- Scalar/list forms may be normalised in memory without changing their stored shape.
- Guided editors target relevant properties and preserve unrelated metadata.
- Reading and indexing do not rewrite Markdown.
- Generated reports (`type: generated-report` and legacy continuity report classification) are excluded from Story World discovery.
- In-memory indexes, inverse relationships, graphs, rendered sentences, timelines, World Context groupings, manuscript-impact projections, Reference projections, and report contents are rebuildable and non-authoritative.
