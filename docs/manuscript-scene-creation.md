# Manuscript Scene creation

The Manuscript navigator creates one ordinary authoritative Scene note beneath the explicitly selected Book or one of its recognised Parts. Active-note navigation never chooses manuscript scope or structural parent.

## Contract

Without an accepted date:

```yaml
---
type: scene
title: "Author-supplied title"
parent: "[[full/vault-relative/parent/path]]"
manuscript_order_key: "GENERATEDKEY"
---
```

After explicit acceptance of a supported preceding date, the same note additionally contains canonical `story_date`:

```yaml
story_date: 2033-04-12
```

There is no heading or body, legacy `manuscript_order`, inferred POV, status, location, `world_context`, prose, editorial data, Story World data, compiler data or publishing data.

## Scope, parent and placement

`ManuscriptBookSelectionService.bookPath` is the only selected-Book authority. A recognised Part at `contextPath` becomes the default parent; otherwise the selected Book does. The modal may switch to the Book or another recognised Part within the same Book without changing Book scope.

Direct Book children share one structural key space, so Book placement includes both Parts and direct Scenes. A Part may contain direct Scenes only. Every unique boundary is offered once, and the existing `manuscriptOrderKeyBetween` allocator supplies the new key without changing sibling notes. Legacy, mixed, malformed, duplicate-key, unsafe and exhausted structures block.

Filesystem location is organisational only. The full vault-relative `parent` wikilink establishes containment, and `manuscript_order_key` establishes order.

## Optional preceding date

The reusable pure resolver examines the new Scene's hypothetical position in the authoritative Book-wide Scene sequence and walks backward to the nearest supported explicit date. It recognises `story_date`, `storydate` and `narrative_date`, but never `story_day`. Missing, malformed, unsupported and range-shaped values are ignored.

The offer starts unchecked and identifies its source Scene. Only explicit acceptance writes the validated canonical point value. The created `story_date` is independent frontmatter: no source path or dependency is stored, and later source changes do not cascade.

## Confirmation and execution

Confirmation recaptures Book and parent authority, the specific adjacent boundary, canonical keys, hypothetical global position, collisions, folders and any accepted date source/value. An unrelated safe change away from the boundary and date source does not invalidate the plan. A changed boundary or accepted date never gets silently replaced.

Only previewed missing folders may be created. The executor then creates one exact Scene note, verifies its bytes and polls bounded metadata recognition. Recognition verifies Scene kind, parent, key, sibling position, global Scene position and accepted-date presence. Existing Book, Part and Scene notes remain byte-identical.

Verified success retains `bookPath`, sets the Scene as transient `contextPath`, refreshes and reveals it, and opens it natively. The existing active-file lifecycle updates Writing Companion, chronology and Continuity Review.

If bytes verify but recognition is delayed or structurally inconsistent, the Scene is preserved and an Open note action is offered. Unverified structure never changes `contextPath`. Cleanup is limited to an immediate read-back mismatch on the provably new, unchanged file.

## Real-vault verification

The completed FEVER smoke test passed in the real vault on 23 July 2026. It created one Scene beneath the FEVER Part and one Scene directly beneath Book 4. Both notes used the previewed full vault-relative parent wikilink and canonical distributed key. The direct-Book run correctly placed the Scene in Book 4's mixed Part/Scene child order, while the Part run used FEVER's direct-Scene order. No existing sibling was re-keyed or rewritten; byte-for-byte comparisons confirmed every sibling remained unchanged.

The optional preceding-date proposal started unchecked. Its Book-wide lookup crossed a Part boundary to find the nearest preceding Scene date, ignored `story_day`, and wrote `story_date` only after explicit acceptance. The accepted value became independent frontmatter with no source dependency. Changing a chosen boundary, or changing or moving the accepted date source, made the preview stale and blocked creation without silently selecting a replacement.

After recognition, Book 4 remained `bookPath` and Continuity Review scope while the created Scene became `contextPath`, was revealed and opened, and Writing Companion followed it through the ordinary active-file lifecycle. The created notes contained no inferred POV, status, location, `world_context`, prose, editorial data or Story World data.

## Boundaries

Issue #65 remains responsible for offering the same reusable resolver when editing an existing undated Scene. Issue #143 remains responsible for detaching a Scene without deleting its note. Scene creation does not generate prose or creative metadata, move or detach Scenes, rebalance keys, manage templates, or configure Story World, compiler or publishing data.
