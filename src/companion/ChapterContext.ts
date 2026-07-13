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
  options?: readonly string[];
  optionLabels?: Readonly<Record<string, string>>;
  renderMarkdownPreview?: boolean;
}

export interface ChapterContextSelectOption {
  value: string;
  label: string;
  preserved?: boolean;
}

export const CHAPTER_STATUS_OPTIONS = [
  "idea",
  "draft",
  "revision",
  "complete"
] as const;

const CHAPTER_STATUS_LABELS: Readonly<Record<string, string>> = {
  idea: "Idea",
  draft: "Draft",
  revision: "Revision",
  complete: "Complete"
};

export const EDITORIAL_PASS_OPTIONS = [
  "draft",
  "structure",
  "character",
  "dialogue",
  "continuity",
  "style",
  "proof"
] as const;

const EDITORIAL_PASS_LABELS: Readonly<Record<string, string>> = {
  draft: "Draft",
  structure: "Structure",
  character: "Character",
  dialogue: "Dialogue",
  continuity: "Continuity",
  style: "Style",
  proof: "Proof"
};

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
    placeholder: "Select status…",
    options: CHAPTER_STATUS_OPTIONS,
    optionLabels: CHAPTER_STATUS_LABELS
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
    placeholder: "Select editorial pass…",
    options: EDITORIAL_PASS_OPTIONS,
    optionLabels: EDITORIAL_PASS_LABELS
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

export function updateEditableChapterContextFrontmatter(
  frontmatter: Record<string, unknown>,
  field: EditableChapterContextField,
  value: string
): string {
  const property = findEditableChapterContextProperty(frontmatter, field);

  for (const existingProperty of Object.keys(frontmatter)) {
    if (existingProperty === property) continue;

    const isAlias = field.aliases.some(
      (alias) => normalizePropertyName(alias) === normalizePropertyName(existingProperty)
    );

    if (isAlias) delete frontmatter[existingProperty];
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length > 0) {
    frontmatter[property] = normalizedValue;
  } else {
    delete frontmatter[property];
  }

  return property;
}

export function getChapterContextInputType(
  field: EditableChapterContextField,
  value: string
): "text" | "date" {
  if (field.inputType !== "date") return "text";

  const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return value.length === 0 || isIsoDate ? "date" : "text";
}

export function getChapterContextSelectOptions(
  field: EditableChapterContextField,
  currentValue: string
): ChapterContextSelectOption[] | null {
  if (!field.options) return null;

  const options: ChapterContextSelectOption[] = [
    { value: "", label: "—" }
  ];
  const normalizedCurrent = currentValue.trim();
  const knownCurrent = field.options.includes(normalizedCurrent);

  if (normalizedCurrent.length > 0 && !knownCurrent) {
    options.push({
      value: normalizedCurrent,
      label: `${normalizedCurrent} (current)`,
      preserved: true
    });
  }

  for (const option of field.options) {
    options.push({
      value: option,
      label: field.optionLabels?.[option] ?? option
    });
  }

  return options;
}
