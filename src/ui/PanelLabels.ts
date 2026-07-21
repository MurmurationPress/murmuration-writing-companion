export const STORY_WORLD_NAVIGATOR_LABEL = "Story World Navigator";
export const STORY_WORLD_TIMELINE_LABEL = "Story World Timeline";

export type InspectorPanelRole = "chapter" | "entity";

export function inspectorPanelLabel(role: InspectorPanelRole): "Writing Companion" | "Entity Inspector" {
  return role === "entity" ? "Entity Inspector" : "Writing Companion";
}
