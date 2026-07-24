# Remove a Scene from the manuscript

**Remove from manuscript** is an explicit structural edit, not file deletion. It changes one authoritative Scene note to:

```yaml
type: scene-draft
```

All recognised Scene-type aliases, manuscript-parent aliases, order-key variants and any Book-reference property that actually resolves structural ownership are removed. Unrelated reporting properties, Scene metadata, `world_context`, prose, annotations and editorial history remain. The note is not moved.

`scene-draft` is a narrow inference veto. It is not a manuscript entry kind: scene-like metadata and legacy folder placement cannot return the note to projection or reconciliation. Unknown types retain their previous inference behaviour. Parentless `scene`, missing type, generic `note`, a second `manuscript_status` authority, hidden editorial records and automatic archive moves were rejected because they either remain inferable, create duplicate authority or change the note path.

## Safety and projection

The confirmation captures the selected Book, Scene identity, parent, distributed key, positions, neighbours, file version, full-source hash, relevant frontmatter and exact mutation. Confirmation rebuilds authority and rejects source, body, parent, key, Book or structural changes. Selection-revision changes alone are harmless when authority is unchanged. One in-flight operation is allowed per path.

Obsidian's `processFrontMatter` mutates only the selected note. The body is verified unchanged, but Obsidian may reserialize YAML layout, property ordering or comments. A failed verified mutation is rolled back only while the attempted file remains unchanged; later author edits are never overwritten. Metadata-cache delay preserves the successful detachment.

Surviving sibling notes and keys are never written. The selected Book remains selected and context falls forward to the next sibling, then backward to the previous sibling, then to the parent Part, then the Book. Chronology, Continuity Review and Writing Companion refresh for the owning Book. Disappearing findings become historical through existing disposition semantics and are not marked resolved.

When a detached note is active, Writing Companion retains note properties, World Context, editorial passes, notes and annotations, while labelling it outside the selected manuscript and suppressing Book ownership, manuscript continuity and manuscript-only authoring.

## Boundaries

Issue #149 handles files deleted or restored outside plugin workflows. It does not rewrite metadata, infer `scene-draft`, or purge editorial data. Detachment does not implement deletion, Trash, archive moves, bulk operations, Part/Book removal, orphan cleanup or reattachment UI.

Future reattachment must select a Book/Part and boundary, allocate a fresh key, then restore canonical `type: scene`, `parent` and `manuscript_order_key` and verify recognition. Manual restoration of those three properties is supported; the old parent and key are not retained anywhere.

## Real-vault verification

The FEVER smoke test completed successfully in Book 4 on 24 July 2026. The modal showed the exact actual aliases under **Changed**, the note path and authored/editorial material under **Preserved**, and stated that the file and prose would remain. Cancel produced no writes. Confirmation wrote canonical `type: scene-draft`, removed parent and order authority, and preserved the body, unrelated frontmatter, annotation, editorial note, path and filename.

Scene-like `story_date`, POV, status, editorial metadata and `world_context` did not override the explicit inference veto. Keeping the note in its legacy FEVER folder did not reattach it. It remained absent after restart, produced no reconciliation warning, and no file move or deletion occurred.

Recorded sibling keys and complete sibling-file hashes were unchanged. Book 4 remained selected, and disposable cases verified next-sibling, previous-sibling, parent-Part and owning-Book fallbacks without retaining the detached path as manuscript context. Writing Companion showed the restrained not-in-manuscript state while retaining note-centric and editorial sections. Chronology and Continuity Review refreshed from the surviving Scene sequence; disappearing observations were not marked resolved.

Finally, manually restoring canonical `type: scene`, a valid canonical `parent`, and a newly allocated canonical `manuscript_order_key` returned the disposable note to authoritative manuscript projection. No previous parent or key had been retained as hidden authority.
