# POV Story World character creation smoke test

Use a backed-up vault and two disposable or genuinely new POV names.

## Existing-character boundary

1. Open a chapter whose POV already resolves to a recognised Story World character.
2. Expand **Chapter Context**.
3. Confirm that the POV remains an ordinary compact wikilink and no creation offer appears.
4. Edit the POV and type an existing canonical name or alias.
5. Confirm that the existing character is selected and no duplicate note is proposed.

## Unmatched free-text POV

1. Enter a new POV value such as `Robin Vale` and commit it.
2. Confirm that the chapter immediately retains `Robin Vale` as a valid POV.
3. Confirm that a quiet offer appears beneath the POV field:
   - **Create character**
   - **Use without creating**
4. Choose **Use without creating** and confirm that no file or other property changes.
5. Enter a second new POV value, such as `Alex Vale`, for the creation test below.

## Creation preview

1. Choose **Create character**.
2. Confirm that the preview shows:
   - canonical name;
   - proposed Markdown path;
   - book scope when an owning book is known.
3. Press **Cancel** and confirm that neither the chapter nor Story World changes.
4. Open the preview again and choose **Create character**.

## Successful creation

Confirm that:

- one ordinary Markdown note is created at the previewed path;
- the note contains `world_entity: character`, `world_name`, appropriate `world_scope`, and an editable prose placeholder;
- the chapter POV changes to a wikilink to that note;
- the new note becomes discoverable by the Story World index and POV suggestions;
- the Writing Companion remains focused on Chapter Context rather than opening a separate authoring workflow;
- no Story World fact is written to editorial storage.

## Path and duplicate safety

- Existing scoped character notes should cause the proposal to use their common folder.
- An explicitly typed unresolved path such as `[[Story World/People/RV|Robin Vale]]` should be previewed at that path when it is free.
- An existing file at the proposed path must never be overwritten; the preview should use a distinct `(character)` path.
- A matching character canonical name or alias appearing before confirmation must block creation and leave the original POV intact.
- Changing the chapter POV while the confirmation dialogue is open must block the stale creation.

## Failure and rollback

Simulate or observe a creation failure where practical. The original unmatched POV must remain intact. A newly created note must not be left behind when the chapter wikilink update fails, and later author edits must never be overwritten by rollback.
