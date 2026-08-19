import { TFile } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import { parseStoryWorldBuilderItem, StoryWorldBuilderItem } from "../story-world/WorldBuilder";
import { renderEntityRelationshipWorkspace } from "./EntityRelationshipWorkspace";
import { renderEventTimeWorkspace } from "./EventTimeWorkspace";
import { inspectorPanelLabel } from "./PanelLabels";
import { buildObsidianStoryWorldManuscriptImpact } from "../story-world/ObsidianStoryWorldManuscriptImpact";
import { filterStoryWorldManuscriptImpact, ManuscriptImpactFilter } from "../story-world/StoryWorldManuscriptImpact";
import { renderWikilinkValues } from "./WikilinkPresentation";
import {
  readStoryWorldTypedProperties,
  storyWorldTypedPropertyTextValues
} from "../story-world/TypedEntityProperties";
import { createPersistedCollapsibleSection } from "./PersistedCollapsibleSection";

function formatTime(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const at = typeof record.at === "string" ? record.at.trim() : "";
  const from = typeof record.from === "string" ? record.from.trim() : "";
  const to = typeof record.to === "string" ? record.to.trim() : "";
  const precision = typeof record.precision === "string" ? record.precision.trim() : "";
  const base = at || [from, to].filter(Boolean).join(" → ");
  return base ? [base, precision].filter(Boolean).join(" · ") : null;
}

function addText(container: Element, heading: string, value: string | null): void {
  if (!value) return;
  const section = container.createDiv("mwc-story-world-inspector-section");
  section.createEl("h3", { text: heading });
  section.createEl("p", { cls: "mwc-story-world-inspector-prose", text: value });
}

function addValues(container: Element, heading: string, values: readonly string[], plugin: MurmurationWritingCompanionPlugin, file: TFile): void {
  if (!values.length) return;
  const section = container.createDiv("mwc-story-world-inspector-section");
  section.createEl("h3", { text: heading });
  const list = section.createDiv("mwc-story-world-inspector-values");
  for (const value of values) {
    const item = list.createDiv("mwc-story-world-inspector-value");
    renderWikilinkValues(item, value, plugin.app, file.path, plugin);
  }
}

function renderTypedProperties(
  container: Element,
  plugin: MurmurationWritingCompanionPlugin,
  file: TFile,
  item: StoryWorldBuilderItem
): void {
  const properties = readStoryWorldTypedProperties(item.type, item.properties)
    .map((property) => ({ property, values: storyWorldTypedPropertyTextValues(property) }))
    .filter((row) => row.values.length > 0);
  if (!properties.length) return;
  const section = container.createDiv("mwc-story-world-inspector-section mwc-story-world-typed-properties");
  section.createEl("h3", { text: `${item.type.replace(/^./, (value) => value.toUpperCase())} details` });
  const list = section.createEl("dl", { cls: "mwc-story-world-typed-property-list" });
  for (const { property, values } of properties) {
    const row = list.createDiv("mwc-context-row mwc-story-world-typed-property");
    row.createEl("dt", { text: property.definition.label });
    const value = row.createEl("dd");
    if (property.definition.valueType === "entity-reference") {
      values.forEach((entry, index) => {
        if (index) value.createSpan({ text: ", " });
        renderWikilinkValues(value, entry, plugin.app, file.path, plugin);
      });
    } else {
      value.setText(values.join(property.definition.cardinality === "multiple" ? "; " : ""));
    }
  }
}

function renderManuscriptImpactContent(container: Element, plugin: MurmurationWritingCompanionPlugin, file: TFile): void {
  const selected = plugin.storyWorldIndex.index.getByPath(file.path);
  if (!selected) {
    container.createEl("p", { cls: "mwc-muted", text: "Manuscript impact is unavailable for this item." });
    return;
  }
  const projection = buildObsidianStoryWorldManuscriptImpact(plugin.app, plugin.storyWorldIndex, selected, plugin.manuscriptProjection.get(), plugin.storyWorldReviewProjection.get());
  const controls = container.createDiv("mwc-manuscript-impact-controls");
  const count = controls.createSpan({ cls: "mwc-muted" });
  const filter = controls.createEl("select", { attr: { "aria-label": "Filter manuscript impact" } });
  const options: readonly [ManuscriptImpactFilter, string][] = [
    ["all", "All evidence"], ["direct", "Direct references"], ["temporal", "Temporal relevance"],
    ["structured", "Structured evidence"], ["continuity", "Continuity observations"],
    ["before", "Before"], ["during", "During"], ["after", "After"], ["current-book", "Current Book only"]
  ];
  for (const [value, label] of options) { const option = filter.createEl("option", { text: label }); option.value = value; }
  const results = container.createDiv("mwc-manuscript-impact-results");
  const render = () => {
    results.empty();
    const selectedBook = plugin.manuscriptBookSelection.get().bookPath;
    const filtered = filterStoryWorldManuscriptImpact(projection, filter.value as ManuscriptImpactFilter, selectedBook);
    count.setText(`${filtered.length} ${filtered.length === 1 ? "Scene" : "Scenes"}`);
    if (projection.temporalUnavailableReason) results.createEl("p", { cls: "mwc-muted", text: projection.temporalUnavailableReason });
    if (!filtered.length) { results.createEl("p", { cls: "mwc-muted", text: "No manuscript impact matches this filter." }); return; }
    let book = ""; let part = "";
    for (const result of filtered) {
      if (result.scene.bookPath !== book) {
        book = result.scene.bookPath; part = "";
        results.createEl("h4", { text: result.scene.bookTitle });
      }
      const nextPart = result.scene.partPath ?? result.scene.bookPath;
      if (nextPart !== part) { part = nextPart; results.createEl("h5", { text: result.scene.partTitle ?? "Direct Book Scenes" }); }
      const row = results.createDiv("mwc-manuscript-impact-row");
      const open = row.createEl("button", { cls: "mwc-manuscript-impact-scene", text: result.scene.title, attr: { type: "button" } });
      open.onclick = () => {
        const target = plugin.app.vault.getAbstractFileByPath(result.scene.path);
        if (target instanceof TFile) void plugin.app.workspace.getLeaf(false).openFile(target, { active: true });
      };
      const metadata = row.createDiv({ cls: "mwc-muted mwc-manuscript-impact-metadata" });
      if (result.scene.pov) { metadata.createSpan({ text: "POV: " }); renderWikilinkValues(metadata, result.scene.pov, plugin.app, result.scene.path, plugin); metadata.createSpan({ text: " · " }); }
      metadata.createSpan({ text: result.scene.storyDate ? `Story date: ${String(result.scene.storyDate)}` : "Undated" });
      const badges = row.createDiv("mwc-manuscript-impact-evidence");
      for (const evidence of result.evidence) badges.createSpan({ cls: `mwc-manuscript-impact-badge is-${evidence.kind}`, text: evidence.label });
    }
  };
  filter.onchange = render;
  render();
}

function renderManuscriptImpactDisclosure(
  container: Element,
  plugin: MurmurationWritingCompanionPlugin,
  file: TFile
): void {
  if (!plugin.storyWorldIndex.index.getByPath(file.path)) return;
  const collapsible = createPersistedCollapsibleSection(
    container,
    plugin.sidebarSectionPreferences,
    "entityInspectorImpact",
    "Impact Across Manuscript",
    {
      renderContent: (content) => renderManuscriptImpactContent(content, plugin, file),
      renderContentOnEachExpansion: true
    }
  );
  collapsible.section.classList.add(
    "mwc-story-world-inspector-section",
    "mwc-manuscript-impact"
  );
}

function renderRelationshipsDisclosure(
  container: Element,
  plugin: MurmurationWritingCompanionPlugin,
  file: TFile,
  item: StoryWorldBuilderItem
): void {
  const collapsible = createPersistedCollapsibleSection(
    container,
    plugin.sidebarSectionPreferences,
    "entityInspectorRelationships",
    "Relationships",
    {
      renderContent: (content) => renderEntityRelationshipWorkspace(
        content,
        plugin,
        file,
        item,
        { embedded: true }
      )
    }
  );
  collapsible.section.classList.add(
    "mwc-story-world-inspector-section",
    "mwc-entity-relationships-disclosure"
  );
}

export function storyWorldBuilderItemForFile(plugin: MurmurationWritingCompanionPlugin, file: TFile): StoryWorldBuilderItem | null {
  const frontmatter = plugin.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
  return parseStoryWorldBuilderItem({ path: file.path, basename: file.basename, frontmatter });
}

export function renderStoryWorldEntityInspector(container: Element, plugin: MurmurationWritingCompanionPlugin, file: TFile, item: StoryWorldBuilderItem): void {
  container.empty();
  container.addClass("mwc-container", "mwc-story-world-inspector");
  container.createEl("h2", { text: inspectorPanelLabel("entity") });

  const identity = container.createDiv("mwc-section mwc-story-world-inspector-identity");
  const heading = identity.createDiv("mwc-story-world-inspector-heading");
  heading.createEl("h3", { text: item.name });
  const graphHost = plugin as MurmurationWritingCompanionPlugin & { activateStoryWorldGraph?(path?: string): Promise<void> };
  if (graphHost.activateStoryWorldGraph) heading.createEl("button", { text: "Open graph", attr: { type: "button" } }).onclick = () => void graphHost.activateStoryWorldGraph?.(file.path);
  if (item.status) heading.createSpan({ cls: "mwc-story-world-inspector-status", text: item.status });
  identity.createEl("p", { cls: "mwc-story-world-inspector-kind", text: item.kind === "model" ? `Supporting model · ${item.type}` : item.type });

  addText(container, "Summary", item.summary);
  addText(container, "Status note", typeof item.properties.world_status_note === "string" ? item.properties.world_status_note : null);
  if (item.kind === "entity" && item.type.trim().toLowerCase() === "event") renderEventTimeWorkspace(container, plugin, file, item.worldTime);
  else addText(container, "World time", formatTime(item.worldTime));
  addValues(container, "Aliases", item.aliases, plugin, file);
  addValues(container, "Scope", item.scope, plugin, file);
  addValues(container, "First appearance", item.firstAppearance ? [item.firstAppearance] : [], plugin, file);
  addValues(container, "Sources", item.sources, plugin, file);
  addValues(container, "Subject", item.modelSubject, plugin, file);
  if (item.kind === "entity") renderTypedProperties(container, plugin, file, item);
  renderManuscriptImpactDisclosure(container, plugin, file);
  if (item.kind === "entity") renderRelationshipsDisclosure(container, plugin, file, item);
}
