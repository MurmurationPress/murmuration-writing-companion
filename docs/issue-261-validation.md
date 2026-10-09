# Issue #261: reproduction and validation

## Demonstrated cause

The actual `prepare-existing-manuscript` callback was invoked against the supplied archive using a shared mock Obsidian API. With an empty-string vault root it showed deterministic folder order, six Parts and 43 inferred Scenes. With Obsidian's actual `/` root convention and exact path lookup it showed:

> Detected structure: Unsupported or unrecognised manuscript. Order source: none.

> The-Structure-of-Aikido.md: No recognised parts or scenes are available to prepare.

The installed Obsidian application's `obsidian.asar` confirms that its vault creates the root at `/` and `getAbstractFileByPath` performs an exact file-map lookup. `expectedAssociatedManuscriptFolderPath` joined that root with another `/`, looking up `//The-Structure-of-Aikido` instead of `The-Structure-of-Aikido`. A reload cannot correct that path. Normalising the parent before joining fixes recognition at the vault root without changing sibling or inside-folder companion rules. This is a demonstrated command-path defect, not a presumed metadata cache defect.

The other three inferred Scenes were Contents, Import Guide and Conversion Report. Explicit preparation now selects an existing root note/folder, reviews inclusion and proposed hierarchy/order, then previews exact metadata changes. The forty intended notes become Scenes and the six companion notes become Parts. Unclassified/support notes start excluded. Approved untyped exclusions use the existing `scene-draft` opt-out recognised by both MWC and Codex Press; these changes are previewed and included in the same transaction and Undo. Existing explicit classifications and order authority are retained.

## Automated regression evidence

`tests/fixtures/aikido-manuscript.json` contains the representative paths and imported properties, not the author's prose, images or plugin bundle. The command tests run the production registration, selection modals, recogniser, planner, transaction and Undo with a common Obsidian API stub. They cover typed/untyped roots, folder selection without a companion, forty Scenes/six Parts, support exclusions, inclusion changes, mixed direct Scenes/Parts, natural order, duplicate positions/companions, authority conflicts, unindexed/stale metadata, empty/malformed frontmatter, stale excluded/new inputs, valid legacy arrays/distributed keys, partial preparation, rollback, exact Undo, changed-note Undo refusal and idempotence. Preview and cancellation have zero writes. Prose, asset bytes and unrelated metadata are checked; no POV/date/status or derived numbering is required.

Required checks passed against current main (`6bba288`) with the asset preparation step: `npm test` (124 compiled files plus build-tools/interaction-capture suites), `npm run build`, `npm run release:check` and whitespace checks. The preparation command suite was also executed directly: all 32 regressions passed. The direct command suite includes typed/untyped asset relocation, external link review, both-stage cancellation, destination conflicts, stale assets/external notes, rollback after relocation, changed-asset Undo refusal and idempotence. Cache-only positions are filtered consistently during preparation, while Undo compares raw authored properties so an authored `position` edit cannot be overwritten. Undo records immutable source note paths to refuse later renames.

The installed bundle measures 726,176 bytes (202,398 gzip bytes), 5,323 bytes above the preceding preparation implementation. The explicitly documented budget increase from 704 KiB to 720 KiB accommodates asset relocation and restoration safeguards without a new production dependency. The headroom warning remains. See [bundle policy](bundle-size-policy.md).

## Supplied archive and Codex Press

Reproduce the additional offline check from the repository root:

```bash
node scripts/validate-manuscript-preparation-archive.mjs '/path/to/The Structure of Aikido.zip'
```

This script extracts under a fresh temporary directory, exercises the actual registered preparation command and both review stages with mock Obsidian APIs, loads the archive's Codex Press bundle, and tests its order planner and complete book assembly. It writes prepared copies only under that temporary directory. It uses the supplied compiler's YAML parser for original source properties and preserves the 37 original asset files. It does not publish or use an author vault.

Both archive variants produced one recognised Book, six Parts and forty Scenes. The final preview proposes moving the 37 image assets from `The-Structure-of-Aikido/Assets/` to vault-root `Assets/` and shows resolved Markdown link replacements. This arrangement is expected: assets belong outside the manuscript hierarchy. The previously observed seventh inferred Part disappeared once the reviewed relocation was applied. Existing asset destinations block preparation, rather than risking a merge or overwrite.

The bundled Codex Press order planner accepted all 46 structural entries with `source: explicit` and zero errors. Full book discovery and assembly accepted both prepared variants: one Book, six Parts, forty documents, no support notes and zero errors. The script now exits successfully. Every original asset retained its bytes; immediate Undo restored all 50 original notes, links and all 37 asset locations exactly. This confirms acceptance by the supplied compiler bundle through offline production integration; it does not claim a live Obsidian export.

## Agent-side live validation limitation (historical)

Obsidian was installed. Two attempts to start it with a disposable profile and extracted vault aborted before opening a vault with `FATAL:content/browser/sandbox_host_linux.cc:41`, `shutdown: Operation not permitted (1)`. The environment does not permit escalation. Consequently there was no live Obsidian command/UI validation, restart check, or live Codex Press export. The command and compiler checks above use mocks and do not replace that required live validation.

## Author-reported live validation and final review

On 9 October 2026, Ted reported testing the fix locally in Obsidian and confirmed that it works. This resolves the PR's outstanding live-validation blocker. This is Ted's validation; the reviewing agent did not perform it. The original agent-side launch limitation above remains recorded as historical evidence. Ted's feedback prompted the guide and Getting Started clarification: companion subfolders propose Parts, a flat chapter folder can contain direct Scenes, and authors must check proposed roles and parents before approval.

Final review found and reproduced malformed asset links for balanced parentheses in Markdown destinations and literal dollar sequences in wikilink filenames. The destination scanner now preserves balanced/escaped delimiters and link titles, parentheses are encoded in new Markdown paths, and wikilink replacement uses a callback so filenames cannot become replacement expressions. A regression covers preview, application and exact Undo; all 32 command regressions pass. Required tests, production build, release checks and the typed/untyped archive compiler integration were rerun successfully. Existing manuscript authority, zero-write previews, rollback and immediate Undo remain covered. No author vault was opened or modified by the agent.
