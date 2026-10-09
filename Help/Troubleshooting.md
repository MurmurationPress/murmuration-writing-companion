# Troubleshooting

## MWC does not recognise my Book or entity

For an existing untyped manuscript, run **Prepare existing manuscript** and explicitly select its root note or folder. Review inclusion, roles, parents and reading order before approval. Preparation adds the structural properties; manual tagging is not required. After preparation a Book has `type: book`. A Story World entity needs a non-empty scalar `world_entity`; tags, ordinary `type`, folders, backlinks, and prose do not opt in.

## A Story World link does not appear in World Context

Confirm the wikilink resolves to a note with a scalar `world_entity`. A Scene Location contributes only when `location` resolves to an indexed Location. Free text, unresolved links, and links to another entity kind are preserved but do not create semantic Location context.

## A link is ambiguous

Use a path-qualified wikilink. Aliases work only when resolution is unambiguous. MWC deduplicates by resolved path, not by visible label.

## YAML is malformed

Inspect the frontmatter between the opening and closing `---` in Source mode. Check indentation, unfinished lists/mappings, and conflict markers. Preserve unrelated properties while correcting only the reported structure.

## Preparation or Undo is blocked

If a note has not been indexed or its indexed frontmatter differs from disk, wait for Obsidian indexing to finish and reopen preparation. File-specific conflicts must be resolved before approval. Select one companion note when a folder has both a sibling and inside companion.

Generate a fresh preview if files changed after analysis. Undo intentionally refuses to replace later edits. Compare against a backup, preserve new prose, and follow the named stale-file diagnostic.

## A date is displayed but not compared

An unsupported `world_time` mapping can be preserved and displayed without being reliable chronology evidence. Prefer the canonical `at` or `from`/`until` forms with a supported precision and no extra mapping keys.

## A legacy Reference field is ignored

Use `reference_publication` and `reference_link`. `reference_journal`, `published_in`, and `reference_url` are unsupported near-aliases.

For maintainer-level compatibility details, see the [Developer and Legacy Appendix](Developer_and_Legacy_Appendix.md).

### Assets during preparation

Assets are expected, but belong in vault-root `Assets/`, outside the manuscript folder. A nested Assets folder may be interpreted as a Part by Codex Press. Preparation previews a move to the root and resolved Markdown link updates. If root `Assets/` already exists, preparation blocks rather than overwriting or merging it. Merge separately and update links before retrying. Frontmatter asset references, affected Canvas references and Markdown notes inside Assets need separate handling before automatic relocation. Cancel changes nothing; immediate Undo restores the approved folder move and links.
