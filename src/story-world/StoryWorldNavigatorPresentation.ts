export type StoryWorldNavigatorStatusKind = "confirmed" | "planned" | "candidate" | "unresolved" | "superseded" | "neutral";

export interface StoryWorldNavigatorStatusPresentation {
  readonly kind: StoryWorldNavigatorStatusKind;
  readonly accessibleLabel: string;
  readonly visibleLabel: string | null;
}

/** Presentation-only status treatment; authoritative stored values remain untouched. */
export function storyWorldNavigatorStatus(status: string | null): StoryWorldNavigatorStatusPresentation {
  const value = status?.trim() ?? "";
  if (!value) return { kind: "neutral", accessibleLabel: "Unspecified", visibleLabel: "Unspecified" };
  const readable = value[0].toUpperCase() + value.slice(1);
  const normalized = value.toLowerCase();
  if (normalized === "confirmed") return { kind: "confirmed", accessibleLabel: readable, visibleLabel: null };
  const kind: StoryWorldNavigatorStatusKind = ["planned", "candidate", "unresolved", "superseded"].includes(normalized)
    ? normalized as StoryWorldNavigatorStatusKind
    : "neutral";
  return { kind, accessibleLabel: readable, visibleLabel: readable };
}
