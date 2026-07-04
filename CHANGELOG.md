# Changelog

## 0.8.0

- Make annotation manuscript extracts clickable and keyboard accessible
- Open or activate the annotated chapter and select the matching passage
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
