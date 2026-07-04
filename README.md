# Murmuration Writing Companion

A focused writing companion for Obsidian.

Writing a novel is difficult enough. Your tools shouldn't make it harder.

## Development install

1. Copy this folder into `.obsidian/plugins/murmuration-writing-companion/`
2. Run `npm install`
3. Run `npm run build`
4. Enable **Murmuration Writing Companion** in Obsidian.

## Commands

- Open writing companion
- Annotate


## Chapter Notes

Each chapter has one always-present Chapter Notes editor in the Companion. Type general editorial thoughts directly into the box; changes are saved automatically.

## Chapter Context

The Companion presents POV and story date from the active chapter's Markdown properties and lets the author edit chapter status, editorial pass and change summary directly in the Chapter Context panel. Changes write through to frontmatter; properties remain the authoritative source and are never copied into the editorial store.

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

