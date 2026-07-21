import { MarkdownRenderer, TFile } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import { parseStoryWorldBuilderItem, StoryWorldBuilderItem } from "../story-world/WorldBuilder";

function listText(values: readonly string[]): string {
  return values.join(" · ");
}

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

function addRow(
  list: HTMLElement,
  label: string,
  value: string | null,
  plugin: MurmurationWritingCompanionPlugin,
  file: TFile,
  markdown = false
): void {
  if (!value) return;
  const row = list.createDiv("mwc-context-row");
  row.createEl("dt", { cls: "mwc-context-label", text: label });
  const content = row.createEl("dd", { cls: "mwc-context-value" });
  if (markdown) {
    void MarkdownRenderer.render(plugin.app, value, content, file.path, plugin);
  } else {
    content.setText(value);
  }
}

export function storyWorldBuilderItemForFile(
  plugin: MurmurationWritingCompanionPlugin,
  file: TFile
): StoryWorldBuilderItem | null {
  const frontmatter = plugin.app.metadataCache.getFileCache(file)?.frontmatter as
    Record<string, unknown> | undefined;
  return parseStoryWorldBuilderItem({ path: file.path, basename: file.basename, frontmatter });
}

export function renderStoryWorldEntityInspector(
  container: Element,
  plugin: MurmurationWritingCompanionPlugin,
  file: TFile,
  item: StoryWorldBuilderItem
): void {
  container.empty();
  container.addClass("mwc-container", "mwc-story-world-inspector");
  container.createEl("h2", { text: "Story World" });

  const identity = container.createDiv("mwc-section mwc-story-world-inspector-identity");
  identity.createEl("h3", { text: item.name });
  identity.createEl("p", {
    cls: "mwc-story-world-inspector-kind",
    text: item.kind === "model" ? `Supporting model · ${item.type}` : item.type
  });
  identity.createEl("p", {
    cls: "mwc-muted",
    text: "Authoritative Markdown remains open in the centre pane."
  });

  const section = container.createDiv("mwc-section mwc-story-world-inspector-properties");
  section.createEl("h3", { text: item.kind === "model" ? "Model Context" : "Entity Context" });
  const list = section.createEl("dl", { cls: "mwc-context-list" });
  addRow(list, "Name", item.name, plugin, file);
  addRow(list, item.kind === "model" ? "Model kind" : "Entity type", item.type, plugin, file);
  addRow(list, "Aliases", item.aliases.length ? listText(item.aliases) : null, plugin, file);
  addRow(list, "Canon status", item.status, plugin, file);
  addRow(list, "Status note", typeof item.properties.world_status_note === "string" ? item.properties.world_status_note : null, plugin, file);
  addRow(list, "Scope", item.scope.length ? listText(item.scope) : null, plugin, file, true);
  addRow(list, "Summary", item.summary, plugin, file);
  addRow(list, "First appearance", item.firstAppearance, plugin, file, true);
  addRow(list, "Sources", item.sources.length ? listText(item.sources) : null, plugin, file, true);
  addRow(list, "Subject", item.modelSubject.length ? listText(item.modelSubject) : null, plugin, file, true);
  addRow(list, "World time", formatTime(item.worldTime), plugin, file);
}
