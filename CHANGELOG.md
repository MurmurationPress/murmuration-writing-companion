# Changelog

## Unreleased


## 0.16.0 — 2026-07-21

### Manuscript navigation and ordering

- Add the **Manuscript** left-sidebar view for book–part–scene and direct book–scene structures, with book selection, active-scene tracking and scene opening.
- Support reviewed migration from Longform-style folders and numeric filename order into authoritative Markdown `manuscript_order` links.
- Add drag-and-drop, keyboard and menu-based scene and part reordering with structural validation, stale-edit protection and immediate Undo.

### Editorial workflow

- Add book review modes and status, an ordered scene editorial frontier and explicit repair when projected `editorial_pass` Markdown disagrees with portable workflow state.
- Keep Chapter Context editing, annotations, chapter notes and editorial-pass completion together in the **Writing Companion**, with exact manuscript navigation and locally remembered section layout.
- Preserve free-text and unresolved POV values while offering indexed Story World character suggestions.

### Story World foundations

- Define Story World entities, canon status and provenance, supporting models and explicit chapter `world_context` references as ordinary authoritative Markdown.
- Add a read-only, rebuildable index with vault-native wikilink resolution, aliases, incremental refresh and soft handling of unknown or malformed optional values.
- Present explicit World Context without inferring canon or relevance from prose, backlinks or folder placement.

### Prose-first Story World authoring

- Offer explicit, collision-safe character creation from unmatched POV values and event creation from newly written unresolved prose links.
- Offer guided relationship authoring when a newly written prose link resolves to an indexed entity, while allowing the author to keep the link as a reference only.
- Keep every proposed write previewable and require confirmation before changing Story World Markdown or chapter context.

### World Builder and entity creation

- Add the **Story World Navigator** and role-aware **Entity Inspector** for browsing entities and supporting models while their Markdown remains open in the editor.
- Add explicit entity creation with guided kind selection, minimal Markdown output and path and name collision checks.
- Group and order entities for scanning, including chronological event ordering, status presentation, search and accessible navigation.

### Relationships

- Render entity-owned relationships as readable statements with progressive disclosure of qualifiers, provenance and status.
- Add guided add, edit, supersede and remove workflows with target resolution, previews, stale-write protection and authoritative Markdown updates.
- Keep inverses, indexes and visual projections derived rather than storing duplicate relationship truth.

### Event-time editing and temporal reasoning

- Add guided editing for point, range, approximate and partially specified event times, preserving written precision, wall-clock values and offsets.
- Render British-English dates without rewriting ISO source values and calculate calendar-aware before, after and same-day context where the source data supports it.
- Keep relative-time presentation preferences local to the vault and avoid manufacturing missing temporal detail.

### Chronology and event–scene mapping

- Add the **Story World Timeline** centre view with filtered chronology, explicit ranges, unsupported or approximate times and undated events.
- Add an event–scene map derived from authoritative event time and source links, with synchronized selection and event/source navigation back to Markdown.
- Reuse a single timeline tab and the existing right-sidebar companion while switching cleanly between scenes and entities.

### Interface and accessibility

- Introduce a cohesive visual system for Manuscript, Story World Navigator, Story World Timeline, Writing Companion and Entity Inspector across light and dark themes and narrow and wide layouts.
- Improve hierarchy, density, focus states, keyboard access, accessible labels and restrained empty-state copy without changing stored workspace view IDs.
- Align panel titles, commands and tooltips with each panel's current role while preserving existing icons, navigation and saved workspace compatibility.


## 0.15.0 — 2026-07-15

- Add book-level editorial review mode in portable editorial workflow state
- Add authoritative book-level `review_status` frontmatter with Not started, In progress and Complete values
- Resolve the owning book through explicit manuscript hierarchy metadata
- Replace independent scene pass completion with one ordered editorial progress frontier
- Infer earlier passes from the furthest pass reached while retaining timestamped completion and reopening history
- Project the current frontier into authoritative `editorial_pass` Markdown for Bases, Dataview and publishing tools
- Report external `editorial_pass` disagreement and offer explicit repair instead of silently rewriting frontmatter
- Present POV as a compact Chapter Context property with Story World character suggestions
- Preserve free text and unresolved POV wikilinks without creating missing Story World notes
- Add an exact-only transient manuscript locator when navigating from annotations
- Keep line fallback navigational without presenting it as an exact match
- Add regression coverage and cross-platform build, test and release verification


## 0.13.0 — 2026-07-13

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
- Make Chapter Context, Editorial Passes and Chapter Notes independently collapsible
- Keep Annotations open while showing compact summaries for collapsed supporting sections
- Remember section layout as a local per-vault preference rather than manuscript or editorial data
- Use native keyboard-accessible disclosure buttons with explicit expanded state


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
- Bring the next annotation into view after resolving the current annotation


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
