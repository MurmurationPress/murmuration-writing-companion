# Murmuration Writing Companion 0.19.0

Prepared release; not yet published. This release improves performance and interaction stability and completes the handoff of dataset reports to Murmuration Reports.

## Performance and stability

- Pending manuscript-numbering requests coalesce to the latest state; queued work cancels on unload (#256).
- Companion and Navigator preserve first clicks, keyboard focus and unsaved drafts through pane activation, metadata changes and blur saves (#258).
- Cold Navigator updates are batched, and warmed views reuse display projections and date formatting while mutations still read fresh authority (#266).
- The production JavaScript bundle meets the existing 50 KiB headroom target. This does not resolve all remaining startup, layout and platform acceptance work under #252.

The accumulated release also includes manuscript preparation for untyped projects, explicit Book-scoped scene numbering, stale-numbering status and subsequent review/index convergence fixes. Read the task guides before using preparation or numbering; neither runs silently during ordinary edits.

## Dataset reporting transition

Install [Murmuration Reports 0.1.0](https://github.com/MurmurationPress/murmuration-reports/releases/tag/0.1.0) for dataset charts and state tables. Its **Open Reports** manager provides creation, source-preserving editing, saved previews and explicit generation. Reports supports desktop Obsidian only; MWC has no hard dependency on it. Manuscript-aware continuity, entity indexes and annotation reporting remain in MWC.

MWC **0.19.0 retains both deprecated command aliases**, preserving existing hotkeys. They delegate only when invoked and explain how to enable Reports when unavailable. Removal is proposed for **0.20.0**, the immediately following MWC release. Before upgrading to that release, rebind shortcuts in **Obsidian Settings → Hotkeys**:

| Existing MWC command | Reports replacement |
| --- | --- |
| Generate derived artefact (`murmuration-writing-companion:generate-derived-artefact`) | Generate active report definition (`murmuration-reports:generate-derived-artefact`) |
| Generate all derived artefacts (`murmuration-writing-companion:generate-all-derived-artefacts`) | Generate all report definitions (`murmuration-reports:generate-all-derived-artefacts`) |

Neither plugin edits hotkey files or automatically moves, deletes or regenerates existing definitions/assets. Saved SVG and Markdown outputs remain displayable and compilable with both plugins disabled. Legacy SVG adoption and ownership repair after definition moves require explicit validated consent in Reports. Avoid using older MWC dataset writers on Reports-managed assets.

## Installation and requirements

Install `main.js`, `manifest.json` and `styles.css` together in `.obsidian/plugins/murmuration-writing-companion/`, then enable MWC. Obsidian 1.5.0 remains the declared minimum; the qualification report names versions actually exercised. Back up the vault and its editorial store before upgrading. Install Reports separately if dataset generation is needed; existing outputs require neither plugin.

## Known limitations and release qualification

Large-vault cold startup, full-book projections and DOM/layout costs still need work. Native Windows acceptance and wider Linux theme/plugin, physical-focus, multi-window and IME acceptance are distinct from automated CI. See [the release-readiness report](docs/release-readiness-0.19.0.md) for actual passed checks and unresolved gates. #252 remains open.

Reports ownership receipts are safety metadata, not display dependencies. Obsidian's SDK does not provide crash-atomic multi-file transactions; conditional checks, verification and recovery reduce write risk but cannot guarantee atomic output/receipt updates or revoke an already-committed host write. The existing [Reports ownership policy](https://github.com/MurmurationPress/murmuration-reports/blob/0.1.0/docs/ownership.md) remains authoritative.
