# Murmuration Writing Companion 0.13.0

This release turns the Companion into a durable chapter-editing workspace rather than a temporary sidebar.

## Highlights

- **Portable editorial data** — Chapter Notes, annotations and editorial-pass history now live in `.murmuration/writing-companion/editorial-data.json`, with migration, atomic writes, backup recovery and safe chapter delete/restore handling.
- **Editable Chapter Context** — Title, POV, story date, chapter status, current editorial pass and change summary can be edited directly while Markdown frontmatter remains authoritative.
- **Editorial-pass workflow** — Chapters have an independent seven-stage completion checklist with retained completion/reopen history.
- **Progressive disclosure** — Chapter Context, Editorial Passes and Chapter Notes collapse independently, remember their layout locally per vault, and leave Annotations prominent.
- **Safer delivery** — The project now has TypeScript regression tests and a GitHub Actions build-and-test gate.

## Compatibility

- Obsidian 1.5.0 or later.
- Designed to work across Obsidian desktop platforms. Linux is the primary development environment; Windows is included in the 0.13.0 smoke-test checklist.

## Installable files

Attach these files to the GitHub release:

- `main.js`
- `manifest.json`
- `styles.css`

For a manual installation, place all three files in:

```text
<Vault>/.obsidian/plugins/murmuration-writing-companion/
```

Then enable **Murmuration Writing Companion** in Obsidian's Community plugins settings.

## Data note

Editorial content may contain unpublished manuscript material. The portable `.murmuration` data can be backed up or shared with the vault, but authors should exclude it from public repositories when those notes are private.
