# Murmuration Writing Companion 0.16.0

Version 0.16.0 brings the complete author workflow into one connected Obsidian workspace.

Start in **Manuscript** to choose a book, review its structure, open scenes and safely reorder parts or scenes. Continue chapter review in the **Writing Companion**, where Chapter Context, book and editorial progress, notes and annotations stay close to the manuscript. Move into the **Story World Navigator** to browse or create entities and supporting models, then use the **Entity Inspector** to review identity, status, event time and author-maintained relationships. Open the **Story World Timeline** to see chronology or the event–scene map and navigate between events, their sources and manuscript scenes.

## Highlights

- Guided manuscript ordering supports drag-and-drop, keyboard and menu moves, structural validation and Undo.
- Prose-first Story World authoring can offer explicit character, event or relationship creation without treating every link as canon.
- Entity creation and relationship add, edit, supersede and remove workflows preview changes before writing.
- Event-time editing preserves authored precision and offsets while supporting point, range, approximate and partial dates.
- Chronology and event–scene mapping are derived from explicit Story World event and source Markdown.
- A unified visual system improves hierarchy, keyboard focus, accessible labels and narrow, wide, light and dark presentation.

## Authority and storage

Manuscript structure, chapter properties, Story World entities, relationships and event times remain authoritative Markdown. The navigator, inspector, index, chronology, relationship sentences and event–scene map are derived views; opening or browsing them does not move authority into the plugin.

Portable editorial data is separate. Chapter Notes, annotations and editorial workflow history are stored in `.murmuration/writing-companion/editorial-data.json`, with recovery and chapter rename, delete and restore handling. Local interface preferences remain local to the vault.

## Upgrade or install

This release declares Obsidian 1.5.0 as its minimum version.

For a manual install or upgrade, replace all three plugin files together:

- `main.js`
- `manifest.json`
- `styles.css`

Place them in `<Vault>/.obsidian/plugins/murmuration-writing-companion/`, restart or reload Obsidian, then enable **Murmuration Writing Companion**. A clean installation should use only the files published with the 0.16.0 release.
