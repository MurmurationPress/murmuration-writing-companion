# Changelog

## Unreleased

- Move Title into Chapter Context and remove the separate chapter heading
- Edit Title, POV and Story date directly alongside the existing context fields
- Preserve raw POV wikilinks while providing a clickable rendered preview
- Use a date control for ISO story dates without rewriting existing non-ISO values
- Keep Markdown frontmatter authoritative and remove properties when values are cleared
- Add TypeScript regression tests for Chapter Context and annotation navigation
- Add local single-run and watch test commands without introducing another test dependency
- Run automated tests and the production build in GitHub Actions for pushes and pull requests
- Replace free-text chapter status with an `idea`, `draft`, `revision`, `complete` dropdown
- Display chapter-status choices as Idea, Draft, Revision and Complete while retaining lowercase frontmatter values
- Preserve existing non-standard chapter status values until deliberately changed
- Replace free-text editorial pass with the canonical Draft, Structure, Character, Dialogue, Continuity, Style and Proof workflow
- Store canonical editorial-pass selections as lowercase frontmatter values while preserving unknown existing values
- Move Chapter Notes and annotations into versioned vault storage at `.murmuration/writing-companion/editorial-data.json`
- Migrate existing plugin data once without deleting the legacy migration backup
- Protect writes with temporary and last-known-good backup files
- Recover complete interrupted writes while refusing to overwrite malformed or unsupported newer storage
- Preserve unknown future-compatible editorial fields and chapter rename behaviour
- Retain Chapter Notes and annotations when their Markdown chapter is deleted
- Restore soft-deleted editorial data when the same chapter path returns
- Archive orphaned editorial records safely when another chapter is renamed into their old path
- Add a canonical per-chapter editorial-pass checklist beneath Chapter Context
- Record completion and reopening as timestamped append-only history in portable storage
- Preserve earlier completion events when a pass is reopened and suppress duplicate transitions
- Keep completed-pass history independent from the current `editorial_pass` frontmatter field


## 0.12.0

- Edit chapter status, editorial pass and change summary directly in Chapter Context
- Write changes through to the active chapter's Markdown frontmatter
- Reuse existing property aliases when present and create canonical properties when missing
- Remove empty editable properties cleanly
- Keep POV and story date read-only and preserve frontmatter as the source of truth


## 0.11.0

- Add a collapsed section for viewing resolved annotations in the active chapter
- Render resolved annotation cards in a quieter, read-only style
- Keep manuscript extract navigation available for resolved annotations
- Reopen resolved annotations and return them to the active review queue
- Update `mwc_open_annotations` automatically when annotations are reopened


## 0.10.0

- Maintain `mwc_open_annotations` in chapter frontmatter as a derived reporting property
- Update the property when annotations are created or resolved
- Remove the property when a chapter has no open annotations
- Reconcile stored annotation counts with chapter properties when the plugin loads
- Keep the annotation store as the source of truth


## 0.9.0

- Order open annotations by their manuscript line rather than creation time
- Show the number of open annotations remaining in the chapter
- Remove resolved annotations from the active review list immediately
- Bring the next annotation into view after resolving the current one


## 0.8.0

- Make annotation manuscript extracts clickable and keyboard accessible
- Open or activate the annotated chapter and select that passage
- Prefer the exact extract nearest its stored line, then exact matches elsewhere
- Fall back to the original line when the manuscript text has changed


## 0.7.0

- Create new annotations with an empty body and placeholder guidance
- Focus the newly created annotation editor without requiring an extra click
- Retry focus while Obsidian finishes opening and rendering the Companion sidebar


## 0.6.2

- Open rendered Chapter Context wikilinks through Obsidian's workspace API
- Resolve links relative to the active chapter and preserve modifier-click behaviour


## 0.6.1

- Render Chapter Context values using Obsidian's native Markdown renderer
- Display wikilink properties such as `[[Tobias]]` as clickable internal links


## 0.6.0

- Added a read-only Chapter Context section sourced directly from Markdown properties
- Presents POV, story date, chapter status, current editorial pass and change summary when available
- Omits missing and empty properties cleanly
- Refreshes Chapter Context when Obsidian detects frontmatter changes
- Keeps Markdown properties as the sole source of truth


## 0.5.0

- Redesigned annotation cards around the natural reading flow
- Manuscript extracts now appear before the editable annotation
- Moved category, line number and resolve action into a quiet footer
- Added compact scrolling for long manuscript selections
- Split annotation rendering into a dedicated AnnotationCard component


## 0.4.0

- Replaced addable Document Notes with one always-present Chapter Notes editor per chapter
- Chapter Notes save automatically while the author writes
- Existing open Document Notes are carried into the Chapter Notes field on first load
- Updated the domain model so each chapter has one Chapter Note


## 0.3.5

- Focuses the newly created annotation body automatically
- Selecting text and choosing Annotate now leaves the author ready to type immediately


## 0.3.4

- Fixed annotation workflow so the Writing Companion remembers the current chapter after the sidebar opens
- The Companion no longer loses chapter context when it becomes the active view


## 0.3.3

- Added right-click Annotate action for selected text
- Reused the Annotate command palette workflow
- Creating an annotation opens the Writing Companion automatically


## 0.3.2

- Introduced `AnnotationAnchor`
- Moved annotation anchor text and line into `annotation.anchor`
- No intended user-facing behaviour changes


## 0.3.1

- Reorganised source into `src/`
- Split companion view, editorial models, categories and note card rendering into separate modules
- No feature changes


## 0.3.0

- Renamed project to Murmuration Writing Companion
