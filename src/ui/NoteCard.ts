import { EditorialNote } from "../editorial/EditorialNote";
import { DEFAULT_CATEGORIES } from "../editorial/Categories";

export function renderNoteCard(
  container: Element,
  note: EditorialNote,
  updateNote: (note: EditorialNote, patch: Partial<EditorialNote>) => Promise<void>,
  focusNoteId?: string | null,
  onFocused?: () => void
): HTMLElement {
  const card = container.createDiv("mwc-note-card");

  card.createEl("span", {
    cls: "mwc-category",
    text: note.category
  });

  const body = card.createEl("textarea", {
    cls: "mwc-note-body",
    text: note.body
  });

  if (focusNoteId === note.id) {
	window.setTimeout(() => {
	  body.scrollIntoView({ block: "center" });
	  body.focus();
	  body.select();
	  onFocused?.();
	}, 150);
  }

  body.onchange = async () => {
    await updateNote(note, { body: body.value });
  };

  const controls = card.createDiv("mwc-controls");

  const category = controls.createEl("select", {
    cls: "mwc-select"
  });

  for (const categoryName of DEFAULT_CATEGORIES) {
    const option = category.createEl("option", {
      text: categoryName,
      value: categoryName
    });

    if (categoryName === note.category) option.selected = true;
  }

  category.onchange = async () => {
    await updateNote(note, { category: category.value });
  };

  const resolve = controls.createEl("button", {
    cls: "mwc-button",
    text: "Resolve"
  });

  resolve.onclick = async () => {
    await updateNote(note, { status: "resolved" });
  };

  return card;
}
