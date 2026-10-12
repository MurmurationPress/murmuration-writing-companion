# Dataset reporting transition

Chart and state-table generation and 21 regression tests have moved to [Murmuration Reports v0.1.0](https://github.com/MurmurationPress/murmuration-reports/releases/tag/0.1.0), extracted from main `d7c2e6e625e98fade7004a064ab081670e607d4e`. Manuscript numbering, annotation counts, entity indexes, continuity and other manuscript-aware reporting stay in MWC.

For one transition release, `ReportsCommandBridge` retains the old commands. It captures the active Markdown path before awaits and resolves `app.murmurationReports` version 1 at invocation. Reports owns discovery, rendering, receipts, adoption, writes and result presentation. The bridge contains no fallback writer or duplicate generator. Loading order and disable/re-enable do not require cached plugin references.

| Retained old full command ID | Replacement full command ID |
| --- | --- |
| `murmuration-writing-companion:generate-derived-artefact` | `murmuration-reports:generate-derived-artefact` |
| `murmuration-writing-companion:generate-all-derived-artefacts` | `murmuration-reports:generate-all-derived-artefacts` |

The aliases are deprecated and will be removed in the MWC release immediately following the first release containing this bridge. The latest published MWC release, 0.18.0, predates the bridge; the promised compatibility release has not shipped yet. Name the transition and removal version numbers in release notes once scheduled. Authors reassign hotkeys through Obsidian; neither plugin edits hotkey files. Existing saved charts/tables and embeds remain readable and compilable with both plugins disabled. No vault file moves, migrates or regenerates automatically.

Reports-only supports ordinary vaults. MWC-only aliases explain how to enable Reports. Both use the same serialised coordinator. Legacy SVGs need explicit adoption; changed receipts/assets and competing ownership are blocked. Exact legacy table markers remain recognised. Definition path is identity: moves require explicit former-path ownership repair, never automatic marker rewriting or orphan scans.

Reports 0.1.0 is published and validated at release commit `262f11630da4fd5848ce6e82013c9ad1a0b25b23`, including the manager, guided editing, previews and export qualification. This satisfies the Reports-before-MWC release ordering. This cleanup PR does not publish MWC or remove the promised transition aliases.

## Production measurements

Node 24.19.0, esbuild 0.23.1, committed lockfile and unchanged ES2018/minification policy. Baseline is the extraction revision; after includes the final bridge.

| Asset | Before raw / gzip bytes | After raw / gzip bytes |
| --- | ---: | ---: |
| JavaScript | 682,304 / 193,378 | 667,724 / 188,600 |
| CSS | 63,555 / 10,217 | 63,555 / 10,217 |
| Manifest | 277 / 185 | 277 / 185 |
| Installed total | 746,136 / 203,780 | 731,556 / 199,002 |

Genuine savings: **14,580 raw / 4,778 summed-gzip bytes**, with no CSS relocation. JavaScript headroom is **53,172 bytes** below the 720,896 ceiling; the result is **1,972 bytes below** the 669,696 warning threshold. This meets the bundle target for this tree, not the broader runtime acceptance of #252. Reports' own bundle is separate; installing both plugins is not a net reduction in combined assets.

Reproduce with `npm ci`, `npm test`, `npm run build`, `npm run bundle:report`, `npm run release:check`. Removed dataset modules have no contribution to the final MWC bundle. Synthetic live/export evidence belongs to the companion Reports PR.

## Completion audit and bridge cost

The inventory, fresh-main validation and experimental residual bridge measurement are recorded in [extraction completion](reporting-extraction-completion.md). Current MWC has no dataset implementation to remove again. Duplicate MWC schema instructions now link to Reports' versioned reference, and expanded bridge regressions protect the compatibility period. No settings cleanup, vault migration or asset deletion is introduced.
