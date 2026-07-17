# Reusable manuscript Base reporting

Prepared manuscripts expose one stable reporting contract:

- every book has `type: book` and a flat `manuscript_order` list;
- every part has `type: part` and a path-qualified `parent` link to its book;
- every scene has `type: scene` and a path-qualified `parent` link to its part or book;
- sequence is derived from the owning book's `manuscript_order`, never copied into each scene.

This lets one Base work across every prepared manuscript without embedding a book path.

## General ancestry and sequence formulas

```yaml
formulas:
  parent_file: 'if(parent, file(parent))'

  grandparent_file: >
    if(
      formula.parent_file,
      if(
        formula.parent_file.properties["parent"],
        file(formula.parent_file.properties["parent"])
      )
    )

  manuscript_book: >
    if(
      type == "book",
      file,
      if(
        formula.parent_file && formula.parent_file.properties["type"] == "book",
        formula.parent_file,
        formula.grandparent_file
      )
    )

  manuscript_book_path: >
    if(formula.manuscript_book, formula.manuscript_book.path)

  manuscript_position: >
    if(
      formula.manuscript_book,
      list(
        formula.manuscript_book.properties["manuscript_order"]
      ).reduce(
        if(file(value).path == file.path, index + 1, acc),
        9999
      ),
      9999
    )
```

Add `formula.manuscript_position` as the first ascending sort. Parts and scenes then follow the same order as the Manuscript navigator and Codex Press. A value of `9999` deliberately places an unresolved or unlisted note at the end for review rather than hiding it.

## Example editorial view

```yaml
filters:
  or:
    - 'type == "part"'
    - 'type == "scene"'

formulas:
  parent_file: 'if(parent, file(parent))'
  grandparent_file: 'if(formula.parent_file && formula.parent_file.properties["parent"], file(formula.parent_file.properties["parent"]))'
  manuscript_book: 'if(formula.parent_file && formula.parent_file.properties["type"] == "book", formula.parent_file, formula.grandparent_file)'
  manuscript_position: 'if(formula.manuscript_book, list(formula.manuscript_book.properties["manuscript_order"]).reduce(if(file(value).path == file.path, index + 1, acc), 9999), 9999)'

properties:
  formula.manuscript_position:
    displayName: Sequence
  title:
    displayName: Title
  pov:
    displayName: POV
  story_date:
    displayName: Story date
  chapter_status:
    displayName: Status
  editorial_pass:
    displayName: Pass

views:
  - type: table
    name: Editorial review
    order:
      - formula.manuscript_position
      - title
      - pov
      - story_date
      - chapter_status
      - editorial_pass
```

Use the Base interface's Sort control to sort `Sequence` from smallest to largest. View `order` controls visible columns; the sort itself is view state.

## Authority rule

Do not add a stored `manuscript_position` property to parts or scenes. It would duplicate the book's authoritative list and could drift after reordering. The formula is a derived reporting value only.
