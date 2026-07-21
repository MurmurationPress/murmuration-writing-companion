import { MarkdownRenderer, TFile } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import { parseStoryWorldBuilderItem, StoryWorldBuilderItem } from "../story-world/WorldBuilder";
import { renderEntityRelationshipWorkspace } from "./EntityRelationshipWorkspace";
import { renderEventTimeWorkspace } from "./EventTimeWorkspace";

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
    void MarkdownRenderer.render(plugin.app, value, item, file.path, plugin);
  }
}

export function storyWorldBuilderItemForFile(plugin: MurmurationWritingCompanionPlugin, file: TFile): StoryWorldBuilderItem | null {
  const frontmatter = plugin.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
  return parseStoryWorldBuilderItem({ path: file.path, basename: file.basename, frontmatter });
}

export function renderStoryWorldEntityInspector(container: Element, plugin: MurmurationWritingCompanionPlugin, file: TFile, item: StoryWorldBuilderItem): void {
  container.empty();
  container.addClass("mwc-container", "mwc-story-world-inspector");
  container.createEl("h2", { text: "Story World" });

  const identity = container.createDiv("mwc-section mwc-story-world-inspector-identity");
  const heading = identity.createDiv("mwc-story-world-inspector-heading");
  heading.createEl("h3", { text: item.name });
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
  if (item.kind === "entity") renderEntityRelationshipWorkspace(container, plugin, file, item);
}
