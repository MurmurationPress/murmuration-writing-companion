# Murmuration Writing Companion 0.20.0

An editorial release for working through annotations without leaving the manuscript's Reading view, and seeing the remaining work across a whole Book.

## Annotations where you read

Select ordinary prose in native Obsidian Reading view and choose **Annotate**, its Command Palette command or your assigned shortcut. The annotation body receives focus; saving, cancelling, reviewing, editing and resolving keep the manuscript in Reading view. The annotation stays attached to its originating note when focus changes. Repeated passages, supported inline formatting and paragraph-spanning selections map to their exact source occurrence; changed or unsupported selections are rejected with guidance instead of being attached to the wrong text (#272).

Reading navigation also handles native prose blocks cached across frontmatter-only annotation-count updates. Exact source evidence also supports editorial PDF export and the shared export-anchor contract (#271). Existing records remain usable; no inline markers or automatic store migration are introduced. Ambiguous stale navigation clearly explains when it uses the original body position rather than guessing an occurrence. Complex rendered content such as embeds, tables, mathematics and HTML may require an ordinary-prose selection or edit mode; see [Reading-view guidance](Help/Writing_with_MWC.md#annotating-in-reading-view).

## Review a Book's remaining work

**Open Annotation Board** from a Book, Part or Scene, or choose a Book when context is unavailable. Cards group by category and follow manuscript/anchor order. Filter by Part, chapter or category; edit, resolve, reopen and show resolved work. Drag cards between categories or use the accessible category selector. Extract navigation reuses the exact-occurrence safeguards and preserves Reading/edit mode. The Board uses the existing portable store, not separate notes or a Kanban dependency (#273).

## Quieter filename/title checks

**Notify when filename differs from title** in MWC settings is enabled by default. Turn it off to suppress mismatch indicators for this vault on this installation; the preference survives restart. It never renames files, synchronises titles or changes preparation/export. Other notifications remain active (#272).

## Action required: dataset-report hotkeys

As announced in 0.19.0, **0.20.0 removes both deprecated MWC dataset-generation aliases**. For dataset charts and state tables, install and enable [Murmuration Reports 0.1.0](https://github.com/MurmurationPress/murmuration-reports/releases/tag/0.1.0), then rebind shortcuts in **Obsidian Settings → Hotkeys**:

| Removed MWC command | Reports replacement |
| --- | --- |
| Generate derived artefact (`murmuration-writing-companion:generate-derived-artefact`) | Generate active report definition (`murmuration-reports:generate-derived-artefact`) |
| Generate all derived artefacts (`murmuration-writing-companion:generate-all-derived-artefacts`) | Generate all report definitions (`murmuration-reports:generate-all-derived-artefacts`) |

Neither plugin edits your hotkey file. Existing definitions, generated SVG/Markdown, embeds and ownership files remain untouched and displayable without either plugin. MWC works independently without Reports; manuscript-aware reporting remains in MWC. Reports is desktop-only and requires Obsidian 1.13.7. See [migration details](docs/murmuration-reports-transition.md).

## Install or upgrade

Back up the vault, including `.murmuration/writing-companion/` and plugin settings. With MWC disabled, replace **all three** release assets (`main.js`, `manifest.json`, `styles.css`) together in `.obsidian/plugins/murmuration-writing-companion/`, then enable it. Do not delete `data.json` or the editorial store. Check the supplied `SHA256SUMS` when downloading manually. See [clean installation, upgrade and recovery](docs/installation-and-upgrade.md).

## Qualification and known limitations

Ted has locally accepted the annotation features and Board. [Release qualification](docs/release-readiness-0.20.0.md) separates release-specific automated/native checks from reviewed feature evidence and untested platforms. Native Windows/macOS/mobile, older Obsidian versions, assistive technology and physical multi-window/IME coverage are not established by CI. The declared minimum remains 1.5.0; no support expansion is claimed. Board offscreen drag edge-scrolling is unavailable; scroll horizontally or use the category selector.

The JavaScript budget warning remains active. Sustainable 50 KiB headroom and broader large-vault startup/layout work remain open under #252; this release does not complete that maintenance issue. #241 remains backlog. No new feature is included beyond the audited annotation work and promised Reports alias removal. Obsidian still provides no crash-atomic multi-file transaction guarantee.
