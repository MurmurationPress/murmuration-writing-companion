# Murmuration Writing Companion

A focused writing companion for Obsidian.

Writing a novel is difficult enough. Your tools shouldn't make it harder.

## Author workflow

Use **Manuscript** in the left sidebar to choose a book, open scenes and manage explicit manuscript order. Review the active chapter in the **Writing Companion**, including Chapter Context, book and editorial progress, Chapter Notes and annotations. Browse or create Story World material in the **Story World Navigator**; selecting an entity or supporting model opens its Markdown and changes the right sidebar to **Entity Inspector**. Use the relationship workspace there, then open **Story World Timeline** in the centre to explore chronology or the event–scene map.

Manuscript and Story World Markdown remain authoritative. The plugin derives navigation, indexes, relationship presentation and temporal views from those files. Portable editorial data is stored separately for notes, annotations and workflow history.

## Project documents

- [Manifesto](MANIFESTO.md) — what the project believes
- [Constitution](CONSTITUTION.md) — the binding rules for product and development decisions
- [Architecture](ARCHITECTURE.md) — the current division of responsibilities
- [Story World Entity Standard](docs/story-world-entity-standard.md) — the permissive Markdown contract for fictional entities
- [Canon Status and Provenance Standard](docs/canon-status-and-provenance.md) — how settled truth, plans, alternatives, ambiguity and replacement history are distinguished
- [Supporting Model Conventions](docs/supporting-model-conventions.md) — how relationships, chronology and knowledge are represented without duplicating canon
- [Chapter World Context Standard](docs/chapter-world-context-standard.md) — how chapters identify explicitly relevant Story World entities
- [Read-only Story World Index](docs/story-world-index.md) — how opted-in entity notes are discovered and refreshed without copying canon

## Development install

1. Copy this folder into `.obsidian/plugins/murmuration-writing-companion/`
2. Run `npm install`
3. Run `npm run build`
4. Enable **Murmuration Writing Companion** in Obsidian.

## Testing

Run the automated regression suite once with:

```bash
npm test
```

Use `npm run test:watch` while changing pure logic. Tests are written in TypeScript, bundled with the existing esbuild dependency and executed with Node's built-in test runner.

Automate deterministic behaviour such as property normalization, matching, sorting, migration and state transitions. Continue to perform a short Obsidian check for sidebar layout, native editor behaviour, rendered links and other host-application integration. GitHub Actions runs both the tests and production build for every push and pull request.

## Commands

- Open Writing Companion
- Open Manuscript
- Open Story World Navigator
- Open Story World Timeline
- Annotate

## Manuscript navigation and ordering

**Manuscript** supports books containing parts and scenes as well as books containing scenes directly. It recognises explicit Markdown hierarchy and order, can help adopt reviewed legacy filename order, and excludes manuscript templates from book selection.

Scenes and parts can be reordered by drag-and-drop, keyboard commands or a compact Move menu. Every structural move is validated before writing, updates authoritative Markdown only where required and can be undone immediately while the source state remains current.

## Story World foundations

The versioned [Story World Entity Standard](docs/story-world-entity-standard.md) defines how ordinary Markdown notes can opt into a permissive story-world model through a non-empty `world_entity` property.

The companion [Canon Status and Provenance Standard](docs/canon-status-and-provenance.md) distinguishes Confirmed, Planned, Candidate, Unresolved and Superseded material. Missing status remains unclassified rather than becoming canon implicitly. Lightweight source and replacement links explain why material is present without moving authority away from Markdown.

The [Supporting Model Conventions](docs/supporting-model-conventions.md) define how ordinary Markdown can represent relationships, timelines, character arcs, continuity and knowledge states without copying entity identity or prose. Assertions use precise subject–predicate–object structure internally, while the author experience must use readable statements, guided forms and progressive disclosure.

The [Chapter World Context Standard](docs/chapter-world-context-standard.md) defines the optional `world_context` chapter property. Recognised Story World POV links are included without duplication, while other relevant entities are listed explicitly. Existing free-text location and manuscript metadata remain unchanged, and no relevance is inferred from prose.

The [read-only Story World index](docs/story-world-index.md) discovers opted-in entity notes from Obsidian's metadata cache. It indexes path, canonical name, aliases, type, scope, status and common links, then updates individual records when notes change, move or disappear. The index is in-memory, disposable and never stored in the editorial data file.

Entity notes remain authoritative Markdown. A primary kind provides stable grouping, optional facets represent additional roles, and qualified designations distinguish observer- or institution-specific names from ordinary aliases. Supporting models reference those entities, while indexes, inverse relationships, graphs, rendered sentences and chapter context displays remain derived and rebuildable.

The **Writing Companion** presents a read-only World Context section for the active chapter. It combines recognised Story World POV links with explicit `world_context` references, removes duplicate resolved entities, groups them by type and shows concise names, summaries and canon status. Clicking an entity opens its Markdown note through normal Obsidian navigation.

MWC still does not infer canon or relevance from prose. Story-world facts and model authority never enter the portable editorial store.

## Prose-first Story World authoring

The Writing Companion can offer explicit Story World actions at natural points in the writing process: creating a character from an unmatched POV value, creating an event from a newly written unresolved link, or describing a relationship introduced by a newly written link to an indexed entity. Each offer may be dismissed, previews its intended Markdown and requires confirmation before writing. Keeping a prose link does not by itself make it Story World canon or chapter context.

## Story World navigation and entity creation

**Story World Navigator** is a searchable left-sidebar view of explicitly opted-in entities and supporting models. It groups items by role, shows concise status and temporal cues, and opens the authoritative Markdown note in the centre editor.

The right sidebar becomes **Entity Inspector** while a Story World entity or model is active. The entity name, kind and status remain primary, followed by available summary, provenance, time and relationship content. Creating an entity uses a guided, collision-checked flow that writes minimal ordinary Markdown; returning to a manuscript chapter restores the **Writing Companion**.

## Relationships

Entity-owned relationships are rendered as readable statements in Entity Inspector. Guided controls support adding, editing, superseding and removing a relationship, with explicit target resolution, preview and stale-write protection. Qualifiers, time, status, provenance and perspective remain in authoritative Markdown; derived sentences and inverse views are rebuildable presentation.

## Event time and Story World Timeline

Event time editing supports exact points, ranges, approximate values and partial precision without manufacturing missing detail or converting authored wall-clock values through the system timezone. Readable British-English presentation and relative chapter context are derived from the stored values.

**Story World Timeline** is a centre workspace with chronology and event–scene map presentations. Chronology groups dated points, ranges, approximate or unsupported values and undated events. The map derives scene connections from explicit event source links. Both presentations navigate back to authoritative event, source and scene Markdown and do not provide an independent timeline data store.

## Chapter Notes

Each chapter has one always-present Chapter Notes editor in the Companion. Type general editorial thoughts directly into the box; changes are saved automatically.

## Portable editorial storage

Chapter Notes, annotations and completed editorial-pass history are stored inside the vault at:

```text
.murmuration/writing-companion/editorial-data.json
```

The file uses a versioned JSON schema and travels with ordinary vault copies and backups. It can be shared through Git or a vault-sync service when the same editorial state is wanted on another installation.

The plugin writes through a temporary file and keeps the previous complete file as `editorial-data.json.bak`. If an interrupted write leaves a complete temporary or backup file, the Companion recovers it without touching manuscript Markdown. A malformed file without a valid recovery copy, or a file created by a newer unsupported schema, stops storage loading rather than being silently replaced.

Existing editorial data from the plugin's Obsidian `data.json` is migrated automatically only when the portable file does not yet exist. The portable file then becomes authoritative, making the migration safe to repeat. The old plugin data is left in place as a migration backup.

Deleting a Markdown chapter does not delete its Chapter Notes, annotations or editorial-pass history. The record is marked with a deletion timestamp and restored automatically when a chapter is recreated at the same path. If another annotated chapter is renamed into that path, the deleted record is moved into the store's orphan archive so both editorial histories survive. Permanent cleanup is a deliberate future action rather than an automatic side effect of deleting manuscript files.

Editorial notes can contain unpublished material. In a private manuscript repository the portable file can normally be committed. In a public repository, exclude `.murmuration/writing-companion/editorial-data.json*` when those notes should remain private.

## Chapter Context

Title, POV, story date, chapter status, editorial pass and change summary are editable directly in Chapter Context. Changes write through to the active chapter's Markdown frontmatter; properties remain the authoritative source and are never copied into the editorial store.

Title appears as the first context field. When it is missing, the filename is shown only as placeholder guidance and is not written into frontmatter. Changing the title does not rename the Markdown file.

POV values retain their Markdown form for editing, including wikilinks such as `[[Tobias]]`, with a clickable rendered preview beneath the field. Story date uses a date control for ISO dates while preserving existing non-ISO values as text.

Chapter status is selected from `idea`, `draft`, `revision` and `complete`. Existing non-standard values remain visible until the author deliberately selects a replacement, and the blank option removes the property cleanly.

Editorial pass uses the canonical Draft, Structure, Character, Dialogue, Continuity, Style and Proof workflow. The displayed labels are title-cased while the frontmatter values are stored in lowercase. Existing non-standard values remain available until deliberately replaced.

## World Context

World Context is read-only and derives its entries from the active chapter's recognised POV link and explicit `world_context` property. Only notes already indexed as Story World entities are shown.

Entries display their canonical name, entity type, canon status and optional concise summary. Planned and Candidate items remain visibly labelled rather than appearing as Confirmed canon. POV-derived entries are marked separately, and duplicate references to the same resolved path display only once.

Clicking an entry opens the authoritative entity note. Missing, malformed and unresolved links degrade quietly. Merely viewing the section never changes chapter frontmatter, Story World notes or editorial storage.

## Editorial Passes

Each chapter has a checklist for Draft, Structure, Character, Dialogue, Continuity, Style and Proof. Completing or reopening a pass writes a timestamped event to the portable editorial store, so earlier completion history is retained even when a pass is reopened.

The checklist is independent of the current `editorial_pass` Markdown property. Selecting a current focus does not complete it, and completing a checklist item does not change frontmatter or manuscript text.

## Interface and sidebar layout

Manuscript, Story World Navigator, Writing Companion, Entity Inspector and Story World Timeline share a restrained visual system designed for light and dark themes, keyboard navigation and both narrow and wide pane layouts.

Within Writing Companion, Chapter Context, World Context, Editorial Passes and Chapter Notes can be collapsed independently. Annotations remains open and prominent as the active review queue. Collapsing one section never closes another.

Collapsed Chapter Context shows a compact summary of the available POV, story date, chapter status and current editorial pass. World Context shows referenced entity names and a resolved count. Editorial Passes retains its completed count, while Chapter Notes indicates whether notes exist and shows a one-line preview when available.

The chosen layout is remembered locally for each vault. It is a user-interface preference only: it is not written to manuscript Markdown, frontmatter, portable editorial storage or Git. Chapter Context and Chapter Notes start open; World Context and Editorial Passes start collapsed to preserve sidebar space.

## Annotation workflow

Select manuscript text and choose **Annotate**. The Companion opens with a blank annotation editor focused and ready for typing; placeholder guidance disappears as soon as text is entered.

Click an annotation's manuscript extract to open the chapter and select that passage. The Companion matches the stored text nearest its original line and falls back to the stored line if the passage has changed.

Open annotations are displayed in manuscript order with a remaining count. Resolving an annotation removes it from the active list and brings the next annotation into view.

Resolved annotations can be revealed beneath the open queue. They remain navigable, appear in a quieter read-only style, and can be reopened when further work is needed.

## Reporting open annotations

The plugin exposes each chapter's derived open-annotation count through the
Markdown property `mwc_open_annotations`. Chapters with no open annotations do
not retain the property. This makes it possible to filter and sort chapters in
Obsidian Bases without duplicating the annotation data or adding a separate
reporting interface.
