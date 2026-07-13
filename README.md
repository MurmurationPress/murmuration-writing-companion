# Murmuration Writing Companion

A focused writing companion for Obsidian.

Writing a novel is difficult enough. Your tools shouldn't make it harder.

## Project documents

- [Manifesto](MANIFESTO.md) — what the project believes
- [Constitution](CONSTITUTION.md) — the binding rules for product and development decisions
- [Architecture](ARCHITECTURE.md) — the current division of responsibilities

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

- Open writing companion
- Annotate

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

Deleting a Markdown chapter does not delete its Chapter Notes, annotations or editorial-pass history. The record is marked with a deletion timestamp and restored automatically when a chapter is recreated at the same path. If another annotated chapter is renamed into that path, the deleted record is moved into the store's orphan archive so both editorial histories survive. Permanent orphan cleanup is a deliberate future action rather than an automatic side effect of deleting manuscript files.

Editorial notes can contain unpublished material. In a private manuscript repository the portable file can normally be committed. In a public repository, exclude `.murmuration/writing-companion/editorial-data.json*` when those notes should remain private.

## Chapter Context

Title, POV, story date, chapter status, editorial pass and change summary are editable directly in Chapter Context. Changes write through to the active chapter's Markdown frontmatter; properties remain the authoritative source and are never copied into the editorial store.

Title appears as the first context field. When it is missing, the filename is shown only as placeholder guidance and is not written into frontmatter. Changing the title does not rename the Markdown file.

POV values retain their Markdown form for editing, including wikilinks such as `[[Tobias]]`, with a clickable rendered preview beneath the field. Story date uses a date control for ISO dates while preserving existing non-ISO values as text.

Chapter status is selected from `idea`, `draft`, `revision` and `complete`. Existing non-standard values remain visible until the author deliberately selects a replacement, and the blank option removes the property cleanly.

Editorial pass uses the canonical Draft, Structure, Character, Dialogue, Continuity, Style and Proof workflow. The displayed labels are title-cased while the frontmatter values are stored in lowercase. Existing non-standard values remain available until deliberately replaced.

## Editorial Passes

Each chapter has a checklist for Draft, Structure, Character, Dialogue, Continuity, Style and Proof. Completing or reopening a pass writes a timestamped event to the portable editorial store, so earlier completion history is retained even when a pass is reopened.

The checklist is independent of the current `editorial_pass` Markdown property. Selecting a current focus does not complete it, and completing a checklist item does not change frontmatter or manuscript text.

## Sidebar layout

Chapter Context, Editorial Passes and Chapter Notes can be collapsed independently. Annotations remains open and prominent as the active review queue. Collapsing one section never closes another.

Collapsed Chapter Context shows a compact summary of the available POV, story date, chapter status and current editorial pass. Editorial Passes retains its completed count, while Chapter Notes indicates whether notes exist and shows a one-line preview when available.

The chosen layout is remembered locally for each vault. It is a user-interface preference only: it is not written to manuscript Markdown, frontmatter, portable editorial storage or Git. Chapter Context and Chapter Notes start open; Editorial Passes starts collapsed to preserve sidebar space.

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
