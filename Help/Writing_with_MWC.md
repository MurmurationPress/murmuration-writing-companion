# Writing with MWC

Open a Scene and use **Chapter Context** rather than hand-editing frontmatter during ordinary work. MWC preserves unrelated properties and existing authored values.

## Chapter Context fields

- **Title** changes the Scene's `title` property, not its filename.
- **POV** accepts existing text and offers eligible indexed Story World entities. Characters are eligible by default; another entity can opt in with `pov_eligible: true`.
- **Location** offers only indexed entities whose `world_entity` is `location`, matched case-insensitively. Search includes aliases.
- **Story date** records when the Scene occurs or reveals material in manuscript chronology.
- **Chapter status** uses Idea, Draft, Revision, or Complete. Existing custom values remain visible until deliberately replaced.
- **Pass reached** reflects the editorial-pass checklist and is not edited independently.
- **Change summary** records a concise editorial note in Scene Markdown.

## POV and World Context

When `pov` resolves to an indexed Story World entity, that entity automatically appears in derived World Context. You do not need to repeat it in `world_context`. If it is repeated, MWC displays it once by resolved note path.

If that entity links to a POV Profile, Chapter Context also shows a separate **POV Guidance** block. MWC resolves reusable base-profile guidance before the entity's effective profile, so shared principles are not duplicated. The profile remains author-controlled Markdown and is not mixed into ordinary Story World facts or copied into Scene metadata. Scenes whose POV has no profile behave as before.

Plain text and unresolved POV values remain authored data but cannot contribute a resolved entity card.

## Scene Location

`location` is the sole canonical Scene property for where the Scene takes place. Choose a recognised Location in Chapter Context to store a canonical full-path wikilink such as:

```yaml
location: "[[Story World/Locations/Coastal Nature Reserve]]"
```

The selector shows human-readable names, searches aliases, and disambiguates duplicate names with concise path context. Only indexed `world_entity: location` notes are offered.

Existing free text remains valid and unchanged until you deliberately replace it. Unresolved wikilinks and links to non-Location entities are also preserved. MWC does not guess, create an entity, or silently correct them.

A resolved Story World Location automatically contributes to derived World Context. It is not copied into `world_context`, and opening the editor does not rewrite it. Navigation uses the resolved entity path, never the stored raw `[[...]]` syntax.

## Explicit World Context

Use `world_context` for the broader set of indexed entities relevant to the Scene: an Event being discussed, an Organisation acting off-page, a Technology in use, or another contextual entity.

In the Writing Companion's **World Context** section, choose **Add World Context** to search indexed entity names and aliases. You can filter by entity type; Events appear first for quick attachment. MWC stores a readable canonical wikilink when that link resolves uniquely and uses a path-qualified link when disambiguation is required.

```yaml
pov: "[[Pip]]"
location: "[[Story World/Locations/Coastal Nature Reserve]]"
world_context:
  - "[[Divergent]]"
  - "[[Some Event]]"
```

POV, Location, and explicit context remain semantically distinct but are displayed once per resolved entity path. MWC does not infer World Context from prose, folders, tags, backlinks, or filename similarity.

Only explicit `world_context` entries show **Remove** here. POV and Location remain editable through their own Chapter Context fields. Add/remove preserves other entries, aliases, unresolved manual links, custom Scene YAML, and manuscript prose. Equivalent canonical, alias, and path-qualified references are recognised as the same indexed entity rather than duplicated. Manual wikilinks remain supported.
