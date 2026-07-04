export interface ChapterContextItem {
  label: string;
  value: string;
  property: string;
}

export interface EditableChapterContextField {
  key: "chapter_status" | "editorial_pass" | "change_summary";
  label: string;
  aliases: string[];
  placeholder: string;
  multiline?: boolean;
}

interface ChapterContextField {
  label: string;
  aliases: string[];
}

const READ_ONLY_CHAPTER_CONTEXT_FIELDS: ChapterContextField[] = [
  {
    label: "POV",
    aliases: ["pov", "point_of_view", "viewpoint"]
  },
  {
    label: "Story date",
    aliases: ["story_date", "storydate", "story_day", "narrative_date"]
  }
];

export const EDITABLE_CHAPTER_CONTEXT_FIELDS: EditableChapterContextField[] = [
  {
    key: "chapter_status",
    label: "Chapter status",
    aliases: ["chapter_status", "status"],
    placeholder: "Draft, revision, complete…"
  },
  {
    key: "editorial_pass",
    label: "Editorial pass",
    aliases: [
      "editorial_pass",
      "current_editorial_pass",
      "current_pass",
      "editing_pass",
      "pass"
    ],
    placeholder: "Structure, continuity, line edit…"
  },
  {
    key: "change_summary",
    label: "Change summary",
    aliases: [
      "change_summary",
      "changes",
      "what_changed",
      "whats_changed",
      "change_log"
    ],
    placeholder: "What needs to change, or what changed in this pass…",
    multiline: true
  }
];

export function normalizePropertyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function formatPropertyValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const values = value
      .map(formatPropertyValue)
      .filter((item): item is string => item !== null);

    return values.length > 0 ? values.join(", ") : null;
  }

  return null;
}

function findProperty(
  frontmatter: Record<string, unknown> | undefined,
  aliases: string[]
): { property: string; value: unknown } | null {
  if (!frontmatter) return null;

  const properties = new Map<string, { property: string; value: unknown }>();

  for (const [property, value] of Object.entries(frontmatter)) {
    if (property === "position") continue;

    properties.set(normalizePropertyName(property), {
      property,
      value
    });
  }

  for (const alias of aliases) {
    const match = properties.get(normalizePropertyName(alias));
    if (match) return match;
  }

  return null;
}

export function getChapterContextItems(
  frontmatter: Record<string, unknown> | undefined
): ChapterContextItem[] {
  const items: ChapterContextItem[] = [];

  for (const field of READ_ONLY_CHAPTER_CONTEXT_FIELDS) {
    const match = findProperty(frontmatter, field.aliases);
    if (!match) continue;

    const value = formatPropertyValue(match.value);
    if (value === null) continue;

    items.push({
      label: field.label,
      value,
      property: match.property
    });
  }

  return items;
}

export function getEditableChapterContextValue(
  frontmatter: Record<string, unknown> | undefined,
  field: EditableChapterContextField
): { property: string; value: string } {
  const match = findProperty(frontmatter, field.aliases);

  return {
    property: match?.property ?? field.key,
    value: formatPropertyValue(match?.value) ?? ""
  };
}

export function findEditableChapterContextProperty(
  frontmatter: Record<string, unknown>,
  field: EditableChapterContextField
): string {
  return findProperty(frontmatter, field.aliases)?.property ?? field.key;
}
