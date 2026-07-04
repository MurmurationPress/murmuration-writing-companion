import { Annotation, EditorialNote } from "../editorial/EditorialNote";
import { DEFAULT_CATEGORIES } from "../editorial/Categories";

const FOCUS_RETRY_DELAYS_MS = [0, 50, 150, 300, 500];

export function renderAnnotationCard(
  container: Element,
  annotation: Annotation,
  updateNote: (note: EditorialNote, patch: Partial<EditorialNote>) => Promise<void>,
  focusNoteId?: string | null,
  onFocusComplete?: (noteId: string) => void,
  onNavigate?: (annotation: Annotation) => void
): HTMLElement {
  const card = container.createDiv("mwc-annotation-card");

  const extract = card.createEl("blockquote", {
    cls: "mwc-annotation-extract",
    text: annotation.anchor.text
  });
  extract.setAttribute("aria-label", "Go to selected manuscript text");
  extract.setAttribute("role", "button");
  extract.setAttribute("tabindex", "0");
  extract.setAttribute("title", "Go to this passage in the chapter");

  extract.onclick = () => {
    onNavigate?.(annotation);
  };

  extract.onkeydown = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    onNavigate?.(annotation);
  };

  const body = card.createEl("textarea", {
    cls: "mwc-annotation-body",
    attr: {
      placeholder: "Add annotation…",
      "aria-label": "Annotation text"
    }
  });
  body.value = annotation.body;

  if (focusNoteId === annotation.id) {
    scheduleAnnotationFocus(body, annotation.id, onFocusComplete);
  }

  body.onchange = async () => {
    await updateNote(annotation, { body: body.value });
  };

  const footer = card.createDiv("mwc-annotation-footer");
  const metadata = footer.createDiv("mwc-annotation-metadata");

  const category = metadata.createEl("select", {
    cls: "mwc-annotation-category",
    attr: { "aria-label": "Annotation category" }
  });

  for (const categoryName of DEFAULT_CATEGORIES) {
    const option = category.createEl("option", {
      text: categoryName,
      value: categoryName
    });

    if (categoryName === annotation.category) option.selected = true;
  }

  category.onchange = async () => {
    await updateNote(annotation, { category: category.value });
  };

  if (annotation.anchor.line) {
    metadata.createEl("span", {
      cls: "mwc-annotation-separator",
      text: "·",
      attr: { "aria-hidden": "true" }
    });

    metadata.createEl("span", {
      cls: "mwc-annotation-line",
      text: `Line ${annotation.anchor.line}`
    });
  }

  const resolve = footer.createEl("button", {
    cls: "mwc-annotation-resolve",
    text: "Resolve",
    attr: { "aria-label": "Resolve annotation" }
  });

  resolve.onclick = async () => {
    await updateNote(annotation, { status: "resolved" });
  };

  return card;
}

function scheduleAnnotationFocus(
  body: HTMLTextAreaElement,
  noteId: string,
  onFocusComplete?: (noteId: string) => void
) {
  for (const [index, delay] of FOCUS_RETRY_DELAYS_MS.entries()) {
    window.setTimeout(() => {
      if (!body.isConnected) return;

      body.scrollIntoView({ block: "nearest" });
      body.focus({ preventScroll: true });
      body.setSelectionRange(body.value.length, body.value.length);

      if (document.activeElement === body || index === FOCUS_RETRY_DELAYS_MS.length - 1) {
        onFocusComplete?.(noteId);
      }
    }, delay);
  }
}
