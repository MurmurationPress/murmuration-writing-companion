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

## POV Profiles

A Character or Intelligence can link to a separate POV Profile. The entity note remains the authority for who or what the entity is; the profile's Markdown body holds author-controlled guidance about narrative voice, perception, vocabulary, structures, representation rules, and review checks.

```yaml
world_entity: character
world_name: Tobias
pov_eligible: true
pov_profile: "[[Story World/POV Profiles/Tobias POV]]"
```

Create the profile as `world_entity: pov-profile` and edit its ordinary Markdown body. The creation form can start with a light base-profile template, a blank profile, or a Book-scoped extension template; its headings are ordinary editable prompts, not schema fields. A specialised profile may use `pov_extends` to inherit one reusable base profile. MWC applies the base first and the specialised profile second; this is a single inheritance link, not a general rules language.

A Book-scoped extension uses both an explicit `pov_extends` parent and `world_scope` Book link. When the current Scene belongs to that Book, MWC appends the single matching scoped delta after the durable profile chain. It never infers this relationship from folders or filenames. If multiple sibling deltas claim the same parent and Book, MWC reports unresolved guidance rather than choosing silently. Keep scoped profile prose to what changes in that Book; do not copy the parent guidance.

When a Scene's `pov` resolves to an entity with a profile, the Writing Companion shows the effective material under **POV Guidance** in Chapter Context automatically. Do not repeat the profile in `world_context`. Scene-local Chapter Context remains separate and can supply immediate circumstances or exceptions. Existing entities do not require profiles, and missing or cyclic links do not block ordinary chapter use.

## Browse and review

- **Story World Navigator** groups entities into collapsible categories from their semantic `world_entity` value. POV Profiles have their own category, and custom kinds receive their own readable categories. Search temporarily reveals matching collapsed categories without changing your saved collapse choices. Folder placement never decides category or meaning.
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
