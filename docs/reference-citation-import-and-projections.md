# Reference citation import and projections

Reference notes are authoritative Story World Markdown. Murmuration Writing Companion does not create a bibliography database, generated citation identity or editorial-storage copy.

## Citation import

Choose **Create Story World entity**, select **Reference**, then use **Citation or DOI import**. Paste a common formatted citation, a bare DOI, `doi:10.…`, or a `doi.org` URL and select **Parse citation**.

Parsing is local and deterministic. It does not make a network request and does not write a note. The preview shows recognised fields, warnings and any unparsed remainder. Every proposed value is editable. Select **Apply to Reference form** to transfer the proposal into the still-unsaved creation form. An untouched canonical name defaults to the Reference title; an explicitly supplied or edited canonical name is preserved.

Existing populated fields are never silently replaced. Every differing field requires one explicit choice:

- keep the existing value;
- use the parsed value;
- use an edited value.

Cancelling the import preview leaves the parent form unchanged. Cancelling the creation form or final creation confirmation leaves the vault unchanged. The existing exact-note preview, collision checks and stale-input checks remain the only route to a write.

The first parser recognises common author–date citations, publication, volume/issue/pages and DOI data. It preserves title and publication capitalization and punctuation where classification is safe. Incomplete or ambiguous components remain visibly unparsed; the parser does not invent absent metadata. A narrow compatibility rule repairs `10.<registrant>_<suffix>` to the required slash form because the SAGE citation widget emits that malformed separator; the preview warns when this repair occurs. Other malformed DOI input remains blocked. RIS and BibTeX are deferred. Crossref or other DOI metadata lookup is also deferred: this version makes no external request and supports DOI extraction locally.

## Canonical projection

The native Base and Dataview query read the properties in the [Story World Entity Standard](story-world-entity-standard.md). Vault scope selects notes explicitly carrying `world_entity: Reference`; aliases remain Obsidian links to the same authoritative note and do not create another record. There is no generated report, projection service or persisted usage field.

The shipped native selected-Book examples accept the explicit evidence that Bases and Dataview can query reliably:

- a Reference wikilink in an authoritative Book, Part or Scene;
- the Reference's `world_sources` link to that Book, Part or Scene.

Each selected view contains an exact snapshot of the selected Book's resolved Book, Part and Scene paths. An incoming link counts only when its source is in that path set, so an arbitrary backlink does not establish ownership. MWC's runtime manuscript-impact contract can also understand other explicit associations, including `world_context`, but native Bases and Dataview cannot call that resolver or safely project every association without duplicated state. The examples therefore do not claim full dynamic parity. They do not search prose, use fuzzy names, infer from filenames, or persist `used_in_books` metadata.

Rows sort by author, then authored publication date/year, then title, then canonical path. Multiple authors retain authored order and compare by their joined display. Invisible sort formulas put missing authors and dates after populated values while visible cells stay blank. The path is the deterministic tie-breaker for otherwise identical rows.

## Obsidian Bases

The prepared example vault includes [References.base](../examples/v2-onboarding/prepared-vault/Story%20World/References/References.base) with **All References** and **References used by The Greywater Signal** table views. The selected view enumerates that Book's authoritative Book, Part and Scene paths and accepts only a resolved incoming link or `world_sources` link to one of them.

An Obsidian Base has no runtime Book selector and cannot call MWC's manuscript ownership resolver. Copy the selected view and replace its explicit path set when selecting another Book; refresh it when Book membership changes. Native Bases cannot express the full dynamic selected-Book contract without this explicit snapshot. Folder proximity, fuzzy names and prose are not substitutes. Opening, sorting and filtering the Base are read-only.

## Product boundary

MWC owns canonical Reference authoring and native, read-only in-Obsidian Bases and Dataview projections. It does not generate replacement report notes or implement publication rendering. Codex Press owns publication-time resolution and rendering:

- [MurmurationPress/codex-press#97](https://github.com/MurmurationPress/codex-press/issues/97) covers static Markdown note transclusion;
- [MurmurationPress/codex-press#98](https://github.com/MurmurationPress/codex-press/issues/98) covers embedded Bases and Dataview rendering, visible fields, filtering, sorting and publication diagnostics.

MWC #164 is closed as superseded by Codex Press #98. Bases and Dataview are not a PDF, EPUB or DOCX publication workflow in MWC; MWC performs no publication compilation or rendering for these projections.

## Dataview

The prepared [`References Dataview.md`](../examples/v2-onboarding/prepared-vault/Reference%20Projections/References%20Dataview.md) support note contains both vault-wide and selected-Book queries for review inside Obsidian. It lives outside Story World and Manuscript authority. The selected query uses a static list of authoritative Book/Part/Scene paths because plain Dataview cannot call MWC's ownership resolver.

The canonical vault-wide query is:

```dataview
TABLE WITHOUT ID
  file.link AS Title,
  join(reference_authors, "; ") AS Author,
  reference_date AS Year,
  reference_publication AS "Journal / Publication",
  reference_volume AS Volume,
  reference_issue AS Issue,
  reference_pages AS Pages,
  choice(reference_doi, "https://doi.org/" + reference_doi, reference_link) AS "DOI / Link",
  join(world_sources, "; ") AS "Used in"
FROM "Story World"
WHERE lower(string(world_entity)) = "reference"
SORT choice(reference_authors, lower(join(reference_authors, "; ")), "￿") ASC, choice(reference_date, string(reference_date), "￿") ASC, lower(default(reference_title, default(world_name, file.name))) ASC, file.path ASC
```

Plain Dataview cannot reuse MWC's arbitrary manuscript ownership graph or evidence classifier. Copy and refresh the explicit authoritative path snapshot for another Book, and refresh it whenever manuscript membership changes. Do not present a folder, filename, backlink-only or prose approximation as Book truth. No `used_in_books` or other maintained derived metadata is introduced. Query output is read-only and is not Story World authority. Publication-time rendering belongs to Codex Press #97 and #98; MWC #164 is closed as superseded by Codex Press #98.
