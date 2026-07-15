import { Notice } from "obsidian";
import type {
  EditorialPassChecklistItem,
  EditorialPassKey
} from "../editorial/EditorialPass";

export type EditorialPassToggleHandler = (
  pass: EditorialPassKey,
  completed: boolean
) => Promise<unknown>;

export interface EditorialPassChecklistOptions {
  activeMode?: EditorialPassKey | null;
}

export function renderEditorialPassChecklist(
  container: Element,
  chapterName: string,
  items: EditorialPassChecklistItem[],
  onToggle: EditorialPassToggleHandler,
  options: EditorialPassChecklistOptions = {}
): HTMLElement {
  if (options.activeMode) {
    renderActiveModeAction(container, items, options.activeMode, onToggle);
  }

  const list = container.createDiv({
    cls: "mwc-editorial-pass-list",
    attr: {
      role: "group",
      "aria-label": `Editorial progress for ${chapterName}`
    }
  });

  for (const item of items) {
    const classes = ["mwc-editorial-pass-item"];
    if (item.completed) classes.push("mwc-editorial-pass-item--completed");
    if (item.inferred) classes.push("mwc-editorial-pass-item--inferred");
    if (item.frontier) classes.push("mwc-editorial-pass-item--frontier");

    const row = list.createEl("label", { cls: classes.join(" ") });
    const checkbox = row.createEl("input", {
      cls: "mwc-editorial-pass-checkbox",
      type: "checkbox",
      attr: {
        "aria-label": item.completed
          ? `Move editorial progress before ${item.label}`
          : `Advance editorial progress to ${item.label}`
      }
    });
    checkbox.checked = item.completed;

    row.createSpan({
      cls: "mwc-editorial-pass-label",
      text: item.label
    });

    if (item.frontier && item.completedAt) {
      row.createEl("time", {
        cls: "mwc-editorial-pass-time",
        text: `Reached ${formatEditorialPassDate(item.completedAt)}`,
        attr: {
          datetime: item.completedAt,
          title: item.completedAt
        }
      });
    } else if (item.inferred) {
      row.createSpan({
        cls: "mwc-editorial-pass-inferred",
        text: "Included"
      });
    }

    checkbox.onchange = async () => {
      const nextCompleted = checkbox.checked;
      checkbox.disabled = true;

      try {
        await onToggle(item.key, nextCompleted);
      } catch (error) {
        console.error("Writing Companion could not update editorial progress", error);
        checkbox.checked = item.completed;
        checkbox.disabled = false;
        new Notice("Writing Companion could not update editorial progress.");
      }
    };
  }

  return list;
}

function renderActiveModeAction(
  container: Element,
  items: EditorialPassChecklistItem[],
  activeMode: EditorialPassKey,
  onToggle: EditorialPassToggleHandler
) {
  const item = items.find((candidate) => candidate.key === activeMode);
  if (!item) return;

  const button = container.createEl("button", {
    cls: item.completed
      ? "mwc-editorial-active-action mwc-editorial-active-action--reached"
      : "mwc-editorial-active-action",
    attr: {
      type: "button",
      "aria-label": item.completed
        ? `${item.label} review reached for this scene`
        : `Mark ${item.label} review complete for this scene`
    }
  });
  button.createSpan({
    text: item.completed
      ? `${item.label} reached`
      : `Mark ${item.label} complete`
  });
  button.createSpan({ text: item.completed ? "✓" : "→", attr: { "aria-hidden": "true" } });
  button.disabled = item.completed;

  button.onclick = async () => {
    button.disabled = true;
    try {
      await onToggle(activeMode, true);
    } catch (error) {
      console.error("Writing Companion could not complete the active review mode", error);
      button.disabled = false;
      new Notice("Writing Companion could not update editorial progress.");
    }
  };
}

function formatEditorialPassDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}
