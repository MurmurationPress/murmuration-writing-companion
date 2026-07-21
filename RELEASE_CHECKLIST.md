# 0.16.0 Release Checklist

## Automated gate

- [ ] `npm ci`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run release:check`
- [ ] Confirm `main.js`, `manifest.json` and `styles.css` are non-empty
- [ ] Confirm every current version declaration is `0.16.0` and `minAppVersion` remains `1.5.0`
- [ ] GitHub Actions succeeds on Ubuntu and Windows for the release PR head

## Existing Linux vault

- [ ] Back up a representative vault containing manuscript chapters, Story World entities, relationships, event times and existing portable editorial data
- [ ] Open **Manuscript**, select a book and confirm its parts and scenes appear in authoritative order
- [ ] Open scenes from **Manuscript**, confirm active-scene tracking, and exercise one reversible keyboard or menu move and Undo
- [ ] In the **Writing Companion**, edit Chapter Context and confirm the expected chapter frontmatter changes without duplicate properties
- [ ] Add and edit Chapter Notes, add an annotation, navigate to its manuscript extract, then resolve and reopen it
- [ ] Complete and reopen an editorial pass and confirm the book review and scene progress presentation remains coherent
- [ ] Open **Story World Navigator**, search and select both an entity and a supporting model
- [ ] Confirm **Entity Inspector** replaces **Writing Companion** for an active Story World item and returns to **Writing Companion** for an active manuscript chapter
- [ ] Create a disposable Story World entity and confirm its minimal Markdown, path, kind and status are correct
- [ ] Add, edit, supersede and remove a disposable relationship; confirm previews, readable statements and resulting authoritative Markdown at each step
- [ ] Edit point, range, approximate and partial event times and confirm authored precision, wall-clock values and offsets are preserved
- [ ] Open **Story World Timeline**, exercise chronology filters and confirm dated, ranged, unsupported and undated events are grouped correctly
- [ ] Switch to the event–scene map and confirm explicit source connections and synchronized selection
- [ ] Navigate from chronology and map events to entity Markdown, from source links to source notes, and from scene nodes to manuscript chapters
- [ ] Confirm manuscript and Story World browsing alone does not change Markdown or portable editorial data
- [ ] Check **Manuscript**, **Story World Navigator**, **Writing Companion**, **Entity Inspector** and **Story World Timeline** in light and dark themes
- [ ] Check the same views at narrow and wide pane widths, including keyboard focus, tooltips, menus, forms and empty states
- [ ] Restart Obsidian and confirm manuscript order, Story World Markdown, portable editorial data, timeline presentation and local panel preferences persist as designed

## Windows Obsidian smoke test

- [ ] Install `main.js`, `manifest.json` and `styles.css` together in a clean Windows test vault
- [ ] Enable Murmuration Writing Companion and open **Manuscript**, a chapter in the **Writing Companion**, an entity in **Entity Inspector**, and **Story World Timeline**
- [ ] Open a scene, edit one Chapter Context value, add and navigate an annotation, and complete and reopen an editorial pass
- [ ] Create a disposable entity, add and edit a relationship, and edit an event time
- [ ] Exercise chronology, the event–scene map and event/source/scene navigation
- [ ] Check keyboard operation and a narrow pane in both light and dark themes
- [ ] Restart Obsidian and confirm Markdown, portable editorial data and local presentation preferences persist

## Publish

- [ ] Merge the release PR only after explicit approval and successful Ubuntu and Windows checks
- [ ] Create tag `0.16.0` from the merged release commit
- [ ] Push tag `0.16.0`
- [ ] Confirm the Publish release workflow succeeds
- [ ] Confirm GitHub release `0.16.0` uses `RELEASE_NOTES.md`
- [ ] Confirm `main.js`, `manifest.json` and `styles.css` are attached and non-empty
- [ ] Download the published assets and perform a clean manual installation with no files retained from an earlier version
