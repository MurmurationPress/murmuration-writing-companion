import {
  deepEqual,
  doesNotMatch,
  equal,
  match
} from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { test } from "node:test";
import {
  DEFAULT_SIDEBAR_SECTION_STATE,
  SidebarSectionPreferences
} from "../src/companion/SidebarSections";
import { createDeferredSectionRenderer } from "../src/ui/PersistedCollapsibleSection";

class MemoryStorage {
  readonly values = new Map<string, string>();
  writes = 0;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.writes += 1;
    this.values.set(key, value);
  }
}

async function source(file: string): Promise<string> {
  return (await readFile(path.join(process.cwd(), file), "utf8"))
    .replace(/\r\n?/gu, "\n");
}

test("Entity Inspector disclosures default collapsed and persist per vault section", () => {
  equal(DEFAULT_SIDEBAR_SECTION_STATE.entityInspectorImpact, false);
  equal(DEFAULT_SIDEBAR_SECTION_STATE.entityInspectorRelationships, false);
  const storage = new MemoryStorage();
  const preferences = new SidebarSectionPreferences(storage, "inspector-test");

  equal(preferences.isExpanded("entityInspectorImpact"), false);
  equal(preferences.isExpanded("entityInspectorRelationships"), false);
  equal(preferences.setExpanded("entityInspectorImpact", true), true);
  equal(preferences.isExpanded("entityInspectorRelationships"), false);
  equal(storage.writes, 1);

  const restored = new SidebarSectionPreferences(storage, "inspector-test");
  equal(restored.isExpanded("entityInspectorImpact"), true);
  equal(restored.isExpanded("entityInspectorRelationships"), false);
  equal(restored.setExpanded("entityInspectorImpact", false), true);
  equal(new SidebarSectionPreferences(storage, "inspector-test")
    .isExpanded("entityInspectorImpact"), false);
});

test("deferred content can render once or refresh from current source on every expansion", () => {
  const state = { values: [] as string[], emptyCalls: 0 };
  const content = {
    empty: () => {
      state.emptyCalls += 1;
      state.values = [];
    }
  } as unknown as HTMLDivElement;
  let sourceValue = "first";
  let onceCalls = 0;
  const renderOnce = createDeferredSectionRenderer(content, () => {
    onceCalls += 1;
    state.values.push(sourceValue);
  });

  sourceValue = "before first expansion";
  renderOnce();
  sourceValue = "after first expansion";
  renderOnce();
  equal(onceCalls, 1);
  deepEqual(state.values, ["before first expansion"]);
  equal(state.emptyCalls, 0);

  const refreshState = { values: [] as string[], emptyCalls: 0 };
  const refreshingContent = {
    empty: () => {
      refreshState.emptyCalls += 1;
      refreshState.values = [];
    }
  } as unknown as HTMLDivElement;
  let current = "initial projection";
  let refreshCalls = 0;
  const renderCurrent = createDeferredSectionRenderer(refreshingContent, () => {
    refreshCalls += 1;
    refreshState.values.push(current);
  }, true);

  renderCurrent();
  current = "changed while collapsed";
  renderCurrent();
  equal(refreshCalls, 2);
  equal(refreshState.emptyCalls, 1);
  deepEqual(refreshState.values, ["changed while collapsed"]);
});

test("Impact disclosure lazily owns the complete existing projection and navigation UI", async () => {
  const inspector = await source("src/ui/StoryWorldEntityInspector.ts");
  const content = inspector.match(
    /function renderManuscriptImpactContent[\s\S]*?\n\}\n\nfunction renderManuscriptImpactDisclosure/u
  )?.[0] ?? "";
  const disclosure = inspector.match(
    /function renderManuscriptImpactDisclosure[\s\S]*?\n\}\n\nfunction renderRelationshipsDisclosure/u
  )?.[0] ?? "";

  match(disclosure, /createPersistedCollapsibleSection\(/u);
  match(disclosure, /"entityInspectorImpact"/u);
  match(disclosure, /"Impact Across Manuscript"/u);
  match(disclosure, /renderContent: \(content\) => renderManuscriptImpactContent/u);
  match(disclosure, /renderContentOnEachExpansion: true/u);
  doesNotMatch(disclosure, /buildObsidianStoryWorldManuscriptImpact/u);

  match(content, /buildObsidianStoryWorldManuscriptImpact\(/u);
  match(content, /aria-label": "Filter manuscript impact"/u);
  match(content, /mwc-manuscript-impact-results/u);
  match(content, /mwc-manuscript-impact-scene/u);
  match(content, /openFile\(target, \{ active: true \}\)/u);
  match(content, /mwc-manuscript-impact-evidence/u);
  match(content, /temporalUnavailableReason/u);
});

test("Relationships uses the same disclosure and embeds the unchanged workspace once", async () => {
  const inspector = await source("src/ui/StoryWorldEntityInspector.ts");
  const relationships = await source("src/ui/EntityRelationshipWorkspace.ts");
  const disclosure = inspector.match(
    /function renderRelationshipsDisclosure[\s\S]*?\n\}\n\nexport function storyWorldBuilderItemForFile/u
  )?.[0] ?? "";

  match(disclosure, /createPersistedCollapsibleSection\(/u);
  match(disclosure, /"entityInspectorRelationships"/u);
  match(disclosure, /"Relationships"/u);
  match(disclosure, /renderEntityRelationshipWorkspace\([\s\S]*?\{ embedded: true \}/u);
  doesNotMatch(disclosure, /renderContentOnEachExpansion/u);
  match(relationships, /if \(!options\.embedded\) heading\.createEl\("h3", \{ text: "Relationships" \}\)/u);
  match(relationships, /text: "Add relationship"/u);
  match(relationships, /text: "Edit"/u);
  match(relationships, /text: "Remove"/u);
});

test("Inspector identity and ordinary details stay outside disclosure state without writes", async () => {
  const inspector = await source("src/ui/StoryWorldEntityInspector.ts");
  const render = inspector.match(
    /export function renderStoryWorldEntityInspector[\s\S]*$/u
  )?.[0] ?? "";

  match(render, /mwc-story-world-inspector-identity/u);
  match(render, /text: "Open graph"/u);
  match(render, /addText\(container, "Summary", item\.summary\)/u);
  match(render, /renderEventTimeWorkspace\(container/u);
  match(render, /renderTypedProperties\(container/u);
  match(render, /renderManuscriptImpactDisclosure\(container/u);
  doesNotMatch(inspector, /processFrontMatter|vault\.modify|vault\.create/u);
});
