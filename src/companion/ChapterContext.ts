export interface ChapterContextItem {
  label: string;
  value: string;
  property: string;
}

interface ChapterContextField {
  label: string;
  aliases: string[];
}

const CHAPTER_CONTEXT_FIELDS: ChapterContextField[] = [
  {
    label: "POV",
    aliases: ["pov", "point_of_view", "viewpoint"]
  },
  {
    label: "Story date",
    aliases: ["story_date", "storydate", "story_day", "narrative_date"]
  },
  {
    label: "Chapter status",
    aliases: ["chapter_status", "status"]
  },
  {
    label: "Current pass",
    aliases: ["current_editorial_pass", "editorial_pass", "current_pass", "editing_pass", "pass"]
  },
  {
    label: "Change summary",
    aliases: ["change_summary", "changes", "what_changed", "whats_changed", "change_log"]
  }
];

function normalizePropertyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function formatPropertyValue(value: unknown): string | null {
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

export function getChapterContextItems(
  frontmatter: Record<string, unknown> | undefined
): ChapterContextItem[] {
  if (!frontmatter) return [];

  const properties = new Map<string, { property: string; value: unknown }>();

  for (const [property, value] of Object.entries(frontmatter)) {
    if (property === "position") continue;

    properties.set(normalizePropertyName(property), {
      property,
      value
    });
  }

  const items: ChapterContextItem[] = [];

  for (const field of CHAPTER_CONTEXT_FIELDS) {
    for (const alias of field.aliases) {
      const match = properties.get(normalizePropertyName(alias));
      if (!match) continue;

      const value = formatPropertyValue(match.value);
      if (value !== null) {
        items.push({
          label: field.label,
          value,
          property: match.property
        });
      }

      break;
    }
  }

  return items;
}
