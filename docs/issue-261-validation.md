# Issue #261: reproduction and validation

## Demonstrated cause

The actual `prepare-existing-manuscript` callback was invoked against the supplied archive using a shared mock Obsidian API. With an empty-string vault root it showed deterministic folder order, six Parts and 43 inferred Scenes. With Obsidian's actual `/` root convention and exact path lookup it showed:

> Detected structure: Unsupported or unrecognised manuscript. Order source: none.

> The-Structure-of-Aikido.md: No recognised parts or scenes are available to prepare.

The installed Obsidian application's `obsidian.asar` confirms that its vault creates the root at `/` and `getAbstractFileByPath` performs an exact file-map lookup. `expectedAssociatedManuscriptFolderPath` joined that root with another `/`, looking up `//The-Structure-of-Aikido` instead of `The-Structure-of-Aikido`. A reload cannot correct that path. Normalising the parent before joining fixes recognition at the vault root without changing sibling or inside-folder companion rules. This is a demonstrated command-path defect, not a presumed metadata cache defect.

The other three inferred Scenes were Contents, Import Guide and Conversion Report. Explicit preparation now selects an existing root note/folder, reviews inclusion and proposed hierarchy/order, then previews exact metadata changes. The forty intended notes become Scenes and the six companion notes become Parts. Unclassified/support notes start excluded. Approved untyped exclusions use the existing `scene-draft` opt-out recognised by both MWC and Codex Press; these changes are previewed and included in the same transaction and Undo. Existing explicit classifications and order authority are retained.

## Automated regression evidence

`tests/fixtures/aikido-manuscript.json` contains the representative paths and imported properties, not the author's prose, images or plugin bundle. The command tests run the production registration, selection modals, recogniser, planner, transaction and Undo with a common Obsidian API stub. They cover typed/untyped roots, folder selection without a companion, forty Scenes/six Parts, support exclusions, inclusion changes, mixed direct Scenes/Parts, natural order, duplicate positions/companions, authority conflicts, unindexed/stale metadata, empty/malformed frontmatter, stale excluded/new inputs, valid legacy arrays/distributed keys, partial preparation, rollback, exact Undo, changed-note Undo refusal and idempotence. Preview and cancellation have zero writes. Prose, asset bytes and unrelated metadata are checked; no POV/date/status or derived numbering is required.

Required checks: `npm test`, `npm run build`, `npm run release:check`, plus `git diff --check`.

## Supplied archive and Codex Press

Reproduce the additional offline check from the repository root:

```bash
node scripts/validate-manuscript-preparation-archive.mjs '/path/to/The Structure of Aikido.zip'
```

This script extracts under a fresh temporary directory, exercises the actual registered preparation command and both review stages with mock Obsidian APIs, loads the archive's Codex Press bundle, and tests its order planner and complete book assembly. It writes prepared copies only under that temporary directory. It uses the supplied compiler's YAML parser for original source properties and preserves the 37 original asset files. It does not publish or use an author vault.

Both archive variants produced one recognised Book, six MWC Parts and forty Scenes. The typed version updated 49 notes (46 structural children and three exclusions); the untyped version updated 50 (also the Book). Immediate Undo restored every original note and all 37 assets exactly.

The bundled Codex Press order planner accepted all 46 structural entries with `source: explicit` and zero errors. Full assembly discovered one Book and forty documents with the support notes omitted, but added a seventh inferred section for the asset-only `Assets` folder and reported:

> `manuscript.order.part.source.missing`: Assets needs a part note before it can participate in manuscript_order.

**Full Codex Press acceptance is therefore not confirmed.** This is a separate compiler blocker in the supplied bundle. The validation script deliberately exits unsuccessfully on that compiler error. Creating a Part note for asset storage, moving assets or modifying another repository would conceal the problem and is outside this change.

## Live validation limitation

Obsidian was installed. Two attempts to start it with a disposable profile and extracted vault aborted before opening a vault with `FATAL:content/browser/sandbox_host_linux.cc:41`, `shutdown: Operation not permitted (1)`. The environment does not permit escalation. Consequently there was no live Obsidian command/UI validation, restart check, or live Codex Press export. The command and compiler checks above use mocks and do not replace that required live validation.

Before release, repeat the command in a disposable real Obsidian vault, confirm cancellation/Undo/idempotence and indexing behavior, resolve the Codex Press asset-folder blocker, and rerun its compiler acceptance. The author's live vault was never opened or modified.
