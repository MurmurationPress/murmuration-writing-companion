import { App, Modal, Setting } from "obsidian";
import {
  applyReferenceImport,
  CitationParseResult,
  parseCitation,
  ReferenceConflictChoice,
  referenceImportConflicts
} from "../references/CitationParser";
import {
  EMPTY_REFERENCE_METADATA,
  ReferenceField,
  ReferenceMetadata,
  referenceFieldText,
  referenceMetadataFromText
} from "../references/ReferenceMetadata";

const LABELS: Record<ReferenceField, string> = {
  authors: "Authors", title: "Title", date: "Publication year or date",
  publication: "Journal / publication", publisher: "Publisher", volume: "Volume",
  issue: "Issue", pages: "Pages", doi: "DOI", link: "Canonical link"
};

export class ReferenceCitationImportModal extends Modal {
  private readonly parsed: CitationParseResult;
  private readonly inputs = {} as Record<ReferenceField, HTMLInputElement>;
  private readonly choices: Partial<Record<ReferenceField, ReferenceConflictChoice>> = {};
  private applyButton!: HTMLButtonElement;

  constructor(
    app: App,
    input: string,
    private readonly existing: ReferenceMetadata,
    private readonly onApply: (metadata: ReferenceMetadata) => void
  ) {
    super(app);
    this.parsed = parseCitation(input);
  }

  onOpen(): void {
    this.titleEl.setText("Citation import preview");
    this.contentEl.createEl("p", { text: "Review every recognised value. Applying changes this form only; no note is written." });
    if (this.parsed.warnings.length) {
      const warnings = this.contentEl.createDiv("mod-warning");
      warnings.createEl("strong", { text: "Warnings" });
      const list = warnings.createEl("ul");
      for (const warning of this.parsed.warnings) list.createEl("li", { text: warning });
    }
    if (this.parsed.unparsed.length) {
      const unparsed = this.contentEl.createDiv();
      unparsed.createEl("strong", { text: "Unparsed input" });
      const list = unparsed.createEl("ul");
      for (const value of this.parsed.unparsed) list.createEl("li", { text: value });
    }

    const fields = Object.keys(EMPTY_REFERENCE_METADATA) as ReferenceField[];
    const conflicts = new Map(referenceImportConflicts(this.existing, this.parsed.metadata).map((conflict) => [conflict.field, conflict]));
    for (const field of fields) {
      const setting = new Setting(this.contentEl).setName(LABELS[field]);
      const conflict = conflicts.get(field);
      if (conflict) setting.setDesc(`Existing: ${conflict.existing} · Parsed: ${conflict.parsed}`);
      setting.addText((text) => {
        text.setValue(referenceFieldText(this.parsed.metadata, field));
        this.inputs[field] = text.inputEl;
      });
      if (conflict) setting.addDropdown((dropdown) => {
        dropdown.addOption("", "Resolve conflict…");
        dropdown.addOption("keep", "Keep existing");
        dropdown.addOption("parsed", "Use parsed");
        dropdown.addOption("manual", "Use edited value");
        dropdown.onChange((value) => { this.choices[field] = value as ReferenceConflictChoice; this.refreshApplyState(conflicts); });
      });
    }

    const actions = this.contentEl.createDiv("modal-button-container");
    actions.createEl("button", { text: "Cancel" }).onclick = () => this.close();
    this.applyButton = actions.createEl("button", { text: "Apply to Reference form", cls: "mod-cta" });
    this.applyButton.onclick = () => {
      const values = {} as Record<ReferenceField, string>;
      for (const field of fields) values[field] = this.inputs[field].value;
      const edited = referenceMetadataFromText(values);
      const manual = Object.fromEntries(fields.map((field) => [field, this.inputs[field].value])) as Partial<Record<ReferenceField, string>>;
      try {
        this.onApply(applyReferenceImport(this.existing, edited, this.choices, manual));
        this.close();
      } catch { this.refreshApplyState(conflicts); }
    };
    this.refreshApplyState(conflicts);
  }

  private refreshApplyState(conflicts: ReadonlyMap<ReferenceField, unknown>): void {
    if (!this.applyButton) return;
    this.applyButton.disabled = [...conflicts.keys()].some((field) => !this.choices[field]);
  }
}
