# Editorial Enhancements Smoke Test

Use a representative Book 2 scene with an owning book note and at least two indexed Story World character notes.

## Book review

- Open the scene and confirm **Book Review** identifies the intended book.
- Change Review mode and confirm it remains selected when another scene in the same book is opened.
- Change Review status and confirm the owning book note receives `review_status` rather than the scene.
- Rename or move the book note and confirm portable review mode follows the note.

## Scene progress

- Select Continuity and confirm Draft through Continuity appear reached.
- Confirm only Continuity is presented as the frontier and earlier passes appear included.
- Confirm the scene frontmatter contains `editorial_pass: continuity`.
- Move the frontier backwards and confirm earlier history remains in portable storage.
- Edit `editorial_pass` externally to a different value and confirm MWC reports the mismatch without changing it until Repair is selected.
- Confirm `chapter_status` is never changed by editorial progress.

## POV

- Confirm the resting POV row occupies one compact property row.
- Confirm an existing wikilink displays without brackets and remains clickable.
- Enter edit mode and confirm Story World characters and aliases are suggested.
- Select a recognised alias and confirm the canonical wikilink is written.
- Enter a new character name and confirm it remains valid without creating a Story World note.
- Open and dismiss the control without changing the value and confirm frontmatter is untouched.

## Annotation locator

- Navigate from an annotation whose extract still matches exactly and confirm the selected passage receives a temporary visible locator.
- Begin editing or change files and confirm the locator clears.
- Navigate to a changed extract that uses line fallback and confirm no exact-match locator is shown.
