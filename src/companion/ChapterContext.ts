export type ChapterContextFieldKey =
  | "title"
  | "pov"
  | "story_date"
  | "chapter_status"
  | "editorial_pass"
  | "change_summary";

export interface EditableChapterContextField {
  key: ChapterContextFieldKey;
  label: string;
  aliases: string[];
  placeholder: string;
  multiline?: boolean;
  inputType?: "text" | "date";
  renderMarkdownPreview?: boolean;
}

export const EDITABLE_CHAPTER_CONTEXT_FIELDS: EditableChapterContextField[] = [
  {
    key: "title",
    label: "Title",
    aliases: ["title"],
    placeholder: "Chapter title…"
  },
  {
    key: "pov",
    label: "POV",
    aliases: ["pov", "point_of_view", "viewpoint"],
    placeholder: "Character or [[link]]…",
    renderMarkdownPreview: true
  },
  {
    key: "story_date",
    label: "Story date",
    aliases: ["story_date", "storydate", "story_day", "narrative_date"],
    placeholder: "YYYY-MM-DD",
    inputType: "date"
  },
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

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
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

export function getChapterContextInputType(
  field: EditableChapterContextField,
  value: string
): "text" | "date" {
  if (field.inputType !== "date") return "text";

  const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return value.length === 0 || isIsoDate ? "date" : "text";
}
