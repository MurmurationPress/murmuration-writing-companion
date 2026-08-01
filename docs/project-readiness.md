# Project readiness and first-run guidance

**Open project readiness** is a read-only inspection of the current vault. On the first suitable startup, after Obsidian's workspace and metadata are ready, MWC shows one quiet notice with an optional button to open the full summary. The invitation is remembered locally per vault. It is not shown again after plugin reloads or metadata refreshes, and the command or Settings button always remains available.

If the startup invitation was missed, the first deliberate opening of an MWC surface runs the same read-only check and shows one state-aware hint while the requested surface opens normally. The hint is not repeated. Opening readiness records that guidance locally and suppresses the interaction hint; it does not change project files or editorial storage.

Readiness reports every recognised Book independently using the same analysis as **Prepare existing manuscript**. A Book may be prepared already; safely preparable from a complete legacy `manuscript_order` list or deterministic Navigator order; partially prepared; conflicting; malformed; ambiguous; or not safely recognised. Multiple Books may have different states. The summary never chooses between competing structures and does not persist its derived result.

For a safely preparable Book, **Prepare** opens the existing exact #91 preview. Readiness cannot execute the migration itself. The preparation workflow explains every property operation, requires approval, verifies writes, rolls back failures, and offers immediate Undo. If preparation is blocked, readiness shows the same affected paths and property diagnostics and routes to the Manuscript Navigator instead of offering an enabled write action.

The Story World section is independent and optional. It counts canonical indexed entities and Events and, when available, summarises significant Story World Review observations. A manuscript does not need a Story World. Editorial information is also separate from manuscript authority; readiness only reports whether existing portable editorial data is loaded and never creates it.

Opening, refreshing, or dismissing readiness does not create files, folders, sample prose, Books, Parts, Scenes, Story World notes, frontmatter, or editorial data. It never renames files or repairs ambiguity. A clean vault is a valid starting point, not an error.

An empty vault is shown as **Ready to begin** and links to Manuscript Navigator, where **New Book** opens the existing confirmed creation workflow. If Markdown already exists but no Book is recognised, readiness says so explicitly: folders named `Books`, `Book 1`, or `Part 1` are not themselves authoritative notes. Identify or add a note for each Book with `type: book`, recheck readiness, and then use the existing preparation preview to adopt a deterministic existing hierarchy safely.

If structure is blocked, open the technical details and correct the named note and property. Common causes are unresolved `parent` links, duplicate or malformed `manuscript_order_key` values, conflicting `type` properties, or malformed/incomplete legacy arrays. Then choose **Recheck project readiness**. See [Prepare an existing manuscript](prepare-existing-manuscript.md) for preview, rollback, Undo, and authoritative property details.

This readiness contract is explained in the #161 onboarding documentation and demonstrated by its example vaults. #160 owns the final release-validation matrix. Automatic project creation, example-vault insertion, compiler setup, telemetry, and destructive repair remain deliberately outside this workflow.

For the complete author journey, use the [V2 onboarding guide](v2-onboarding-guide.md) and its separate [prepared and migration example vaults](../examples/v2-onboarding/README.md).
