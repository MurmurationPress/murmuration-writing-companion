# Changelog

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
