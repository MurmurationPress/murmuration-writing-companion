import { App, Modal } from "obsidian";
import {
  isExactStoryDate,
  StoryWorldEventCreationProposal,
  StoryWorldEventDateDecision
} from "./StoryWorldEventCreation";

let nextEventDateGroupId = 0;

class StoryWorldEventCreationModal extends Modal {
  private settled = false;
  private decision: StoryWorldEventDateDecision | null = null;

  constructor(
    app: App,
    private readonly proposal: StoryWorldEventCreationProposal,
    private readonly resolve: (decision: StoryWorldEventDateDecision | null) => void
  ) {
    super(app);
  }

  onOpen() {
    this.titleEl.setText("Create Story World event");
    this.contentEl.createEl("p", {
      text: `Create “${this.proposal.name}” as a minimal Story World event?`
    });

    const details = this.contentEl.createEl("dl", {
      cls: "mwc-event-creation-preview"
    });
    const addDetail = (label: string, value: string) => {
      const row = details.createDiv("mwc-event-creation-preview-row");
      row.createEl("dt", { text: label });
      row.createEl("dd", { text: value });
    };
    addDetail("Name", this.proposal.name);
    addDetail("Note", this.proposal.path);
    addDetail("Source", this.proposal.sources.join(" · "));
    addDetail(
      "Scope",
      this.proposal.scope.length > 0 ? this.proposal.scope.join(" · ") : "Unscoped"
    );

    const fieldset = this.contentEl.createEl("fieldset", {
      cls: "mwc-event-date-choice"
    });
    fieldset.createEl("legend", { text: "Event date" });
    const groupName = `mwc-event-date-${++nextEventDateGroupId}`;
    const create = this.contentEl.createEl("button", {
      text: "Create event",
      cls: "mod-cta",
      attr: { type: "button" }
    });
    create.disabled = true;

    const choose = (decision: StoryWorldEventDateDecision | null) => {
      this.decision = decision;
      create.disabled = decision === null;
    };

    const addRadio = (
      value: string,
      labelText: string,
      onchange: () => void
    ): HTMLInputElement => {
      const label = fieldset.createEl("label", { cls: "mwc-event-date-option" });
      const radio = label.createEl("input", {
        type: "radio",
        attr: { name: groupName, value }
      });
      label.createSpan({ text: labelText });
      radio.onchange = () => {
        if (radio.checked) onchange();
      };
      return radio;
    };

    if (this.proposal.chapterStoryDate) {
      addRadio(
        "chapter",
        `Use chapter date — ${this.proposal.chapterStoryDate}`,
        () => choose({ mode: "chapter", date: this.proposal.chapterStoryDate })
      );
    }

    const customRow = fieldset.createDiv("mwc-event-date-custom");
    const customLabel = customRow.createEl("label", { cls: "mwc-event-date-option" });
    const customRadio = customLabel.createEl("input", {
      type: "radio",
      attr: { name: groupName, value: "custom" }
    });
    customLabel.createSpan({ text: "Enter another exact date" });
    const customDate = customRow.createEl("input", {
      type: "date",
      attr: { "aria-label": "Event date" }
    });

    const updateCustom = () => {
      customRadio.checked = true;
      const date = customDate.value.trim();
      choose(isExactStoryDate(date) ? { mode: "custom", date } : null);
    };
    customRadio.onchange = () => {
      if (customRadio.checked) {
        updateCustom();
        customDate.focus();
      }
    };
    customDate.oninput = updateCustom;
    customDate.onfocus = updateCustom;

    addRadio(
      "undated",
      "Leave the event undated",
      () => choose({ mode: "undated", date: null })
    );

    this.contentEl.createEl("p", {
      cls: "mwc-muted",
      text: "The prose link will not be rewritten. Adding the event to World Context is a separate choice after creation."
    });

    const actions = this.contentEl.createDiv("mwc-event-creation-modal-actions");
    const cancel = actions.createEl("button", {
      text: "Cancel",
      attr: { type: "button" }
    });
    actions.appendChild(create);
    cancel.onclick = () => this.finish(null);
    create.onclick = () => {
      if (this.decision) this.finish(this.decision);
    };
    window.setTimeout(() => fieldset.querySelector<HTMLInputElement>("input")?.focus(), 0);
  }

  onClose() {
    this.contentEl.empty();
    if (!this.settled) this.resolve(null);
  }

  private finish(decision: StoryWorldEventDateDecision | null) {
    if (this.settled) return;
    this.settled = true;
    this.resolve(decision);
    this.close();
  }
}

export function confirmStoryWorldEventCreation(
  app: App,
  proposal: StoryWorldEventCreationProposal
): Promise<StoryWorldEventDateDecision | null> {
  return new Promise((resolve) => {
    new StoryWorldEventCreationModal(app, proposal, resolve).open();
  });
}
