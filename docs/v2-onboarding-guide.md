# Getting started with Murmuration Writing Companion

Murmuration Writing Companion (MWC) helps you organise a long manuscript, keep an optional Story World, review continuity and produce reviewable Markdown reports. Your manuscript and Story World notes remain authoritative. MWC reads and presents them; it does not silently extract canon from prose or replace your files with a private database.

## The short path

1. Install and enable MWC.
2. Open **Project readiness** from the first-run invitation, the Command Palette command **Open project readiness**, or **Settings → Murmuration Writing Companion → Project readiness**.
3. If the vault is empty, open **Manuscript** and create a Book, optional Parts and Scenes through the visible controls.
4. If an existing Book is recognised, review its readiness state. Use **Prepare manuscript** only when offered.
5. Read the complete preview. Nothing is written until you approve it.
6. Open **Manuscript**, then add Story World notes only if they help your project.

Opening, refreshing, dismissing or reopening Project Readiness does not change manuscript Markdown, Story World Markdown or editorial information.

## Install and enable the plugin

Use the official MWC release package supplied by Murmuration Press. Close or reload Obsidian after placing the release files in `.obsidian/plugins/murmuration-writing-companion/`, then enable **Murmuration Writing Companion** under **Settings → Community plugins**. A release installation contains `main.js`, `manifest.json` and `styles.css`; it does not require development tools.

Maintainers building from source should follow the [development installation instructions](../README.md#development-install). Ordinary users should not need GitHub, npm or repository knowledge.

## First run and Project Readiness

After the workspace and metadata index are ready, MWC shows one quiet readiness invitation for the local vault. It does not block Obsidian. If you miss it, the first deliberate opening of an MWC surface shows one non-blocking, state-aware hint while opening the requested surface normally.

The invitation and interaction hint are remembered locally and do not repeat after every metadata refresh or plugin reload. Dismissal affects presentation only. **Open project readiness** and the Settings button remain available, and every manual opening or **Recheck project readiness** rebuilds the result from current notes.

### What each readiness result means

| Result | What MWC detected | What to do |
|---|---|---|
| **Ready to begin** | No Markdown notes. This is not an error. | Open **Manuscript** and use **Create book**, then create optional Parts and Scenes. |
| **Existing notes found, but no manuscript is recognised** | Markdown exists, but no recognised Book note exists. Folder names alone are not authority. | Confirm that the material is a manuscript, identify or add a Book note with `type: book`, then recheck. |
| **Project already prepared** | Every recognised Book uses distributed `type`, `parent` and order-key authority. | Open Manuscript Navigator, Story World views or Continuity Review. Do not prepare again. |
| **Preparation available** | A complete legacy `manuscript_order` or deterministic Navigator folder/filename sequence can be migrated safely. | Select the specific Book's **Prepare manuscript** action and review the exact preview. |
| **Preparation needs attention** | Some distributed authority exists, but safe completion is blocked. | Read the Book's technical details and correct only the named conflict. |
| **Structural conflict requires review** | Conflicting, malformed, ambiguous or unrecognised structure prevents a safe choice. | Open diagnostics and the affected notes. MWC will not select a fallback or repair them silently. |

Each Book is analysed independently. In a multi-Book vault, one Book may be prepared while another offers preparation or reports a conflict. A preparation action always targets the Book named on that action and enters the existing preview.

Story World and editorial information are independent signals. A Story World without a manuscript and a manuscript without a Story World are both supported. Existing editorial information is reported separately and is never manuscript authority.

### Folder and filename ordering

MWC can propose the same deterministic folder and natural filename sequence shown by Manuscript Navigator. Numeric prefixes are not required. Mixed Book children are supported, so a direct Scene may appear alongside Parts. Distinct names such as `Part 1` and `Part 2` have a natural deterministic order. Preparation remains blocked when two siblings claim the same explicit numeric prefix or when their filenames compare as genuinely indistinguishable.

## Books, Parts and Scenes

After preparation, every structural note owns its authority.

### Book

```yaml
---
type: book
---
```

### Part

```yaml
---
type: part
parent: "[[Book Title]]"
manuscript_order_key: BZZZZZZZZZ
---
```

### Scene inside a Part

```yaml
---
type: scene
parent: "[[Part Title]]"
manuscript_order_key: BZZZZZZZZZ
---
```

### Scene directly inside a Book

```yaml
---
type: scene
parent: "[[Book Title]]"
manuscript_order_key: BZZZZZZZZZ
---
```

`parent` establishes hierarchy. `manuscript_order_key` orders notes only among siblings with the same parent. A Book's Parts and direct Scenes form one sibling group; Scenes inside each Part form separate sibling groups and may reuse the same keys. Filenames and folders remain useful for people, but distributed note properties are final authority after preparation. Numeric prefixes are optional, and reporting properties such as `book`, `part`, `chapter` or `manuscript_sequence` may remain without becoming structural authority.

Use Manuscript Navigator's reorder controls rather than hand-editing order keys during ordinary work.

## Prepare an existing manuscript

Preparation starts with one recognised Book. MWC reuses the hierarchy and order already recognised by Manuscript Navigator:

- valid distributed properties remain authoritative;
- a complete Book-level `manuscript_order` may be used once as reviewed migration evidence;
- otherwise a deterministic folder and filename interpretation may be proposed;
- malformed or incomplete legacy arrays, unresolved hierarchy and unsafe mixed metadata block preparation.

Choose the Book-specific **Prepare manuscript** button in the Navigator notice, or run **Prepare existing manuscript** from the Command Palette or Navigator toolbar overflow.

### Review the exact preview

The preview identifies the Book, detected structure and order source. It lists every affected note and every proposed property addition, replacement, canonicalisation or removal, plus Book, Part and Scene counts, warnings and blocking diagnostics. It also explains that prose, filenames, folders and unrelated metadata are preserved.

Cancel closes the preview without writing. A blocked preview has no approval action. Approval is always explicit.

### What preparation may change

Preparation may add or safely canonicalise:

- `type`;
- `parent`;
- `manuscript_order_key`.

It may remove an obsolete Book-level `manuscript_order`, but only after all child writes have been read back and verified.

### What preparation never changes

Preparation does not edit prose, rename files, move folders, delete Scenes, remove unrelated properties, create Story World entities, alter editorial dispositions or infer missing hierarchy while ambiguity remains.

## Transaction, rollback and immediate Undo

Preparation is one operation. Before writing, MWC checks that every previewed file still exists at the same path, still matches the preview, contains no new merge-conflict markers and has no new structural conflict. It prepares and verifies children before removing a legacy order array.

If a write or verification fails, MWC stops and restores every file already changed to its exact original bytes. After success, **Undo manuscript preparation** restores those original files, including property presence, values, formatting and a removed legacy array. Undo refuses to overwrite files edited after preparation. Resolve the named stale file without discarding the later edit, then retry Undo while the immediate Undo operation remains available.

Immediate Undo is an in-session safety feature, not crash recovery. Keep ordinary backups or version control. For unusual failures, follow [Recovery and troubleshooting](#recovery-and-troubleshooting).

## Add or connect a Story World

Story World is optional and independent from preparation. A note opts in only through a non-empty `world_entity` property:

```yaml
---
world_entity: character
world_name: Mara Venn
aliases:
  - Mara
world_status: confirmed
---
```

Events may use `world_time`; entity-owned `world_relationships` hold qualified relationship statements; `world_sources` links provenance to manuscript or reference notes. A Scene connects explicit context with `world_context`:

```yaml
world_context:
  - "[[Mara Venn]]"
  - "[[Signal Emerges]]"
```

MWC does not automatically extract entities, relationships or occurrences from unlinked prose. Story World Markdown remains authoritative. Navigator, Timeline, graph, impact, Story World Review and Continuity Review are derived views.

Use:

- **Open Story World Navigator** to browse opted-in entities and models;
- **Open Story World Timeline** to inspect dated Events and their explicit manuscript sources;
- **Open Story World Graph** to inspect direct relationships and provenance edges;
- **Open Story World Review** for malformed or unresolved structured Story World evidence;
- **Open Continuity Review** for Book-scoped manuscript and relevant Story World observations;
- Entity Inspector to inspect an entity's explicit manuscript impact.

See the [Story World Entity Standard](story-world-entity-standard.md), [World Context Standard](chapter-world-context-standard.md), [relationship conventions](supporting-model-conventions.md), [graph guide](story-world-graph.md) and [Story World Review guide](story-world-review.md).

## Editorial information

Chapter notes, annotations, review state and continuity dispositions are editorial information, separate from manuscript and Story World authority. MWC stores them in its portable editorial storage. Merely opening onboarding does not create editorial information, and removing or reinstalling the plugin does not rewrite authoritative Markdown. Continue to keep normal backups.

If editorial storage is unreadable or incompatible, plugin startup may stop before onboarding can display the corresponding readiness state. That is an abnormal storage/recovery path retained for release validation under #160; onboarding does not duplicate or weaken storage error handling.

## Generated reports

Generated reports are disposable, reviewable Markdown projections over authoritative notes. They do not become manuscript or Story World authority and are excluded from indexing where appropriate.

- **Generate entity index** previews a selected-Book or vault-wide index using canonical entity identity, aliases, explicit occurrence evidence and Navigator order. It uses Scene references, not invented page numbers. See [Entity index](entity-index.md).
- Continuity Review can save a current Book review snapshot. See [Continuity Review reports](continuity-review-report.md).
- Story World Review is a live derived review surface; it does not currently save a dedicated report.
- Reference entities and `world_sources` provide current provenance and manuscript citation associations. Reference creation can locally parse a formatted citation or DOI into an editable proposal, and documented Bases/Dataview examples provide read-only tables. The plugin does **not** register a **Generate references report** or printing command.

## Recovery and troubleshooting

### No Book recognised

Check that a Book note—not only a folder—exists, is Markdown and contains `type: book`. Confirm that the files really form a manuscript and follow the Book, Part and Scene model. Reopen Project Readiness after editing.

### Duplicate explicit positions

Two sibling filenames beginning with the same numeric position cannot safely claim that position. Review their intended order. Rename only if that is your deliberate editorial choice, or supply a complete valid legacy order before preparation. MWC never renames them automatically.

### Indistinguishable filenames

If two sibling names compare as the same Navigator position, MWC refuses to choose. Give them clearly distinct filenames or establish a complete reviewed legacy sequence.

### Unresolved parent

Open the named note and inspect `parent`. Correct the wikilink so it resolves to the intended Part or Book. Do not delete every structural property as a shortcut.

### Malformed YAML

Open the affected note in source mode and inspect only the frontmatter between the opening and closing `---`. Look for incorrect indentation, an unfinished list or mapping, or conflict markers. Preserve unrelated properties and prose while fixing the reported syntax.

### Git or sync conflict markers

Resolve `<<<<<<<`, `=======` and `>>>>>>>` sections using your Git or sync tool before previewing again. MWC will not decide which side is authoritative.

### Files changed after preview

Cancel and generate a fresh preview. Stale-input protection exists to preserve edits, moves and renames made after analysis.

### Undo blocked

Undo protects later edits. Inspect every named stale file, preserve the later work, restore the expected post-preparation state if appropriate, and retry Undo. Do not force an old snapshot over new prose.

### Interrupted preparation

Inspect Git status or your backup before changing anything. Reopen Project Readiness and rerun analysis. If the manuscript is fully prepared, verify Navigator order and continue. If it is partial or conflicting, follow the exact diagnostics or restore the known pre-operation files from backup. Avoid manual bulk deletion of `type`, `parent` or order keys.

## Explore the example vaults

The release example archive contains:

- **prepared-vault** — one prepared Book, a direct opening Scene, two Parts, four Part Scenes, and a fictional Story World;
- **migration-vault** — a separate valid legacy-array Book for preview, preparation and immediate Undo testing.

Both are disposable and contain no PRIME prose, personal data, local paths, plugin binaries or live editorial storage. Follow the [example-vault README](../examples/v2-onboarding/README.md) and [manual validation procedure](v2-onboarding-manual-validation.md). The plugin never copies examples into a live vault automatically.

## Further help

- [Project Readiness details](project-readiness.md)
- [Prepare an existing manuscript](prepare-existing-manuscript.md)
- [Command and UI reference](v2-command-reference.md)
- [Screenshot production checklist](v2-onboarding-screenshot-checklist.md)
- [#160 release-validation handoff](v2-release-validation-handoff.md)
- [Maintainer architecture](../ARCHITECTURE.md)
- **About Murmuration Writing Companion** for installed version and official support links
