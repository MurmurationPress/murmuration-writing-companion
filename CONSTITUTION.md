# Murmuration Writing Companion Constitution

> Quiet tools for complex stories.

**Version:** 1.0.0  
**Ratified:** 12 July 2026

## Purpose

The [Murmuration Manifesto](MANIFESTO.md) states what this project believes. This Constitution turns those beliefs into rules for product design, data ownership, interface behaviour, architecture and development.

It applies to every feature, issue, pull request, migration and release.

When decisions conflict, the order of authority is:

1. This Constitution
2. Accepted architectural decisions
3. Approved feature specifications and acceptance criteria
4. Implementation convenience

The terms **MUST**, **SHOULD** and **MAY** are used deliberately:

- **MUST** identifies a requirement that cannot be ignored without amending this Constitution.
- **SHOULD** identifies the expected approach unless a documented reason justifies an exception.
- **MAY** identifies an allowed choice.

---

## Article I — The manuscript is sovereign

1. The manuscript is the primary artefact.
2. A manuscript MUST remain readable, editable and publishable without the Writing Companion installed.
3. Editorial notes, annotations, checklists and workflow state MUST NOT be inserted into manuscript prose.
4. The Companion MUST NOT silently rewrite, reformat or reorganise unrelated manuscript content.
5. Changes to manuscript properties MUST result from an explicit author action, except for narrowly defined derived reporting properties.
6. Derived reporting properties MUST:
   - use the `mwc_` namespace;
   - contain no unique editorial knowledge;
   - be reproducible from their authoritative source; and
   - be safe to delete and rebuild.
7. A feature that risks damaging manuscript content or making the manuscript dependent on the plugin MUST NOT be released.

## Article II — Every fact has one authoritative source

1. Every stored value MUST have one declared authoritative source.
2. Ordinary chapter metadata, including title, POV, story date, chapter status, editorial pass and change summary, belongs in Markdown properties.
3. Companion-specific editorial knowledge, including chapter notes, annotations and checklist completion, belongs in the editorial store.
4. Data MUST NOT be copied into a second store merely to simplify rendering or reporting.
5. A derived value MAY be projected elsewhere, but the projection MUST remain subordinate to and recoverable from its authoritative source.
6. Manual edits to a derived projection MUST NOT mutate its authoritative source.
7. Feature specifications MUST state where each new datum lives, who owns it and how duplication is prevented.

## Article III — Authors own their work and their editorial history

1. Manuscripts and editorial data MUST use open, inspectable and documented formats.
2. Core writing and review workflows MUST remain local-first and MUST NOT depend on a network service.
3. Editorial data MUST be portable with the writing project across supported installations.
4. Storage MUST work with ordinary backup and synchronisation practices, including vault copies, Git and Obsidian Sync where technically appropriate.
5. Storage design MUST document:
   - what travels with the vault;
   - what may contain private material;
   - what should or should not be committed to version control; and
   - how data can be recovered without relying on hidden application state.
6. Schema changes MUST include a versioned migration path.
7. Migrations MUST preserve existing editorial data or fail safely without overwriting it.
8. No feature MAY create avoidable lock-in to the Writing Companion, Obsidian or a proprietary service.

## Article IV — Every feature must reduce cognitive load

1. Every feature MUST solve a recognisable author problem.
2. A feature MUST remove more attention, memory or decision-making burden than it introduces.
3. The default workflow SHOULD be focused and opinionated rather than infinitely configurable.
4. The interface SHOULD present one clear next action whenever the author is completing a defined workflow.
5. Secondary controls and metadata SHOULD use progressive disclosure.
6. Dashboards, metrics and status displays SHOULD exist only when they help the author decide or act.
7. Configuration MUST NOT be added merely because different behaviour is technically possible.
8. When a feature cannot demonstrate a meaningful reduction in cognitive load, it SHOULD not be built.

## Article V — Use the language of authors

1. The user interface, documentation, issue titles and acceptance criteria MUST use the language of authors wherever practical.
2. The project speaks of manuscripts, books, parts, chapters, scenes, notes, annotations, passes and writing sessions—not records, entities, objects or configuration payloads.
3. The source code SHOULD reveal the same product model that the author sees.
4. Obsidian, filesystem and storage terminology SHOULD be contained at integration boundaries.
5. New concepts MUST be named before they are implemented.
6. One concept SHOULD have one stable name across the interface, documentation and code.

## Article VI — The interface serves the writing flow

1. Manuscript content MUST appear before commentary about it.
2. Editorial controls MUST support the author’s attention rather than compete with the manuscript.
3. Metadata SHOULD be visually subordinate to the text or decision it supports.
4. The Companion SHOULD remain calm, compact and usable in an Obsidian sidebar.
5. Missing or irrelevant information MUST be omitted cleanly rather than displayed as empty fields or warnings.
6. Normal writing MUST NOT be interrupted by unnecessary modal dialogues, confirmations or notifications.
7. Navigation from editorial material back to the manuscript SHOULD preserve context and minimise disorientation.
8. Resolved work SHOULD remain recoverable without dominating the active workflow.
9. The interface SHOULD remain usable with keyboard navigation and ordinary Obsidian accessibility settings.

## Article VII — Integrate with the Obsidian ecosystem; do not replace it

1. The Companion MUST preserve valid Markdown, YAML frontmatter, wikilinks and ordinary Obsidian behaviour.
2. Existing compiler, Dataview, Bases, theme and publishing workflows MUST remain unaffected unless a feature explicitly and intentionally extends them.
3. Native Obsidian capabilities SHOULD be used when they already provide a reliable solution.
4. The Companion SHOULD present and coordinate existing manuscript information rather than create parallel systems.
5. Frontmatter updates MUST preserve recognised aliases where practical and MUST remove empty values cleanly.
6. External changes to authoritative manuscript properties SHOULD refresh in the Companion without requiring the chapter to be reopened.
7. Theme support MUST enhance the writing environment without changing manuscript semantics or compiler output.

## Article VIII — Automation must be transparent, reversible and subordinate

1. The author remains the final editorial authority.
2. Automated actions MUST be understandable from the interface or documentation.
3. Destructive actions MUST provide an appropriate confirmation, undo path or recovery mechanism.
4. Automation MUST NOT make hidden editorial decisions or silently alter manuscript meaning.
5. Suggestions generated by rules, language models or other automated systems MUST be clearly distinguishable from the author’s text.
6. Automated suggestions MUST NOT be written into the manuscript without explicit acceptance by the author.
7. Manuscript or editorial content MUST NOT be transmitted to an external service without clear, prior and informed author consent.
8. Optional automation MUST fail without blocking access to the manuscript or existing editorial data.

## Article IX — Trust is a product requirement

1. Data loss is a release-blocking defect.
2. Chapter notes and annotations MUST survive normal application restart, file rename and file move operations.
3. Autosave behaviour MUST be predictable and resilient to interrupted edits.
4. A damaged or unrecognised editorial record SHOULD be isolated rather than preventing the remainder of the project from loading.
5. Recovery and migration behaviour MUST be testable.
6. The most important tests SHOULD protect:
   - manuscript integrity;
   - authoritative-source rules;
   - annotation and chapter-note persistence;
   - file rename and move handling;
   - migration safety; and
   - compatibility with Obsidian properties and links.
7. A feature is not complete merely because its ideal path works.

## Article X — Keep the Companion small and coherent

1. The Writing Companion is a focused writing and editorial companion, not a general project-management platform.
2. New capabilities MUST strengthen the core manuscript, annotation, chapter-note or editorial-pass workflows.
3. Features SHOULD compose with Obsidian and other tools rather than duplicate them.
4. The architecture MUST preserve clear responsibilities:
   - **Companion** coordinates the user-facing writing experience.
   - **Editorial** models editorial knowledge and workflow.
   - **Storage** persists, loads and migrates data.
   - **UI** provides reusable presentation and interaction components.
5. Editorial rules MUST NOT be hidden inside visual components.
6. Storage details MUST NOT leak into the author-facing product model.
7. Obsidian-specific integration SHOULD remain at the application boundary.
8. Architectural complexity MUST be justified by a current product need, not a hypothetical future one.

## Article XI — Features must pass the constitutional test

Before implementation, every substantial feature MUST answer:

1. What author problem does this solve?
2. How does it reduce cognitive load?
3. What is the authoritative source for each new value?
4. Where is the data stored, and how does it travel with the project?
5. Does it write to the manuscript or frontmatter? If so, exactly when and why?
6. How does it preserve Obsidian, compiler, Bases and Dataview behaviour?
7. What happens when data is missing, stale, moved or malformed?
8. Is the action transparent and reversible?
9. What tests protect manuscript integrity and editorial history?
10. Can the outcome be described in the language of authors?

A feature that cannot answer these questions is not ready for implementation.

---

## Governance

### Amendment

This Constitution MAY be amended only through a dedicated pull request that:

- explains the author or project need;
- identifies the articles being changed;
- describes the effect on existing features and stored data; and
- separates constitutional changes from unrelated implementation work.

### Versioning

The Constitution uses semantic versioning:

- **MAJOR** — changes or removes an existing principle;
- **MINOR** — adds a new principle or materially expands governance;
- **PATCH** — clarifies wording without changing intent.

### Compliance

1. New work MUST comply when introduced.
2. Existing code SHOULD be brought into compliance when the affected area is changed.
3. Pull requests SHOULD identify any constitutional articles that materially shaped the implementation.
4. Convenience, speed and technical elegance do not override the author’s ownership, manuscript integrity or editorial history.

---

## Final test

When uncertain, ask:

> Does this help the author remain inside the story while keeping their work entirely their own?

If the answer is no, the Writing Companion should not do it.
