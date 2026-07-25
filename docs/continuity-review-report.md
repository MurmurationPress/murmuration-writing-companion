# Reusable Continuity Review report

Issue #135 adds **Generate report** to the existing Continuity Review workspace. The action creates a previewable Markdown snapshot; it does not create another review workspace or make the snapshot authoritative.

## Scope and structure

The author can preview either the entire selected Book or exactly the observations visible under the current Queue, Type, Location and Entity filters. Whole-Book scope deliberately uses the unfiltered current collection. Filtered scope records each active filter in the report header and never broadens the visible set.

Reports contain an authority statement, ISO timestamp, plugin version, summary counts by severity, observation kind and disposition, then disposition-state sections. Within each section observations follow authoritative flattened manuscript Scene order. Findings include readable source wikilinks, rule and fingerprint context, and separately headed manuscript, Story World, derived temporal and editorial-disposition evidence.

The report records current observations only. Historical disposition records with no current observation remain in portable editorial storage but do not fabricate report findings, matching the existing Continuity Review contract.

## Preview, copy and save

The modal shows the exact Markdown supplied to both copy and save actions. Copying uses the clipboard and creates no vault note. Saving uses `vault.create` only after an explicit click, opens the created note and never modifies manuscript, Story World or editorial sources.

The suggested filename is `Continuity Review - <Book> - YYYY-MM-DD.md`, with ` - Filtered` for filtered scope and invalid filename characters replaced. Authors may choose another path. If a destination already exists, saving is disabled and the create boundary rechecks it; the author must choose an alternative filename. There is no overwrite operation in #135.

Saved reports use `type: continuity-review-report`. This value is not a recognised Book, Part or Scene type, and the note has no `world_entity`, so existing manuscript and Story World index contracts exclude it.

## Authority and exclusions

Continuity observations remain disposable derivations, dispositions remain portable editorial state, and manuscript and Story World Markdown remain authoritative. Generating a report does not refresh disposition timestamps, create a reported state, correct continuity, or store a report cache.

Report history, scheduled generation, automatic comparison, overwrite management and conversion into Story World canon are outside this ticket. Git, Obsidian history or ordinary document tools may compare saved snapshots later.
