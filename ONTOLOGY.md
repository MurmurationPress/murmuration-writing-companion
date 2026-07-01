# Ontology

The Writing Companion uses the language of authors.

The same terms should appear in the interface, documentation, GitHub issues and source code.

## Core Concepts

### Manuscript

The complete written work.

A manuscript may contain books, parts, chapters and supporting material.

### Book

A major published unit of a manuscript.

### Part

A structural division within a book.

### Chapter

The primary unit of writing and editing.

In Obsidian, a chapter may be represented by a Markdown file, but the product should refer to it as a chapter.

### Chapter Note

A note about the chapter as a whole.

Used for intent, concerns, reminders, structure, continuity or editorial thoughts that apply to the chapter rather than a specific passage.

### Annotation

A note attached to selected text.

Used to capture editorial intent exactly where it arises without modifying the manuscript.

### Annotation Anchor

The selected text that an annotation refers to.

### Editorial Pass

A focused stage of review, such as Draft, Structure, Character, Dialogue, Canon, Style or Proof.

### Checklist

A short, opinionated set of prompts that helps the author complete an editorial pass.

### Writing Session

A period of work on the manuscript.

### Companion

The user-facing assistant panel that helps the author understand chapter progress, notes, annotations and next actions.

## Vocabulary Rules

Use author language unless implementation language is unavoidable.

Prefer:

- Chapter
- Chapter Note
- Annotation
- Editorial Pass
- Checklist
- Manuscript
- Writing Session

Avoid:

- File
- Document
- Page
- Record
- Entity
- Payload
- Selection Note

Implementation-specific terms may appear only at system boundaries, such as Obsidian API calls, filesystem access or build tooling.

## Principle

A chapter is a chapter everywhere.
