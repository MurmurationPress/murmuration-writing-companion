import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  CHAPTER_STATUS_OPTIONS,
  EDITABLE_CHAPTER_CONTEXT_FIELDS,
  EDITORIAL_PASS_OPTIONS,
  findAliasedProperty,
  findEditableChapterContextProperty,
  formatPropertyValue,
  getChapterContextInputType,
  getChapterContextSelectOptions,
  getEditableChapterContextValue,
  normalizePropertyName,
  updateEditableChapterContextFrontmatter
} from "../src/companion/ChapterContext";

function field(key: string) {
  const match = EDITABLE_CHAPTER_CONTEXT_FIELDS.find((item) => item.key === key);
  if (!match) throw new Error(`Missing Chapter Context field: ${key}`);
  return match;
}

test("normalizes property names consistently", () => {
  equal(normalizePropertyName(" Story Date "), "story_date");
  equal(normalizePropertyName("point-of-view"), "point_of_view");
  equal(normalizePropertyName("EDITORIAL PASS"), "editorial_pass");
});

test("formats supported frontmatter values", () => {
  equal(formatPropertyValue("  Tobias  "), "Tobias");
  equal(formatPropertyValue("   "), null);
  equal(formatPropertyValue(3), "3");
  equal(formatPropertyValue(false), "false");
  equal(formatPropertyValue(new Date("2032-04-01T12:30:00Z")), "2032-04-01");
  equal(formatPropertyValue(["Pip", " Tobias ", ""]), "Pip, Tobias");
  equal(formatPropertyValue({ value: "unsupported" }), null);
});

test("resolves existing aliases without replacing their spelling", () => {
  const frontmatter = {
    "Point Of View": "[[Tobias]]",
    StoryDate: "2032-04-01",
    Status: "revision",
    "Current Pass": "continuity"
  };

  deepEqual(getEditableChapterContextValue(frontmatter, field("pov")), {
    property: "Point Of View",
    value: "[[Tobias]]"
  });

  deepEqual(getEditableChapterContextValue(frontmatter, field("story_date")), {
    property: "StoryDate",
    value: "2032-04-01"
  });

  deepEqual(getEditableChapterContextValue(frontmatter, field("chapter_status")), {
    property: "Status",
    value: "revision"
  });

  deepEqual(getEditableChapterContextValue(frontmatter, field("editorial_pass")), {
    property: "Current Pass",
    value: "continuity"
  });
});

test("falls back to canonical property names when aliases are absent", () => {
  equal(findEditableChapterContextProperty({}, field("title")), "title");
  equal(findEditableChapterContextProperty({}, field("chapter_status")), "chapter_status");
  equal(findEditableChapterContextProperty({}, field("editorial_pass")), "editorial_pass");
});

test("does not treat the distinct story_day property as a story_date alias", () => {
  const frontmatter: Record<string, unknown> = {
    story_day: 1017,
    story_date: "2028-05-02"
  };
  deepEqual(getEditableChapterContextValue(frontmatter, field("story_date")), {
    property: "story_date",
    value: "2028-05-02"
  });
  updateEditableChapterContextFrontmatter(frontmatter, field("story_date"), "2028-05-03");
  equal(frontmatter.story_day, 1017);
  equal(frontmatter.story_date, "2028-05-03");
});

test("story_day alone does not populate or parse as story_date", () => {
  deepEqual(getEditableChapterContextValue(
    { story_day: 1023 },
    field("story_date")
  ), { property: "story_date", value: "" });
  equal(findAliasedProperty({ story_day: 1023 }, field("story_date").aliases), null);
});

test("canonical story_date remains recognised normally", () => {
  deepEqual(getEditableChapterContextValue(
    { story_date: "2028-05-06" },
    field("story_date")
  ), { property: "story_date", value: "2028-05-06" });
});

test("legacy date aliases resolve without mapping story_day", () => {
  deepEqual(findAliasedProperty(
    { story_day: 1023, storydate: "2028-05-06" },
    field("story_date").aliases
  ), { property: "storydate", value: "2028-05-06" });
  equal(field("story_date").aliases.includes("story_day"), false);
});

test("uses a date input only for empty or ISO date values", () => {
  const storyDate = field("story_date");

  equal(getChapterContextInputType(storyDate, ""), "date");
  equal(getChapterContextInputType(storyDate, "2032-04-01"), "date");
  equal(getChapterContextInputType(storyDate, "1 April 2032"), "text");
  equal(getChapterContextInputType(field("title"), "2032-04-01"), "text");
});

test("defines chapter statuses in the agreed order", () => {
  deepEqual([...CHAPTER_STATUS_OPTIONS], [
    "idea",
    "draft",
    "revision",
    "complete"
  ]);
});

test("builds title-cased chapter status choices with lowercase values", () => {
  deepEqual(getChapterContextSelectOptions(field("chapter_status"), "draft"), [
    { value: "", label: "—" },
    { value: "idea", label: "Idea" },
    { value: "draft", label: "Draft" },
    { value: "revision", label: "Revision" },
    { value: "complete", label: "Complete" }
  ]);

  equal(getChapterContextSelectOptions(field("title"), "Chapter One"), null);
});

test("preserves an unknown current status until the author changes it", () => {
  deepEqual(getChapterContextSelectOptions(field("chapter_status"), "copy edit"), [
    { value: "", label: "—" },
    { value: "copy edit", label: "copy edit (current)", preserved: true },
    { value: "idea", label: "Idea" },
    { value: "draft", label: "Draft" },
    { value: "revision", label: "Revision" },
    { value: "complete", label: "Complete" }
  ]);
});

test("writes known statuses through an existing alias", () => {
  const frontmatter: Record<string, unknown> = {
    title: "A Chapter",
    Status: "draft"
  };

  equal(
    updateEditableChapterContextFrontmatter(
      frontmatter,
      field("chapter_status"),
      "revision"
    ),
    "Status"
  );
  deepEqual(frontmatter, {
    title: "A Chapter",
    Status: "revision"
  });
});

test("clearing chapter status removes its property and duplicate aliases", () => {
  const frontmatter: Record<string, unknown> = {
    title: "A Chapter",
    chapter_status: "draft",
    Status: "idea"
  };

  updateEditableChapterContextFrontmatter(
    frontmatter,
    field("chapter_status"),
    ""
  );

  deepEqual(frontmatter, { title: "A Chapter" });
});

test("defines editorial passes in the canonical workflow order", () => {
  deepEqual([...EDITORIAL_PASS_OPTIONS], [
    "draft",
    "structure",
    "character",
    "dialogue",
    "continuity",
    "style",
    "proof"
  ]);
});

test("builds title-cased editorial pass choices with lowercase values", () => {
  deepEqual(getChapterContextSelectOptions(field("editorial_pass"), "continuity"), [
    { value: "", label: "—" },
    { value: "draft", label: "Draft" },
    { value: "structure", label: "Structure" },
    { value: "character", label: "Character" },
    { value: "dialogue", label: "Dialogue" },
    { value: "continuity", label: "Continuity" },
    { value: "style", label: "Style" },
    { value: "proof", label: "Proof" }
  ]);
});

test("preserves an unknown editorial pass until deliberately replaced", () => {
  deepEqual(getChapterContextSelectOptions(field("editorial_pass"), "line edit"), [
    { value: "", label: "—" },
    { value: "line edit", label: "line edit (current)", preserved: true },
    { value: "draft", label: "Draft" },
    { value: "structure", label: "Structure" },
    { value: "character", label: "Character" },
    { value: "dialogue", label: "Dialogue" },
    { value: "continuity", label: "Continuity" },
    { value: "style", label: "Style" },
    { value: "proof", label: "Proof" }
  ]);
});

test("writes editorial passes through an existing alias without touching checklist data", () => {
  const completedPasses = {
    structure: { completed: "2026-07-01T10:00:00Z" }
  };
  const frontmatter: Record<string, unknown> = {
    title: "A Chapter",
    "Current Pass": "structure",
    completed_editorial_passes: completedPasses
  };

  equal(
    updateEditableChapterContextFrontmatter(
      frontmatter,
      field("editorial_pass"),
      "continuity"
    ),
    "Current Pass"
  );
  deepEqual(frontmatter, {
    title: "A Chapter",
    "Current Pass": "continuity",
    completed_editorial_passes: completedPasses
  });
});

test("clearing editorial pass removes aliases and leaves unrelated data intact", () => {
  const frontmatter: Record<string, unknown> = {
    title: "A Chapter",
    editorial_pass: "continuity",
    "Current Pass": "dialogue",
    chapter_status: "revision"
  };

  updateEditableChapterContextFrontmatter(
    frontmatter,
    field("editorial_pass"),
    ""
  );

  deepEqual(frontmatter, {
    title: "A Chapter",
    chapter_status: "revision"
  });
});
