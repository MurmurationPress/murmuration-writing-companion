import { equal } from "node:assert/strict";
import { test } from "node:test";
import {
  inspectorPanelLabel,
  STORY_WORLD_NAVIGATOR_LABEL,
  STORY_WORLD_TIMELINE_LABEL
} from "../src/ui/PanelLabels";

test("uses panel-role labels for the Story World views", () => {
  equal(STORY_WORLD_NAVIGATOR_LABEL, "Story World Navigator");
  equal(STORY_WORLD_TIMELINE_LABEL, "Story World Timeline");
});

test("switches the inspector label with the active Markdown role", () => {
  equal(inspectorPanelLabel("chapter"), "Writing Companion");
  equal(inspectorPanelLabel("entity"), "Entity Inspector");
});
