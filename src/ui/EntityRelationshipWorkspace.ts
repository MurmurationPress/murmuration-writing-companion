import { MarkdownRenderer, MarkdownView, Notice, TFile } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import {
  ENTITY_RELATIONSHIP_PREDICATES,
  ENTITY_RELATIONSHIP_STATUSES,
  EntityRelationshipDraft,
  EntityRelationshipMutation,
  EntityRelationshipProjection,
  projectEntityRelationships,
  relationshipProperty,
  relationshipValuesEqual,
  isRecord
} from "../story-world/EntityRelationships";
import {
  readEntityRelationshipDocument,
  writeObsidianEntityRelationship
} from "../story-world/ObsidianEntityRelationshipWriting";
import { parseWikilink } from "../story-world/StoryWorldIndex";
import {
  exactDateQualifierState,
  exactDateQualifierUpdate,
  ExactDateQualifierState,
  resolveEntityRelationshipTarget
} from "../story-world/EntityRelationshipFormValues";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function customPredicateId(label: string): string {
  return label.trim().toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function displayQualifier(key: string): string {
  const labels: Record<string, string> = {
    source: "Source", as_of: "As of", valid_from: "Valid from", valid_until: "Valid until",
    time_precision: "Time precision", asserted_by: "Asserted by", confidence: "Confidence",
    scope: "Scope", visibility: "Visibility", audience: "Audience", hidden_from: "Hidden from",
    replaces: "Replaces", replaced_by: "Replaced by", status_note: "Status note"
  };
  return labels[key] ?? key.replace(/[_-]+/g, " ").replace(/^./, (value) => value.toUpperCase());
}

function qualifierText(value: unknown): string {
  if (Array.isArray(value)) return value.map(qualifierText).join(", ");
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return "Preserved structured detail";
}

async function openRelatedNote(
  plugin: MurmurationWritingCompanionPlugin,
  source: TFile,
  reference: string
): Promise<void> {
  const parsed = parseWikilink(reference);
  const target = parsed && plugin.app.metadataCache.getFirstLinkpathDest(parsed.linkpath, source.path);
  if (!(target instanceof TFile)) {
    new Notice("That related authoritative note could not be resolved.");
    return;
  }
  const leaf = plugin.app.workspace.getLeaf(false);
  await leaf.openFile(target, { active: true });
  await plugin.app.workspace.revealLeaf(leaf);
  await plugin.activateView();
  plugin.app.workspace.setActiveLeaf(leaf, { focus: true });
  const editor = plugin.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
  editor?.focus();
}

function renderLinkedSentence(
  container: Element,
  plugin: MurmurationWritingCompanionPlugin,
  file: TFile,
  subject: string,
  relation: EntityRelationshipProjection
): void {
  const sentence = container.createEl("p", { cls: "mwc-entity-relationship-sentence" });
  if (!relation.valid) {
    sentence.setText(relation.sentence);
    return;
  }
  sentence.createSpan({ text: `${subject} ${relation.predicateLabel} ` });
  if (relation.objectKind === "target" && typeof relation.objectValue === "string") {
    const link = sentence.createEl("button", { cls: "mwc-entity-relationship-link", text: relation.objectLabel ?? relation.objectValue });
    link.onclick = () => void openRelatedNote(plugin, file, relation.objectValue as string);
  } else {
    sentence.createSpan({ text: relation.objectLabel ?? "" });
  }
  sentence.createSpan({ text: "." });
}

function renderDetails(
  container: Element,
  plugin: MurmurationWritingCompanionPlugin,
  file: TFile,
  relation: EntityRelationshipProjection
): void {
  const details = container.createEl("details", { cls: "mwc-entity-relationship-details" });
  details.createEl("summary", { text: "Provenance and qualifiers" });
  if (!Object.keys(relation.qualifiers).length) {
    details.createEl("p", { text: "No provenance or time qualifiers recorded." });
    return;
  }
  const list = details.createEl("dl");
  for (const [key, value] of Object.entries(relation.qualifiers)) {
    const row = list.createDiv("mwc-context-row");
    row.createEl("dt", { text: displayQualifier(key) });
    const rendered = row.createEl("dd");
    if (key === "source") void MarkdownRenderer.render(plugin.app, qualifierText(value), rendered, file.path, plugin);
    else rendered.setText(qualifierText(value));
  }
}

function parseSources(value: string): string | string[] | undefined {
  const items = value.split(",").map((item) => item.trim()).filter(Boolean);
  return items.length > 1 ? items : items[0];
}

function addField(container: Element, label: string, value: string): HTMLInputElement {
  const row = container.createEl("label");
  row.createSpan({ text: label });
  const input = row.createEl("input", { type: "text" });
  input.value = value;
  return input;
}

interface ExactDateControl {
  readonly input: HTMLInputElement;
  readonly state: ExactDateQualifierState;
  replacementEnabled(): boolean;
  previewValue(): string;
}

function addExactDateField(container: Element, label: string, value: unknown): ExactDateControl {
  const state = exactDateQualifierState(value);
  const row = container.createEl("label");
  row.createSpan({ text: label });
  const field = row.createDiv("mwc-entity-relationship-date");
  const input = field.createEl("input", { type: "date" });
  input.value = state.exactValue;
  let replacing = !state.requiresReplacement;
  if (state.requiresReplacement) {
    input.hidden = true;
    field.createEl("span", { cls: "mwc-entity-relationship-preserved-date", text: `Preserved: ${state.preservedLabel}` });
    const replace = field.createEl("button", { text: "Replace with exact date", attr: { type: "button" } });
    replace.onclick = () => {
      replacing = true;
      replace.remove();
      field.querySelector(".mwc-entity-relationship-preserved-date")?.remove();
      input.hidden = false;
      input.focus();
      input.dispatchEvent(new Event("input"));
    };
  }
  return {
    input,
    state,
    replacementEnabled: () => replacing,
    previewValue: () => state.requiresReplacement && !replacing
      ? state.preservedLabel ?? ""
      : input.value
  };
}

async function writeMutation(
  plugin: MurmurationWritingCompanionPlugin,
  file: TFile,
  snapshot: Awaited<ReturnType<typeof readEntityRelationshipDocument>>,
  mutation: EntityRelationshipMutation
): Promise<void> {
  await writeObsidianEntityRelationship(plugin.app, file, snapshot, mutation);
  plugin.storyWorldIndex.rebuild();
  plugin.refreshView();
}

function renderGuidedForm(
  host: Element,
  plugin: MurmurationWritingCompanionPlugin,
  file: TFile,
  subject: string,
  snapshot: Awaited<ReturnType<typeof readEntityRelationshipDocument>>,
  relation: EntityRelationshipProjection | null
): void {
  host.empty();
  const form = host.createDiv("mwc-entity-relationship-form");
  form.createEl("h4", { text: relation ? "Edit relationship" : "Add relationship" });
  const controls = form.createDiv("mwc-entity-relationship-controls");
  const predicateRow = controls.createEl("label");
  predicateRow.createSpan({ text: "Relationship" });
  const predicate = predicateRow.createEl("select");
  predicate.createEl("option", { value: "", text: "Choose…" });
  for (const option of ENTITY_RELATIONSHIP_PREDICATES) predicate.createEl("option", { value: option.value, text: option.label });
  predicate.createEl("option", { value: "other", text: "Other…" });
  const storedPredicateLabel = isRecord(relation?.raw) && typeof relation.raw.predicate_label === "string"
    ? relation.raw.predicate_label.trim()
    : "";
  const knownPredicate = relation?.predicate && !storedPredicateLabel
    && ENTITY_RELATIONSHIP_PREDICATES.some((option) => option.value === relation.predicate);
  predicate.value = relation ? (knownPredicate ? relation.predicate! : "other") : "";
  const custom = addField(controls, "Custom phrase", relation?.predicateLabel ?? "");

  const kindRow = controls.createEl("label");
  kindRow.createSpan({ text: "Object type" });
  const objectKind = kindRow.createEl("select");
  objectKind.createEl("option", { value: "target", text: "Story World entity" });
  objectKind.createEl("option", { value: "value", text: "Literal value" });
  objectKind.value = relation?.objectKind ?? "target";
  const entities = plugin.storyWorldIndex.index.getAll();
  const existingPaths = plugin.app.vault.getMarkdownFiles().map((candidate) => candidate.path);
  const storedTarget = relation?.objectKind === "target" && typeof relation.objectValue === "string"
    ? resolveEntityRelationshipTarget(relation.objectValue, entities, existingPaths)
    : null;
  const objectInput = addField(
    controls,
    "Target or value",
    storedTarget?.displayName ?? (relation?.objectValue == null ? "" : String(relation.objectValue))
  );
  objectInput.setAttr("list", "mwc-story-world-relationship-targets");
  const datalist = controls.createEl("datalist", { attr: { id: "mwc-story-world-relationship-targets" } });
  for (const entity of entities) {
    datalist.createEl("option", { value: entity.name });
    for (const alias of entity.aliases) datalist.createEl("option", { value: alias, attr: { label: entity.name } });
  }
  const targetError = controls.createEl("p", { cls: "mwc-entity-relationship-target-error" });

  const statusRow = controls.createEl("label");
  statusRow.createSpan({ text: "Authorial status" });
  const status = statusRow.createEl("select");
  for (const option of ENTITY_RELATIONSHIP_STATUSES) status.createEl("option", { value: option.value, text: option.label });
  if (relation?.status && !ENTITY_RELATIONSHIP_STATUSES.some((option) => option.value === relation.status)) {
    status.createEl("option", { value: relation.status, text: relation.statusLabel });
  }
  status.value = relation?.status ?? "confirmed";

  const advanced = form.createEl("details", { cls: "mwc-entity-relationship-advanced" });
  advanced.createEl("summary", { text: "Provenance and time" });
  const advancedControls = advanced.createDiv("mwc-entity-relationship-controls");
  const originalSource = qualifierText(relation?.qualifiers.source ?? "");
  const source = addField(advancedControls, "Source note(s)", originalSource);
  const asOf = addExactDateField(advancedControls, "As of", relation?.qualifiers.as_of);
  const validFrom = addExactDateField(advancedControls, "Valid from", relation?.qualifiers.valid_from);
  const validUntil = addExactDateField(advancedControls, "Valid until", relation?.qualifiers.valid_until);

  const preview = form.createEl("p", { cls: "mwc-entity-relationship-preview" });
  const save = form.createEl("button", { text: relation ? "Confirm changes" : "Confirm relationship", cls: "mod-cta" });
  save.setAttr("type", "button");
  const cancel = form.createEl("button", { text: "Cancel" });
  cancel.setAttr("type", "button");

  const currentDraft = (): EntityRelationshipDraft | null => {
    const customLabel = custom.value.replace(/\s+/g, " ").trim();
    const selected = predicate.value;
    const customUnchanged = relation && customLabel === relation.predicateLabel;
    const storedPredicate = selected === "other"
      ? relation?.predicate && customLabel === relation.predicateLabel ? relation.predicate : customPredicateId(customLabel)
      : selected;
    const objectValue = objectInput.value.trim();
    const target = objectKind.value === "target"
      ? resolveEntityRelationshipTarget(objectValue, entities, existingPaths)
      : null;
    if (!storedPredicate || !objectValue || !status.value || target?.error) return null;
    const qualifierUpdates: Record<string, unknown | undefined> = {};
    if (source.value !== originalSource) qualifierUpdates.source = parseSources(source.value);
    for (const [key, control] of [["as_of", asOf], ["valid_from", validFrom], ["valid_until", validUntil]] as const) {
      const update = exactDateQualifierUpdate(control.state, control.replacementEnabled(), control.input.value);
      if (update.changed) qualifierUpdates[key] = update.value;
    }
    return {
      predicate: storedPredicate,
      predicateLabel: selected === "other" ? (customUnchanged ? storedPredicateLabel || null : customLabel) : null,
      objectKind: objectKind.value as "target" | "value",
      objectValue: target?.reference ?? (relation?.objectKind === "value" && String(relation.objectValue) === objectValue
        ? relation.objectValue as string | number | boolean
        : objectValue),
      status: status.value,
      qualifierUpdates
    };
  };
  const update = () => {
    custom.parentElement!.hidden = predicate.value !== "other";
    objectInput.previousElementSibling!.textContent = objectKind.value === "target" ? "Target entity" : "Literal value";
    const target = objectKind.value === "target"
      ? resolveEntityRelationshipTarget(objectInput.value, entities, existingPaths)
      : null;
    targetError.setText(target?.error ?? "");
    targetError.hidden = !target?.error;
    const draft = currentDraft();
    save.disabled = !draft;
    if (!draft) preview.setText("Complete the relationship to preview the statement before writing.");
    else {
      const label = draft.predicateLabel || ENTITY_RELATIONSHIP_PREDICATES.find((option) => option.value === draft.predicate)?.label || draft.predicate.replace(/_/g, " ");
      const object = draft.objectKind === "target" ? target?.displayName ?? draft.objectValue : draft.objectValue;
      const qualifiers = [
        asOf.previewValue() ? `As of ${asOf.previewValue()}.` : "",
        validFrom.previewValue() ? `Valid from ${validFrom.previewValue()}.` : "",
        validUntil.previewValue() ? `Valid until ${validUntil.previewValue()}.` : "",
        source.value.trim() ? `Source: ${source.value.trim()}.` : ""
      ].filter(Boolean).join(" ");
      preview.setText(`${subject} ${label} ${object}. ${ENTITY_RELATIONSHIP_STATUSES.find((option) => option.value === draft.status)?.label ?? draft.status}.${qualifiers ? ` ${qualifiers}` : ""}`);
    }
  };
  for (const element of [predicate, custom, objectKind, objectInput, status, source, asOf.input, validFrom.input, validUntil.input]) {
    element.addEventListener("input", update);
    element.addEventListener("change", update);
  }
  cancel.onclick = () => { host.empty(); };
  save.onclick = async () => {
    const draft = currentDraft();
    if (!draft) return;
    save.disabled = true;
    try {
      await writeMutation(plugin, file, snapshot, { kind: relation ? "edit" : "add", index: relation?.index, draft });
      new Notice(relation ? "Relationship updated." : "Relationship added.");
    } catch (error) {
      new Notice(`Could not save relationship: ${errorMessage(error)}`);
      save.disabled = false;
    }
  };
  update();
}

async function beginForm(
  host: Element,
  plugin: MurmurationWritingCompanionPlugin,
  file: TFile,
  subject: string,
  index?: number
): Promise<void> {
  try {
    const snapshot = await readEntityRelationshipDocument(plugin.app, file);
    const relations = projectEntityRelationships(subject, snapshot.frontmatter[relationshipProperty(snapshot.frontmatter)]);
    const relation = index === undefined ? null : relations[index];
    if (index !== undefined && (!relation || !relation.valid)) throw new Error("The relationship is no longer available for simple editing.");
    renderGuidedForm(host, plugin, file, subject, snapshot, relation);
  } catch (error) {
    new Notice(`Could not begin relationship editing: ${errorMessage(error)}`);
  }
}

async function confirmMutation(
  host: Element,
  plugin: MurmurationWritingCompanionPlugin,
  file: TFile,
  subject: string,
  relation: EntityRelationshipProjection,
  kind: "supersede" | "remove"
): Promise<void> {
  const snapshot = await readEntityRelationshipDocument(plugin.app, file);
  const current = projectEntityRelationships(subject, snapshot.frontmatter[relationshipProperty(snapshot.frontmatter)])[relation.index];
  if (!current || !relationshipValuesEqual(current.raw, relation.raw)) {
    throw new Error("The relationship changed before confirmation. Review it and try again.");
  }
  host.empty();
  const confirmation = host.createDiv("mwc-entity-relationship-form");
  confirmation.createEl("h4", { text: kind === "remove" ? "Remove relationship?" : "Supersede relationship?" });
  confirmation.createEl("p", { cls: "mwc-entity-relationship-preview", text: `${current.sentence} ${current.statusLabel}.` });
  const confirm = confirmation.createEl("button", { cls: "mod-warning", text: kind === "remove" ? "Confirm removal" : "Confirm superseded" });
  const cancel = confirmation.createEl("button", { text: "Cancel" });
  cancel.onclick = () => host.empty();
  confirm.onclick = async () => {
    confirm.disabled = true;
    try {
      await writeMutation(plugin, file, snapshot, { kind, index: current.index });
      new Notice(kind === "remove" ? "Relationship removed." : "Relationship superseded.");
    } catch (error) {
      new Notice(`Could not ${kind} relationship: ${errorMessage(error)}`);
      confirm.disabled = false;
    }
  };
}

export function renderEntityRelationshipWorkspace(
  container: Element,
  plugin: MurmurationWritingCompanionPlugin,
  file: TFile,
  entity: { readonly name: string; readonly properties: Readonly<Record<string, unknown>> }
): void {
  const section = container.createDiv("mwc-section mwc-entity-relationships");
  const heading = section.createDiv("mwc-entity-relationships-heading");
  heading.createEl("h3", { text: "Relationships" });
  const add = heading.createEl("button", { text: "Add relationship" });
  const editor = section.createDiv("mwc-entity-relationship-editor");
  add.onclick = () => void beginForm(editor, plugin, file, entity.name);

  const relations = projectEntityRelationships(entity.name, entity.properties[relationshipProperty(entity.properties)]);
  if (!relations.length) section.createEl("p", { cls: "mwc-entity-relationships-empty", text: "No entity-owned relationships recorded." });
  for (const relation of relations) {
    const card = section.createDiv(`mwc-entity-relationship ${relation.valid ? "" : "mwc-entity-relationship-invalid"}`);
    renderLinkedSentence(card, plugin, file, entity.name, relation);
    card.createSpan({ cls: "mwc-entity-relationship-status", text: relation.statusLabel });
    if (relation.issue) card.createEl("p", { cls: "mwc-entity-relationship-warning", text: relation.issue });
    renderDetails(card, plugin, file, relation);
    const actions = card.createDiv("mwc-entity-relationship-actions");
    if (relation.valid) {
      actions.createEl("button", { text: "Edit" }).onclick = () => void beginForm(editor, plugin, file, entity.name, relation.index);
      if (relation.status !== "superseded") actions.createEl("button", { text: "Supersede" }).onclick = () => void confirmMutation(editor, plugin, file, entity.name, relation, "supersede").catch((error) => new Notice(errorMessage(error)));
    }
    if (relation.index >= 0) actions.createEl("button", { text: "Remove" }).onclick = () => void confirmMutation(editor, plugin, file, entity.name, relation, "remove").catch((error) => new Notice(errorMessage(error)));
  }
}
