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

## Chapter Context

Title, POV, story date, chapter status, editorial pass and change summary are editable directly in Chapter Context. Changes write through to the active chapter's Markdown frontmatter; properties remain the authoritative source and are never copied into the editorial store.

Title appears as the first context field. When it is missing, the filename is shown only as placeholder guidance and is not written into frontmatter. Changing the title does not rename the Markdown file.

POV values retain their Markdown form for editing, including wikilinks such as `[[Tobias]]`, with a clickable rendered preview beneath the field. Story date uses a date control for ISO dates while preserving existing non-ISO values as text.

Chapter status is selected from `idea`, `draft`, `revision` and `complete`. Existing non-standard values remain visible until the author deliberately selects a replacement, and the blank option removes the property cleanly.

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
