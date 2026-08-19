import {
  doesNotMatch,
  equal,
  match
} from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { test } from "node:test";
import {
  DEFAULT_SIDEBAR_SECTION_STATE,
  parseSidebarSectionState,
  SidebarSectionPreferences
} from "../src/companion/SidebarSections";

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

async function viewSource(): Promise<string> {
  return (await readFile(
    path.join(process.cwd(), "src/companion/CollapsibleWritingCompanionView.ts"),
    "utf8"
  )).replace(/\r\n?/g, "\n");
}

test("POV Guidance is expanded by default and persists independently", () => {
  equal(DEFAULT_SIDEBAR_SECTION_STATE.povGuidance, true);
  const storage = new MemoryStorage();
  const preferences = new SidebarSectionPreferences(storage, "pov-guidance-test");

  preferences.setExpanded("povGuidance", false);
  equal(preferences.isExpanded("povGuidance"), false);
  equal(preferences.isExpanded("worldContext"), false);
  equal(preferences.isExpanded("editorialPasses"), false);

  const restored = new SidebarSectionPreferences(storage, "pov-guidance-test");
  equal(restored.isExpanded("povGuidance"), false);
  restored.setExpanded("povGuidance", true);
  equal(restored.isExpanded("povGuidance"), true);
});

test("older sidebar preferences inherit the expanded POV Guidance default", () => {
  const parsed = parseSidebarSectionState(JSON.stringify({
    version: 1,
    expanded: { chapterContext: false, worldContext: true }
  }));
  equal(parsed.povGuidance, true);
  equal(parsed.chapterContext, false);
  equal(parsed.worldContext, true);
  equal(parsed.entityInspectorImpact, false);
  equal(parsed.entityInspectorRelationships, false);
});

test("one standard disclosure contains every effective profile and diagnostic", async () => {
  const source = await viewSource();
  const method = source.match(
    /private renderPovGuidance\([\s\S]*?\n  \}\n\n  private renderCollapsibleWorldContext/u
  )?.[0] ?? "";

  match(method, /resolvePovProfileChain\(/u);
  match(method, /this\.createCollapsibleSection\(\s*container,\s*"povGuidance",\s*"POV Guidance"/u);
  equal((method.match(/createCollapsibleSection\(/gu) ?? []).length, 1);
  match(method, /for \(const profileSection of guidance\.sections\)[\s\S]*?content\.createDiv\("mwc-pov-guidance-profile"\)/u);
  match(method, /povProfileResolutionIssueMessage\(guidance\.issues\)[\s\S]*?content\.createEl/u);
  match(method, /content\.createEl\("p", \{[\s\S]*?POV guidance could not be read/u);
  doesNotMatch(method, /processFrontMatter|vault\.modify|vault\.create/u);
});

test("each active-scene render resolves guidance before applying saved disclosure state", async () => {
  const source = await viewSource();
  const render = source.match(/override render\(\) \{(?<body>[\s\S]*?)\n  \}\n\n  private renderCollapsibleChapterContext/u)?.groups?.body ?? "";
  const method = source.match(
    /private renderPovGuidance\([\s\S]*?\n  \}\n\n  private renderCollapsibleWorldContext/u
  )?.[0] ?? "";

  match(render, /this\.renderPovGuidance\(container, file, frontmatter\)/u);
  match(method, /const resolution = resolvePovProfileChain\(/u);
  match(method, /const collapsible = this\.createCollapsibleSection\(/u);
  match(method, /if \(!container\.contains\(section\)\) return/u);
});
