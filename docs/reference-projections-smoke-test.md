# Reference citation and projection smoke test

Use a disposable research-style vault and the current supported Obsidian release. Preserve a read-only baseline and record candidate plugin hashes before enabling it.

For each case record the exact input, preview, resulting properties, changed paths, before/after SHA-256 values, screenshot and Pass/Partial/Blocked/Failed result.

1. Create one Reference by entering fields manually.
2. Create one from the documented Banks citation.
3. Parse a bare DOI, DOI URL, incomplete citation and ambiguous citation.
4. Start with populated fields and verify every conflict requires keep, parsed or edited.
5. Cancel the parse preview; verify the form and vault are unchanged.
6. Edit a proposed value, apply it to the form, preview the exact note, then confirm creation.
7. Verify canonical `reference_*` Markdown and no unrelated frontmatter or prose changes.
8. Link the Reference from a Scene and add that Scene to `world_sources`.
9. Verify vault scope includes it, its Book scope includes it and an unrelated Book excludes it.
10. Open both views in `References.base`, then open the Dataview support note in rendered mode.
11. Confirm the Dataview support note remains outside both Story World and Manuscript authority.
12. Restart Obsidian and rebuild indexes; verify Navigator, Inspector, graph and provenance still use the Reference note.
13. Verify neither projection becomes manuscript or Story World authority and parsing/projection creates no editorial store.

PDF, EPUB and DOCX validation is outside #162. Static Markdown note transclusion belongs to [Codex Press #97](https://github.com/MurmurationPress/codex-press/issues/97), and embedded Bases and Dataview publication rendering belongs to [Codex Press #98](https://github.com/MurmurationPress/codex-press/issues/98). MWC #164 is closed as superseded by Codex Press #98.

Cancellation is required to be write-free at the import preview and the unsaved Reference creation form. The creation preview remains in that form; only the explicit **Create** action writes the note.
