# Editorial Review Workflow

**Status:** 0.15 foundation  
**Issues:** #70, #71, #72, #74, #75, #77

## Purpose

The Writing Companion separates three editorial concepts that previously overlapped:

1. **Book review mode** records what kind of review the author is performing now.
2. **Book review status** records where that book-wide review activity stands.
3. **Scene progress frontier** records the furthest editorial pass reached by an individual scene.

This keeps review intent at book level while retaining portable scene-level reporting.

## Owning book

MWC resolves the book that owns the active scene from explicit manuscript hierarchy metadata. It recognises book references such as `book`, `manuscript_book`, `owning_book` and `parent_book`, and follows parent references such as `parent`, `part_of`, `manuscript_parent` and `up`.

A book note may identify itself through `type`, `kind`, `manuscript_type`, `document_type` or `note_type` with a value such as `book`, `novel` or `manuscript_book`.

The hierarchy remains ordinary Markdown metadata. MWC does not copy it into editorial storage.

## Book review mode

The current review mode uses the fixed ordered vocabulary:

- Draft
- Structure
- Character
- Dialogue
- Continuity
- Style
- Proof

It is stored once in portable editorial workflow state for the owning book. It is not copied into each scene and it is not Story World canon.

## Book review status

The book note stores the author-controlled property:

```yaml
review_status: in_progress
```

Canonical values are:

- `not_started`
- `in_progress`
- `complete`

MWC also recognises existing aliases `book_review_status` and `editorial_review_status`. Unknown existing values remain visible until the author deliberately changes them.

Review status is not inferred automatically from scene completion.

## Scene editorial progress

Each scene has one ordered editorial progress frontier. Selecting Continuity means Draft through Continuity are presented as reached. Earlier passes are inferred rather than recorded as separate completion events.

The portable editorial store retains explicit timestamped completion and reopening history. Moving the frontier backwards changes the current presentation without deleting earlier history.

## Markdown projection

The current scene frontier is projected into the existing chapter property:

```yaml
editorial_pass: continuity
```

The editorial store remains authoritative for the rich history. Markdown contains the compact reporting projection used by Obsidian Bases, Dataview and publishing tools.

If an external edit makes `editorial_pass` disagree with managed history, MWC reports the mismatch and provides an explicit repair action. Merely opening a scene never silently repairs frontmatter.

`chapter_status` remains a separate lifecycle field and is never changed by editorial progress.

## POV property

POV remains authoritative chapter metadata. Its resting presentation is a compact Obsidian-style property row. Editing opens an inline character field populated from the rebuildable Story World index.

Recognised character names and aliases may be selected and written as ordinary wikilinks. Free text and unresolved wikilinks remain valid. Opening or dismissing the suggestion control does not write frontmatter.

Creating a missing Story World character is intentionally excluded from this workflow and remains a separate Story World Authoring capability.
