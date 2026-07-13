# Canon Status and Provenance Standard

**Version:** 0.1.0  
**Status:** Foundation specification  
**Issue:** #51

## Purpose

This standard defines how Story World notes and assertions distinguish settled world truth from plans, possibilities, deliberate ambiguity and replaced ideas. It also defines lightweight provenance so an author can see why material is present without turning the manuscript into a database.

> Canon status describes the author’s commitment to an item. Provenance describes why that item is present.

Status and provenance are separate. A source does not make a claim true, publication does not make an in-world statement objective, and a confident character can still be wrong.

## Where status applies

At entity-note level, use `world_status`.

```yaml
world_entity: character
world_name: Tobias Hale
world_status: confirmed
```

Within a designation, relationship or other qualified assertion, use `status` on that item.

```yaml
world_relationships:
  - predicate: works_for
    target: "[[Northbridge Systems]]"
    status: confirmed
    source: "[[Quiet Load]]"
    as_of: "2026-04-05"
```

The note-level status classifies the entity note and its core identity. It does not silently confirm every sentence in the prose or every nested assertion. A nested item with no status remains unclassified unless a later supporting-model convention explicitly defines otherwise.

## Canonical status vocabulary

The canonical stored values are lowercase.

| Stored value | Author-facing label | Meaning |
|---|---|---|
| `confirmed` | Confirmed | Settled current world truth or authorial decision |
| `planned` | Planned | Intended development that remains open to revision |
| `candidate` | Candidate | Possible option or alternative under consideration |
| `unresolved` | Unresolved | Deliberately left open by the author |
| `superseded` | Superseded | Retained history that is no longer current |

These values are deliberately few. Unknown custom values remain valid and must be preserved, but they are not treated as one of the canonical states automatically.

## Confirmed

Use `confirmed` when the author has settled that the entity, fact, relationship, designation or event is true in the story world.

Confirmed does not require that the fact has already been revealed to the reader or published. It means the author currently treats it as settled.

```yaml
world_status: confirmed
world_sources:
  - "[[Domestic Distance]]"
```

A confirmed assertion may describe an uncertain in-world belief:

```yaml
world_relationships:
  - predicate: believes
    value: containment remains unconfirmed
    asserted_by: "[[JANUS]]"
    status: confirmed
    confidence: low-moderate
    source: "[[JANUS Monitoring]]"
    as_of: "2029-01-20"
```

Here, `confirmed` means the author confirms that JANUS holds this assessment. It does not mean containment is objectively unconfirmed for all observers or all later dates.

## Planned

Use `planned` for material the author currently intends to use but has not settled strongly enough to call confirmed.

```yaml
world_entity: event
world_name: Later institutional review
world_status: planned
world_status_note: Intended for a later volume; outcome remains revisable.
```

Planned is stronger than candidate. It represents a current direction, not merely an option. MWC must never present planned material as confirmed canon.

## Candidate

Use `candidate` for one possible idea, alternative or interpretation under consideration.

```yaml
world_entity: location
world_name: Candidate meeting site
world_status: candidate
world_status_note: One of several possible settings for the scene.
```

Several candidate items may coexist. The existence of one candidate does not retire the others, and folder order must not imply preference.

## Unresolved

Use `unresolved` when ambiguity is deliberate rather than accidental.

```yaml
world_entity: concept
world_name: Meaning of apparent inhibition
world_status: unresolved
world_scope: "[[JANUS Monitoring]]"
world_sources:
  - "[[JANUS Monitoring]]"
world_status_note: At this story point, reduced visibility may indicate containment, displacement, latency or measurement loss.
```

Unresolved is not the same as missing status. It records an authorial decision to preserve uncertainty. It may remain visible in current context, but must be labelled clearly and never rendered as confirmed fact.

## Superseded

Use `superseded` for material retained for history that is no longer the author’s current model.

```yaml
world_entity: concept
world_name: PRIME as controlling agent
world_status: superseded
world_replaced_by: "[[PRIME as distributed preference]]"
world_sources:
  - "[[JANUS Monitoring]]"
world_status_note: Replaced by the distributed, pressure-sensitive interpretation.
```

Superseded material remains discoverable for revision history and understanding earlier drafts. It should be excluded from ordinary current-context views by default.

Do not delete a superseded note merely because a replacement exists. Deletion destroys useful provenance and may break links from earlier drafts or planning notes.

## Missing, empty and unknown status

A missing or empty `world_status` means **Unclassified**.

Unclassified material:

- remains indexable when `world_entity` is present;
- must not be treated as confirmed;
- should be presented quietly rather than as an error;
- may be omitted from views that explicitly require confirmed material.

Unknown custom values must be preserved exactly. A consumer may display an “Unrecognised status” treatment, but must not silently coerce the value.

The earlier Story World examples used `canon`. For read-only compatibility, consumers may recognise `canon` as a legacy synonym for `confirmed`, but must preserve the stored value and must not rewrite the note merely by reading it. New notes should use `confirmed`.

## Lightweight provenance properties

At entity-note level, the common provenance properties are:

| Property | Accepted form | Meaning |
|---|---|---|
| `world_sources` | scalar or list of wikilinks | Notes, chapters or records supporting the current item |
| `world_first_appearance` | wikilink | Earliest manuscript or published appearance |
| `world_status_note` | scalar string | Brief human explanation of the current status |
| `world_replaces` | scalar or list of wikilinks | Older items replaced by this item |
| `world_replaced_by` | scalar or list of wikilinks | Current replacement for a superseded item |

All are optional. They remain ordinary Markdown properties and are not copied into the editorial store.

Within qualified designations and assertions, use the unprefixed equivalents where appropriate:

- `source`;
- `status`;
- `status_note`;
- `replaces`;
- `replaced_by`.

Detailed assertion shapes remain the responsibility of #52.

## Sources are evidence, not authority

A source link records where an item is established, proposed, discussed or revised. It does not automatically determine status.

For example, Tobias’s article is a valid source for these confirmed facts:

- Tobias authors the article;
- Tobias publicly introduces the working name PRIME;
- the article makes particular claims.

The article is not, by itself, proof that every claim it contains is objective world truth.

Likewise, a JANUS log can establish what JANUS models or believes without making the model omniscient.

## First appearance is not the same as source

`world_first_appearance` records the earliest appearance of an entity or concept in the manuscript or published work. It is useful for navigation and reporting.

`world_sources` records evidence or decision provenance for the current note. The first appearance may be one source among several, but it is not necessarily the strongest or most complete source.

## Replacement history

When an item replaces older material, the new item may link backwards with `world_replaces`.

```yaml
world_status: confirmed
world_replaces:
  - "[[Earlier PRIME model]]"
```

The old item may link forwards with `world_replaced_by`.

```yaml
world_status: superseded
world_replaced_by: "[[Current PRIME model]]"
```

Both directions are useful but neither is mandatory. Readers must tolerate one-sided links, unresolved links and several replacements. They must not infer deletion or modify either note.

## Presentation rules

Read-only consumers such as the 0.14.0 Story World index and World Context view must follow these rules:

- Confirmed material may appear as current canon.
- Planned material must be visibly labelled and separated from confirmed material.
- Candidate material must be visibly labelled as an option, not a decision.
- Unresolved material may appear in current context but must retain its ambiguity.
- Superseded material remains discoverable but is excluded from normal current views by default.
- Missing status is shown as unclassified, never confirmed.
- Unknown values are preserved and presented without coercion.
- Status, source and replacement links never trigger writes to the originating Markdown.

A compact author-facing rendering might read:

> **PRIME** — Confirmed  
> Distributed adaptive intelligence. Established in *The Router*; publicly named in *The Article*.

A planned item might read:

> **Later institutional review** — Planned  
> Intended for a later volume; outcome remains revisable.

A superseded item might read:

> **PRIME as controlling agent** — Superseded  
> Replaced by *PRIME as distributed preference*.

## Status and story time are independent

Status describes the author’s commitment now. Story time describes when the item is true within the fiction.

A confirmed employment relationship may be valid only during 2026. A planned event may be intended for 2032. A superseded note may describe an earlier draft rather than an earlier in-world period.

Do not use `world_status` as a substitute for `as_of`, `valid_from`, `valid_until` or `world_time`.

## Status and epistemic confidence are independent

Status answers:

> Has the author settled this item?

Confidence answers:

> How certain is the relevant character, institution or model?

A confirmed assertion can therefore carry low confidence when the author has settled that a character is uncertain. A candidate authorial idea should not become confirmed merely because an in-world system expresses high confidence.

## Compatibility and ownership

- Story World Markdown remains authoritative.
- Status and provenance remain outside `.murmuration/writing-companion/editorial-data.json`.
- Existing manuscript, compiler, Bases, Dataview and wikilink behaviour is unaffected.
- MWC uses these fields read-only during the foundation milestone.
- Reading, indexing or displaying status never normalises or rewrites source notes.

## Examples

See [`docs/examples/story-world/status-and-provenance.md`](examples/story-world/status-and-provenance.md) for compact examples of all five canonical states and the distinction between confirmed authorial status and uncertain in-world belief.
