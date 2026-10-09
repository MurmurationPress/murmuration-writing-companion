# Getting Started

MWC works with ordinary Markdown notes in an Obsidian vault. Your manuscript and Story World remain readable without the plugin. MWC adds navigation, guided editing, review, and derived views around those notes.

## Begin a manuscript

Open **Project readiness** first. It is read-only and explains what MWC recognises.

- For an empty vault, open **Manuscript**, create a Book, then add optional Parts and Scenes.
- For an existing manuscript, run **Prepare existing manuscript** and select its existing root note or folder. Untyped manuscripts need no manual property edits. Review roles, parents, reading order and included notes, then approve the exact metadata preview.
- If readiness reports ambiguity, correct the named note or property. MWC will not guess a hierarchy.

When preparing an existing manuscript, subfolders within the selected manuscript folder are automatically picked up as proposed Parts through their companion notes. Put the Scenes for each intended Part in that Part's folder, then check the proposed roles and parents in the preview. Keeping all chapters together in one folder does not provide separate Parts for MWC to infer. A Book without Parts can contain direct Scenes.

Keep images and other assets in vault-root `Assets/`, alongside the Book note and its manuscript folder. **Prepare existing manuscript** reviews relocation and Markdown link changes for a nested imported Assets folder before approval.

A Book contains Parts and/or direct Scenes. A Part contains Scenes. In normal use, create and reorder them through Manuscript Navigator. `parent` establishes containment and `manuscript_order_key` orders siblings; folders and filename prefixes remain useful organisation but are not final prepared-manuscript authority.

## Write a Scene

Open a Scene and use the Writing Companion. **Chapter Context** gives you the practical fields most often needed while drafting: title, POV, Location, story date, chapter status, pass reached, and change summary. **World Context** shows the Story World entities connected to the Scene.

Your prose and frontmatter remain authoritative Markdown. Chapter notes, annotations, review dispositions, and interface preferences are editorial information stored separately by MWC.

## Add a Story World when useful

Story World is optional. It can contain Characters, Locations, Organisations, Technologies, Events, References, and custom kinds. A note joins the entity index only when it has a non-empty scalar `world_entity` property. A folder, tag, filename, ordinary `type`, prose mention, or backlink does not opt it in.

Use Story World Navigator to browse or create entities. MWC can also offer explicit creation from an unresolved prose wikilink. Keeping a prose link alone does not create an entity or declare canon.

## Authority and derived information

Authoritative information lives in manuscript and Story World Markdown. Navigator projections, World Context cards, graphs, timelines, continuity findings, and generated reports are rebuildable views. Generated reports never become Story World authority merely because they are Markdown.

See [Writing with MWC](Writing_with_MWC.md) next. For existing manuscripts and recovery, see [Backup, Preparation, and Recovery](Backup_Preparation_and_Recovery.md).
