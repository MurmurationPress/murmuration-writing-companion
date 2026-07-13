# Read-only Story World Index

**Version:** 0.1.0  
**Status:** Foundation implementation  
**Issue:** #53

## Purpose

The Story World index discovers Markdown notes that explicitly opt into the [Story World Entity Standard](story-world-entity-standard.md). It provides a fast, read-only projection for later features such as World Context without copying canon into plugin storage.

> Markdown remains authoritative. The index is disposable and rebuildable.

## Discovery

A note is indexed only when its cached frontmatter contains a non-empty scalar `world_entity` value.

The index does not infer entity status from:

- folder placement;
- filename;
- tags;
- backlinks;
- prose;
- `type`, `pov` or `location`;
- the presence of `world_model` alone.

Unrelated Markdown notes are ignored.

## Indexed record

Each indexed entity retains:

- vault path and basename;
- primary entity type;
- canonical display name;
- native Obsidian aliases;
- facets;
- scope;
- canon status;
- summary;
- first appearance;
- sources;
- wikilinks found in `world_` properties;
- a defensive in-memory copy of the original frontmatter properties.

The display name follows the entity standard:

1. `world_name`;
2. `title`;
3. filename without `.md`.

Unknown entity types, statuses and properties remain present. Malformed optional properties are ignored individually rather than rejecting an otherwise valid entity.

## Lookup

The in-memory index supports lookup by:

- exact vault path;
- canonical name;
- alias;
- entity type.

Name and alias lookup is case-insensitive. Duplicate names and aliases return every matching entity in deterministic path order. They are never collapsed into one record, so path and scope remain available for disambiguation.

## Wikilink resolution

The Obsidian adapter resolves ordinary wikilinks relative to the source note through the metadata cache.

Supported forms include:

```yaml
- "[[Tobias Hale]]"
- "[[Characters/Tobias Hale|Tobias]]"
- "[[Story World/Characters/Tobias Hale|Tobias Hale]]"
```

A display label changes presentation, not identity. Heading and block fragments resolve to the containing note. When normal vault resolution does not find a destination, a unique indexed canonical name or alias may be used as a fallback. Ambiguous alias matches remain unresolved rather than being guessed.

Only destinations already present in the Story World index are returned.

## Lifecycle

The index is built from `vault.getMarkdownFiles()` when the plugin loads and rebuilt once when the Obsidian layout is ready, ensuring the metadata cache has settled.

After startup, ordinary events update one path at a time:

- metadata change or Markdown creation — parse and upsert that note;
- deletion — remove that path;
- rename — remove the old path and parse the new path;
- recreation — upsert the newly cached note normally.

A note that removes or invalidates `world_entity` is removed from the index on its next metadata change.

The sidebar does not trigger a full-vault scan. Full rebuilds are reserved for startup or an explicit future recovery action.

## Read-only boundary

The index never:

- modifies frontmatter or prose;
- creates, renames or deletes notes;
- normalises malformed properties on disk;
- writes to `.murmuration/writing-companion/editorial-data.json`;
- changes canon status;
- becomes the sole copy of any author-maintained knowledge.

Existing manuscript, compiler, Bases, Dataview and editorial behaviour remains independent.

## Failure behaviour

- Missing frontmatter means the note is not indexed.
- A missing, empty or non-scalar `world_entity` means the note is not indexed.
- Malformed aliases, scope, status or summary values are omitted individually.
- Unknown entity types and extra properties are retained.
- Duplicate names remain separate records.
- Unresolved links return no entity and do not create notes.
- One malformed note does not prevent other notes from being indexed.

## Validation

Automated tests cover:

- opt-in discovery and unrelated-note exclusion;
- canonical names, aliases, type, scope, status and link extraction;
- malformed optional data;
- unknown entity types and properties;
- duplicate names and aliases;
- metadata replacement;
- rename;
- delete and recreation;
- complete rebuild;
- ordinary, display and path-qualified wikilink parsing.

The Obsidian validation pass should additionally confirm that creating, editing, renaming, deleting and recreating real entity notes updates the in-memory index without changing their Markdown.
