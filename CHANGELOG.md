# Changelog

## Unreleased

- Render authoritative Story World event times as readable British-English dates without rewriting ISO source values
- Respect declared or evident year, month, day, hour, minute and second precision without manufacturing detail
- Preserve written story dates, wall-clock times and offsets rather than converting through the system timezone
- Show deterministic before, after and same-day labels from chapter `story_date` and referenced point-event dates
- Present explicitly referenced Story World events before supporting entities in World Context
- Keep event name, authoritative `world_time`, canon status and concise summary permanently visible
- Present characters, organisations, locations, technologies and other supporting entities as compact linked names
- Stop duplicating a POV-only character in World Context while retaining explicitly referenced POV entities once
- Request Obsidian-native page previews for supporting entities on hover and keyboard focus
- Preserve ordinary click navigation and keep previewing entirely read-only
- Add a read-only World Context section for the active chapter
- Keep POV authority in Chapter Context while displaying only explicit `world_context` references
- Group resolved entities by type and show concise names, summaries and canon status
- Distinguish Planned and Candidate material from Confirmed canon
- Open authoritative entity notes through normal Obsidian navigation
- Persist World Context collapse state locally per vault and keep Annotations primary
- Omit malformed references and report unresolved links quietly without writing Markdown
- Add a read-only, rebuildable Story World index for opted-in Markdown entity notes
- Index entities by vault path, canonical name, aliases and entity type
- Preserve unknown entity types and extra properties while malformed optional values fail softly
- Refresh individual index records on metadata change, creation, deletion and rename
- Resolve ordinary wikilinks through Obsidian metadata with a unique name-or-alias fallback
- Keep Story World authority out of portable editorial storage and avoid sidebar-triggered vault rescans
- Define the optional `world_context` chapter property for explicit Story World relevance
- Avoid inferring World Context membership from POV, location, prose, backlinks or folders
- Keep free-text location metadata unchanged and avoid prose, backlink or folder inference
- Resolve wikilinks, aliases and path-qualified references through normal vault semantics
- Deduplicate resolved entities by vault path while preserving source Markdown unchanged
- Define Supporting Model conventions for relationships, timelines, knowledge states and continuity
- Establish qualified subject–predicate–object assertions with optional time, status, provenance and perspective
- Keep stored models authoritative only for author-maintained interpretation while indexes, inverses and graphs remain derived
- Require readable sentence rendering, guided authoring and progressive disclosure for non-technical authors
- Add PRIME-based examples for simple, time-bounded, timeline and knowledge-state relationships
- Define Confirmed, Planned, Candidate, Unresolved and Superseded Story World states
- Add lightweight source, first-appearance and replacement provenance conventions
- Keep authorial status separate from in-world confidence and belief
- Update Story World examples to use explicit confirmed status and provenance


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
