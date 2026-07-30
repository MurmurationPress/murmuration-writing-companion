# Story World Reference PRIME smoke test

Use a disposable copy of a real vault. Record the starting hashes of manuscript Markdown and `.murmuration/writing-companion/editorial-data.json`, and disable unrelated synchronisation while testing.

1. Open **Create Story World entity**, choose **Reference**, enter only `Reference smoke minimal`, inspect the exact `Story World/References/Reference smoke minimal.md` preview, create it, and confirm it opens in the centre editor.
2. Create `Companion cognition and personal AI` with category `research-note`, title of the same name, journal `Journal of Example Studies`, authors `Hawkins, Edward` then `Vale, Ada`, date `2026`, key `hawkins-2026-companion`, and link `https://example.org/source`. Confirm authored order and that creation writes `link`, never `reference_url`.
3. Confirm both notes are under **References**. Search separately by canonical name, title, journal, each author, key and link. Confirm raw URLs do not appear in navigator rows. Test keyboard selection, active-note following and a narrow navigator pane.
4. Inspect both notes. Confirm missing fields disappear cleanly; the fuller note shows Journal, Published in, Publisher and Link with author-facing labels and ordered authors. Click Link and confirm an explicit external browser link opens without metadata appearing in the note.
5. Temporarily replace `link` with legacy `reference_url`; confirm the inspector still presents it as Link and no rewrite occurs. Add a different canonical `link`; confirm canonical Link wins and Story World Review reports the conflict. Restore canonical metadata.
6. Rename the fuller note, add an alias and `world_scope: ["[[A test Book]]"]`, and confirm index, navigator, inspector, wikilink resolution, scope filtering and generic graph node refresh. Confirm no link/DOI/ISBN graph edge appears.
7. Give the minimal note the same non-empty `reference_key`; run **Story World Review** and confirm one duplicate-key observation. Restore a unique key.
8. Change `reference_authors` to a scalar; confirm one malformed-property observation and that Markdown is not repaired. Restore the ordered list. Confirm absent title, authors, date, DOI, ISBN, link and publisher never produce completeness findings.
9. Move the minimal note to Obsidian local Trash. Confirm it leaves navigator, index, inspector selection, graph and review. Restore it to the original path and confirm it returns.
10. Re-run Story World Review and inspect graph shape/density, event chronology, relationships, POV selection and custom Other entities for regressions.
11. Compare final hashes/diffs: manuscript files and editorial data must be unchanged. Inspect network activity/logging and confirm no remote metadata lookup occurred.

Inline citations, manuscript association, reference reports, bibliography formatting and compiler output are not part of this smoke test because they are deferred to a later #162 batch.
