import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  buildManuscriptOrder,
  ManuscriptDocumentRecord
} from "../src/manuscript/ManuscriptOrder";
import {
  explicitManuscriptKind,
  formatNavigatorStoryDate,
  manuscriptDisplayTitle,
  manuscriptSceneMetadata
} from "../src/manuscript/ManuscriptMetadata";
import {
  findLegacyOwningBookPath,
  findLegacyParentPath,
  isTemplateManuscriptPath
} from "../src/manuscript/LegacyManuscriptHierarchy";

function record(
  path: string,
  title: string,
  kind: ManuscriptDocumentRecord["kind"],
  bookPath: string,
  parentPath: string | null
): ManuscriptDocumentRecord {
  return {
    path,
    basename: path.split("/").pop()!.replace(/\.md$/i, ""),
    title,
    kind,
    bookPath,
    parentPath
  };
}

test("parts are optional and direct book scenes remain ordered roots", () => {
  const bookPath = "Books/EMERGENCE.md";
  const book = record(bookPath, "EMERGENCE", "book", bookPath, null);
  const first = record(
    "Books/Scenes/1 Field Research.md",
    "Field Research",
    "scene",
    bookPath,
    bookPath
  );
  const second = record(
    "Books/Scenes/2 Strange Conversation.md",
    "Strange Conversation",
    "scene",
    bookPath,
    bookPath
  );
  const lookup = new Map([
    ["field research", first],
    ["strange conversation", second]
  ]);

  const result = buildManuscriptOrder(
    book,
    {
      manuscript_order: [
        "[[Field Research]]",
        "[[Strange Conversation]]"
      ]
    },
    [book, first, second],
    (linkpath) => lookup.get(linkpath.toLowerCase()) ?? null
  );

  equal(result.source, "explicit");
  deepEqual(result.scenes.map((scene) => scene.title), [
    "Field Research",
    "Strange Conversation"
  ]);
  deepEqual(result.roots.map((node) => node.entry.title), [
    "Field Research",
    "Strange Conversation"
  ]);
});

test("recognises explicit book, part and scene vocabulary", () => {
  equal(explicitManuscriptKind({ type: "book" }), "book");
  equal(explicitManuscriptKind({ manuscript_type: "part" }), "part");
  equal(explicitManuscriptKind({ document_type: "chapter" }), "scene");
  equal(explicitManuscriptKind({ type: "scene", book: 2, Part: 1 }), "scene");
  equal(explicitManuscriptKind({ type: "research" }), null);
});

test("uses title metadata and removes legacy prefixes only from fallback display", () => {
  equal(
    manuscriptDisplayTitle({
      path: "Scenes/1 Filename.md",
      basename: "1 Filename",
      frontmatter: { title: "Displayed Chapter" }
    }),
    "Displayed Chapter"
  );
  equal(
    manuscriptDisplayTitle({
      path: "Scenes/12 Quiet Contact.md",
      basename: "12 Quiet Contact"
    }),
    "Quiet Contact"
  );
});

test("collects only available secondary scene metadata", () => {
  deepEqual(
    manuscriptSceneMetadata({
      pov: "[[Tobias Hale]]",
      story_date: "2029-01-12",
      chapter_status: "revision",
      editorial_pass: "continuity"
    }),
    {
      pov: "[[Tobias Hale]]",
      storyDate: "2029-01-12",
      chapterStatus: "revision",
      editorialPass: "continuity"
    }
  );
  deepEqual(manuscriptSceneMetadata(undefined), {
    pov: null,
    storyDate: null,
    chapterStatus: null,
    editorialPass: null
  });
});

test("formats valid ISO story dates without shifting calendar day", () => {
  equal(
    formatNavigatorStoryDate("2026-07-16"),
    "Thursday, 16 July 2026"
  );
  equal(formatNavigatorStoryDate("Spring 2029"), "Spring 2029");
  equal(formatNavigatorStoryDate("2026-02-30"), "2026-02-30");
  equal(formatNavigatorStoryDate(null), null);
});

test("derives existing Longform-style book, part and scene hierarchy from folder notes", () => {
  const bookPath = "PRIME Trilogy/BOOK 2 - PLURALITY.md";
  const bookFolder = "PRIME Trilogy/BOOK 2 - PLURALITY";
  const partPath = `${bookFolder}/1 ABSENCE.md`;
  const partFolder = `${bookFolder}/1 ABSENCE`;
  const directScenePath = `${bookFolder}/0 Prologue.md`;
  const nestedScenePath = `${partFolder}/11 Convergence.md`;
  const books = [{ bookPath, folderPath: bookFolder }];
  const folderNotes = new Map([
    [bookFolder, bookPath],
    [partFolder, partPath]
  ]);

  equal(findLegacyOwningBookPath(nestedScenePath, books), bookPath);
  equal(findLegacyOwningBookPath(directScenePath, books), bookPath);
  equal(
    findLegacyParentPath(partPath, bookPath, bookFolder, folderNotes),
    bookPath
  );
  equal(
    findLegacyParentPath(directScenePath, bookPath, bookFolder, folderNotes),
    bookPath
  );
  equal(
    findLegacyParentPath(nestedScenePath, bookPath, bookFolder, folderNotes),
    partPath
  );
});

test("excludes manuscript templates from book selection without configuration", () => {
  equal(isTemplateManuscriptPath("Templates/Codex Press/Book.md"), true);
  equal(isTemplateManuscriptPath("PRIME Trilogy/Templates/Book Template.md"), true);
  equal(isTemplateManuscriptPath("PRIME Trilogy/BOOK 2 - PLURALITY.md"), false);
});
