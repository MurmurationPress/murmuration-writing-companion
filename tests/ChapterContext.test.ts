import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  CHAPTER_STATUS_OPTIONS,
  EDITABLE_CHAPTER_CONTEXT_FIELDS,
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
    Status: "revision"
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
});

test("falls back to canonical property names when aliases are absent", () => {
  equal(findEditableChapterContextProperty({}, field("title")), "title");
  equal(findEditableChapterContextProperty({}, field("chapter_status")), "chapter_status");
  equal(findEditableChapterContextProperty({}, field("editorial_pass")), "editorial_pass");
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

test("builds a blank option followed by the known chapter statuses", () => {
  deepEqual(getChapterContextSelectOptions(field("chapter_status"), "draft"), [
    { value: "", label: "—" },
    { value: "idea", label: "idea" },
    { value: "draft", label: "draft" },
    { value: "revision", label: "revision" },
    { value: "complete", label: "complete" }
  ]);

  equal(getChapterContextSelectOptions(field("title"), "Chapter One"), null);
});

test("preserves an unknown current status until the author changes it", () => {
  deepEqual(getChapterContextSelectOptions(field("chapter_status"), "copy edit"), [
    { value: "", label: "—" },
    { value: "copy edit", label: "copy edit (current)", preserved: true },
    { value: "idea", label: "idea" },
    { value: "draft", label: "draft" },
    { value: "revision", label: "revision" },
    { value: "complete", label: "complete" }
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
