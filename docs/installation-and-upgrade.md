# Install and upgrade MWC 0.20.0

## Clean installation

Use the stable GitHub release **0.20.0** after publication (tag has no `v` prefix). Download `main.js`, `manifest.json` and `styles.css` from that same release. Verify the adjacent `SHA256SUMS` with `sha256sum -c SHA256SUMS` or equivalent. In a disposable vault first, create `.obsidian/plugins/murmuration-writing-companion/`, copy the three assets there and enable **Murmuration Writing Companion** in Community plugins. The repository ZIP is source, not a built plugin installation.

Obsidian 1.5.0 remains the declared minimum. Actual tested host/platform versions and limitations are in [release readiness](release-readiness-0.20.0.md). Reports is optional, desktop-only, and has its own 1.13.7 minimum.

## Upgrade from published 0.19.0

1. Back up the entire vault, including `.murmuration/writing-companion/editorial-data.json`, its recovery files, and `.obsidian/plugins/murmuration-writing-companion/data.json`. Local UI preferences may be installation-specific; the editorial store travels with the vault.
2. If you use dataset generation, enable Reports and reassign the two shortcuts in **Settings → Hotkeys** using [the exact mapping](murmuration-reports-transition.md). MWC 0.20.0 removes its old aliases. No hotkey file is modified automatically.
3. Disable MWC; replace `main.js`, `manifest.json` and `styles.css` together with the verified 0.20.0 assets. Keep existing `data.json`, manuscript files and the portable store. Enable MWC or restart Obsidian.
4. Check existing Chapter Notes and annotations, open **Annotation Board**, choose the intended Book, and follow an extract in Reading view. Check **Notify when filename differs from title**; it defaults on unless you have already changed the vault-local preference.

The release adds no automatic manuscript/store migration. Existing legacy recovery/migration behaviour still applies when a portable store is missing; do not delete it to upgrade. Browsing should not rewrite manuscript prose, formatting, unrelated frontmatter, generated reports or existing editorial records. Explicit annotation changes update the portable store and established `mwc_open_annotations` count only. Existing source evidence is retained, not recreated by a release-wide rewrite.

## Reports absent or disabled

MWC annotation, manuscript and Story World workflows remain available. Dataset generation commands belong to Reports and are absent until it is enabled. Existing generated SVGs, tables and embeds need neither plugin to display. Upgrade does not move, delete or regenerate definitions, assets, receipts or backups. Do not run older MWC dataset writers over Reports-managed outputs.

## Recovery

If qualification fails, disable MWC, preserve a copy of the failing state and restore the backed-up assets/settings/store together. Do not overwrite newer editorial work with an old backup without reviewing it. Store recovery and unsupported-schema protection remain unchanged; see [backup and recovery](../Help/Backup_Preparation_and_Recovery.md). Report the installed version, platform, exact symptoms and synthetic reproduction without sharing private manuscript text.
