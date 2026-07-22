# Active chapter context continuity

**Status:** Initial implementation
**Issue:** #130

The Writing Companion derives a small read-only set of continuity observations
for the active chapter. Manuscript and Story World Markdown remain authoritative;
observations are rebuilt from cached frontmatter and are never persisted.

## Relevance boundary

- Events are evaluated only when directly listed in the chapter's
  `world_context`.
- POV alone does not make an entity or event relevant.
- An entity-owned `world_relationships` assertion is evaluated only when its
  owner and its resolved wikilink target are both directly listed in the same
  `world_context`.
- Model-owned assertions, prose, backlinks, folders and text search do not
  establish relevance.

## Temporal boundary

The evaluator accepts explicit year, month, day, hour and minute precision and
supported point, closed-range and open-range forms. Each value is treated as
the complete interval permitted by its authored precision. A chronology
conflict is emitted only when the relevant intervals are provably disjoint.
Overlapping partial dates, missing range boundaries and offset combinations
that cannot be compared deterministically remain quiet.

Four-digit YAML integer years and four-digit year strings have the same year
precision. Other numeric values are not coerced into temporal strings.

Written timezone offsets are retained. Two explicitly offset time values are
compared as instants; two unoffset time values are compared as written local
times. A timed value with an offset is not compared at hour or minute precision
against one without an offset.

Malformed and unsupported temporal values produce source-data review
observations rather than chronology claims. Missing optional event times and
relationship validity bounds remain quiet.

## Implemented rules

- a directly referenced event is proven to begin after the chapter date;
- a relevant relationship is proven not to have reached `valid_from`;
- a relevant relationship is proven to have passed `valid_until`;
- a directly referenced entity is explicitly scoped only to other resolved
  book notes.

Scope contradictions require an explicitly resolved owning-book hierarchy.
Folder fallback does not provide contradiction evidence. Empty scope is
unrestricted for this evaluator. Plain, unresolved or non-book scope values do
not prove exclusion. Series-scope evaluation is deferred.

Mutually incompatible states, model-owned assertions, dispositions and the
global Continuity Review workspace remain outside #130.

## Presentation and refresh

When observations exist, they appear in a compact Continuity block inside the
active chapter's World Context section. The block is omitted when there are no
observations. It presents evidence-backed explanations and navigation to the
supporting notes without offering edits or dispositions.

The existing active-leaf and metadata lifecycle triggers recomputation. Story
World note changes continue to update the per-note index; rendering evaluates
only the active chapter, its explicit context entities and their relevant
entity-owned relationships. Ordinary refresh does not scan the vault.
