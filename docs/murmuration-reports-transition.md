# Dataset reporting transition — MWC 0.20.0

Dataset charts and state tables moved to [Murmuration Reports 0.1.0](https://github.com/MurmurationPress/murmuration-reports/releases/tag/0.1.0). MWC 0.19.0 retained two deprecated command aliases for the promised one-release hotkey transition. **MWC 0.20.0 removes both aliases and their bridge.** MWC has no Reports dependency or fallback generator.

## Reassign existing hotkeys

Install and enable Reports if you need dataset generation. Open **Obsidian Settings → Hotkeys**, find the Reports replacement and assign your preferred shortcut. Resolve any conflict and manually remove obsolete MWC assignments if desired. No default replacement shortcut is assigned; neither plugin edits `.obsidian/hotkeys.json`.

| Removed MWC label / full command ID | Reports replacement label / full command ID |
| --- | --- |
| Generate derived artefact — `murmuration-writing-companion:generate-derived-artefact` | Generate active report definition — `murmuration-reports:generate-derived-artefact` |
| Generate all derived artefacts — `murmuration-writing-companion:generate-all-derived-artefacts` | Generate all report definitions — `murmuration-reports:generate-all-derived-artefacts` |

Reports' **Open Reports** manager also creates, edits and previews definitions, with explicit generation. Reports 0.1.0 is desktop-only and requires Obsidian 1.13.7; installing it does not change MWC's declared 1.5.0 minimum or make it a prerequisite for writing.

## What remains unchanged

Manuscript numbering, open-annotation counts, the Annotation Board, entity indexes, continuity and other manuscript-aware reports remain in MWC. Existing report definitions, SVGs, Markdown tables, embeds, destinations, ownership receipts and backups remain untouched. Saved outputs remain displayable and compilable with both plugins disabled. No file moves, migrations, generation or hotkey rewrites run on upgrade.

Reports owns discovery, rendering, explicit adoption, ownership repair and writes. Legacy SVGs require validated consent; definition moves require explicit former-path repair. Do not use older MWC dataset writers on Reports-managed assets. See Reports' [manager](https://github.com/MurmurationPress/murmuration-reports/blob/0.1.0/docs/manager.md), [definitions](https://github.com/MurmurationPress/murmuration-reports/blob/0.1.0/docs/definitions.md) and [ownership policy](https://github.com/MurmurationPress/murmuration-reports/blob/0.1.0/docs/ownership.md).

The [0.19.0 extraction inventory](reporting-extraction-completion.md) is historical evidence of the retained bridge; it does not describe current command availability.
