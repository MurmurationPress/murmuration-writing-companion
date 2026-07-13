import { Notice } from "obsidian";
import type {
  EditorialPassChecklistItem,
  EditorialPassKey
} from "../editorial/EditorialPass";

export type EditorialPassToggleHandler = (
  pass: EditorialPassKey,
  completed: boolean
) => Promise<unknown>;

export function renderEditorialPassChecklist(
  container: Element,
  chapterName: string,
  items: EditorialPassChecklistItem[],
  onToggle: EditorialPassToggleHandler
): HTMLElement {
  const section = container.createDiv("mwc-section mwc-editorial-passes");
  const heading = section.createEl("h3", { cls: "mwc-section-heading" });
  const completedCount = items.filter((item) => item.completed).length;

  heading.createSpan({ text: "Editorial Passes" });
  heading.createSpan({
    cls: "mwc-editorial-pass-count",
    text: `${completedCount} of ${items.length}`
  });

  const list = section.createDiv({
    cls: "mwc-editorial-pass-list",
    attr: {
      role: "group",
      "aria-label": `Completed editorial passes for ${chapterName}`
    }
  });

  for (const item of items) {
    const row = list.createEl("label", {
      cls: item.completed
        ? "mwc-editorial-pass-item mwc-editorial-pass-item--completed"
        : "mwc-editorial-pass-item"
    });
    const checkbox = row.createEl("input", {
      cls: "mwc-editorial-pass-checkbox",
      type: "checkbox",
      attr: {
        "aria-label": `${item.label} editorial pass completed`
      }
    });
    checkbox.checked = item.completed;

    row.createSpan({
      cls: "mwc-editorial-pass-label",
      text: item.label
    });

    if (item.completedAt) {
      row.createEl("time", {
        cls: "mwc-editorial-pass-time",
        text: `Completed ${formatEditorialPassDate(item.completedAt)}`,
        attr: {
          datetime: item.completedAt,
          title: item.completedAt
        }
      });
    }

    checkbox.onchange = async () => {
      const nextCompleted = checkbox.checked;
      checkbox.disabled = true;

      try {
        await onToggle(item.key, nextCompleted);
      } catch (error) {
        console.error("Writing Companion could not update editorial pass", error);
        checkbox.checked = item.completed;
        checkbox.disabled = false;
        new Notice("Writing Companion could not update the editorial pass.");
      }
    };
  }

  return section;
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
