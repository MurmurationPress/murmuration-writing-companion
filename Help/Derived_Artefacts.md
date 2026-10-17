# Dataset charts and state tables

Dataset reporting has moved to [Murmuration Reports v0.1.0](https://github.com/MurmurationPress/murmuration-reports/releases/tag/0.1.0). It works independently in ordinary Obsidian vaults. MWC contains no dataset parser, renderer, generation view, settings or fallback writer.

Install and enable Murmuration Reports, then use its **Open Reports** command or ribbon action to find, create, edit and preview reports by name. **Save definition** writes only the Markdown definition; **Save and generate**, **Generate** and **Generate all** explicitly request generation. Nothing generates when a file opens or the vault changes.

Report definitions retain `world_entity: derived-artefact` and the existing chart/table schemas. See the standalone [definition reference](https://github.com/MurmurationPress/murmuration-reports/blob/0.1.0/docs/definitions.md), [manager guide](https://github.com/MurmurationPress/murmuration-reports/blob/0.1.0/docs/manager.md) and [ownership/recovery policy](https://github.com/MurmurationPress/murmuration-reports/blob/0.1.0/docs/ownership.md).

## Existing installations and hotkeys

MWC **0.20.0 removes** the two deprecated dataset-generation command aliases, following the promised 0.19.0 transition release. In **Obsidian Settings → Hotkeys**, assign your old shortcuts to Reports' **Generate active report definition** and **Generate all report definitions**. Remove the obsolete MWC assignments manually if desired; neither plugin edits your hotkey file.

See [exact old/new command IDs and upgrade guidance](../docs/murmuration-reports-transition.md). MWC works without Reports; install Reports separately only if you need dataset generation. Existing files and settings are not migrated, deleted or regenerated.

## Saved assets remain portable

Existing definitions, output destinations, embeds, legacy ownership markers and user settings remain unchanged. Saved SVG and Markdown tables display and compile with both plugins disabled. For example:

```markdown
![[Reports/Outputs/Trend.svg]]
![[Reports/Outputs/State.md]]
```

Reports requires explicit validated adoption for unowned legacy SVGs and explicit ownership repair after definition moves. Changing a destination leaves the previous asset untouched. Do not use older MWC versions' original dataset commands to overwrite outputs now managed by Reports.

Manuscript scene numbering, open-annotation counts, Continuity Review and Entity Index remain in MWC; they require manuscript/editorial context and are not provided by the standalone dataset plugin.
