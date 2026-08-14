import type { EditorialStoreService } from "../editorial/EditorialStore";
import type { ContinuityObservation } from "../observations/ContinuityObservation";
import {
  CONTINUITY_DISPOSITION_NOTE_LIMIT,
  DispositionMatch
} from "../observations/ContinuityDisposition";

const LABELS = {
  intentional: "Intentional",
  deferred: "Deferred",
  resolved: "Resolved"
} as const;

export type ContinuityDispositionPrimaryAction = "mark_intentional" | "return_unresolved";

export function continuityDispositionPrimaryAction(match: DispositionMatch): ContinuityDispositionPrimaryAction {
  return match.state === "current" && match.record?.disposition === "intentional"
    ? "return_unresolved"
    : "mark_intentional";
}

export function continuityDispositionStatus(match: DispositionMatch): string {
  if (!match.record) return "Unresolved";
  const label = LABELS[match.record.disposition];
  if (match.state === "stale") return `Changed since marked ${label.toLowerCase()}`;
  if (match.record.disposition === "resolved") return "Marked resolved — still detected";
  return label;
}

export function renderContinuityDispositionControls(
  container: HTMLElement,
  observation: ContinuityObservation,
  match: DispositionMatch,
  store: EditorialStoreService
): void {
  const controls = container.createDiv("mwc-continuity-disposition");
  const status = controls.createDiv({
    cls: match.state === "stale"
      ? "mwc-continuity-disposition-status mwc-continuity-disposition-status--stale"
      : "mwc-continuity-disposition-status",
    text: continuityDispositionStatus(match)
  });
  status.setAttribute("role", "status");

  if (match.state === "stale" && match.record) {
    controls.createEl("p", {
      cls: "mwc-continuity-prior-decision",
      text: `Prior decision: ${LABELS[match.record.disposition]} · ${match.record.updatedAt}`
    });
  }
  if (match.record?.note) {
    controls.createEl("p", {
      cls: "mwc-continuity-disposition-note",
      text: match.record.note
    });
  }

  const actions = controls.createDiv("mwc-continuity-disposition-actions");
  const primaryAction = continuityDispositionPrimaryAction(match);
  const primary = actions.createEl("button", {
    text: primaryAction === "return_unresolved" ? "Return to unresolved" : "Mark intentional",
    attr: { type: "button" }
  });
  primary.onclick = () => {
    primary.disabled = true;
    void (primaryAction === "return_unresolved"
      ? store.clearContinuityDisposition(observation.lineageKey)
      : store.setContinuityDisposition(observation, "intentional"));
  };

  const more = actions.createEl("details", { cls: "mwc-continuity-disposition-more" });
  more.createEl("summary", { text: "More" });
  const menu = more.createDiv({
    cls: "mwc-continuity-disposition-menu",
    attr: { role: "group", "aria-label": "Continuity disposition actions" }
  });
  const action = (label: string, run: () => Promise<void>) => {
    const button = menu.createEl("button", { text: label, attr: { type: "button" } });
    button.onclick = () => {
      button.disabled = true;
      void run();
    };
  };
  action("Defer", () => store.setContinuityDisposition(observation, "deferred"));
  action("Mark resolved", () => store.setContinuityDisposition(observation, "resolved"));
  if (match.record) {
    if (primaryAction !== "return_unresolved") {
      action("Return to unresolved", () => store.clearContinuityDisposition(observation.lineageKey));
    }
    const noteButton = menu.createEl("button", {
      text: match.record.note ? "Edit note" : "Add note",
      attr: { type: "button" }
    });
    noteButton.onclick = () => {
      more.open = false;
      const editor = controls.createDiv("mwc-continuity-note-editor");
      noteButton.disabled = true;
      const input = editor.createEl("textarea", {
        attr: {
          "aria-label": "Continuity disposition note",
          maxlength: String(CONTINUITY_DISPOSITION_NOTE_LIMIT),
          rows: "3"
        }
      });
      input.value = match.record?.note ?? "";
      const noteActions = editor.createDiv("mwc-continuity-note-actions");
      const save = noteActions.createEl("button", { text: "Save note", attr: { type: "button" } });
      const cancel = noteActions.createEl("button", { text: "Cancel", attr: { type: "button" } });
      save.onclick = () => {
        save.disabled = true;
        void store.reviseContinuityDispositionNote(observation.lineageKey, input.value);
      };
      cancel.onclick = () => editor.remove();
      input.onkeydown = (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        editor.remove();
        noteButton.focus();
      };
      input.focus();
    };
  }
}
