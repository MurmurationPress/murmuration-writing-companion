import { deepEqual, equal, match } from "node:assert/strict";
import { test } from "node:test";
import {
  manuscriptBookDefaultFolder,
  manuscriptBookDefaultPath,
  planManuscriptBookCreation,
  serializeManuscriptBook,
  suggestManuscriptBookFilename
} from "../src/manuscript/ManuscriptBookCreation";

const books = [
  { path: "PRIME/EMERGENCE.md", title: "EMERGENCE" },
  { path: "PRIME/PLURALITY.md", title: "PLURALITY" }
];

function plan(overrides: Partial<Parameters<typeof planManuscriptBookCreation>[0]> = {}) {
  return planManuscriptBookCreation({
    title: "FEVER",
    path: "PRIME/FEVER.md",
    books,
    entries: [
      { path: "PRIME", kind: "folder" },
      ...books.map((book) => ({ path: book.path, kind: "file" as const }))
    ],
    ...overrides
  });
}

test("serializes the exact minimal authoritative book contract with safe YAML quoting", () => {
  equal(serializeManuscriptBook("Book 4: \"Fever\" #1"),
    "---\ntype: book\ntitle: \"Book 4: \\\"Fever\\\" #1\"\n---\n");
  equal(plan().markdown, "---\ntype: book\ntitle: \"FEVER\"\n---\n");
});

test("preserves trimmed Unicode and punctuation in title independently from filename", () => {
  const result = plan({ title: "  Fièvre: Book 四?  ", path: "PRIME/Fièvre- Book 四-.md" });
  equal(result.title, "Fièvre: Book 四?");
  match(result.markdown, /title: "Fièvre: Book 四\?"/);
  equal(result.path, "PRIME/Fièvre- Book 四-.md");
});

test("sanitizes only suggested filenames and explains changes", () => {
  const suggestion = suggestManuscriptBookFilename("Fièvre: Book 四?");
  equal(suggestion.filename, "Fièvre- Book 四-.md");
  match(suggestion.explanation ?? "", /replaced with hyphens/);
  equal(manuscriptBookDefaultPath("PRIME", "Book.md").path, "PRIME/Book.md");
});

test("chooses common book parent, then selected parent, then vault root", () => {
  equal(manuscriptBookDefaultFolder(books, books[0].path), "PRIME");
  const split = [books[0], { path: "Other/PLURALITY.md", title: "PLURALITY" }];
  equal(manuscriptBookDefaultFolder(split, books[0].path), "PRIME");
  equal(manuscriptBookDefaultFolder(split, null), "");
  equal(manuscriptBookDefaultFolder([], null), "");
});

test("reports missing folders in creation order without treating them as authority", () => {
  deepEqual(plan({ path: "Books/Future/FEVER.md", entries: [] }).missingFolders, ["Books", "Books/Future"]);
});

test("rejects empty and multiline titles", () => {
  match(plan({ title: "   " }).errors.join(" "), /Enter a book title/);
  match(plan({ title: "Book\nFour" }).errors.join(" "), /single line/);
  match(plan({ title: "Book\u2028Four" }).errors.join(" "), /single line/);
});

test("rejects unsafe absolute, traversal, empty-segment and extension paths", () => {
  match(plan({ path: "/PRIME/FEVER.md" }).errors.join(" "), /relative to the vault/);
  match(plan({ path: "PRIME/../FEVER.md" }).errors.join(" "), /traversal/);
  match(plan({ path: "PRIME//FEVER.md" }).errors.join(" "), /empty path segment/);
  match(plan({ path: "PRIME/FEVER" }).errors.join(" "), /end in \.md/);
  match(plan({ path: "PRIME/FEVER.md.md" }).errors.join(" "), /duplicate \.md/);
});

test("normalizes slash direction and supports Unicode vault paths", () => {
  const result = plan({ title: "熱", path: "本\\未来\\熱.md", entries: [] });
  equal(result.path, "本/未来/熱.md");
  equal(result.errors.length, 0);
});

test("rejects unsupported characters and Windows reserved names", () => {
  match(plan({ path: "PRIME/FEV?ER.md" }).errors.join(" "), /unsupported filename/);
  match(plan({ path: "PRIME/CON.md" }).errors.join(" "), /reserved filename/);
  equal(suggestManuscriptBookFilename("CON").filename, "_CON.md");
});

test("blocks existing files, folders, and case-insensitive path collisions", () => {
  match(plan({ entries: [{ path: "PRIME/FEVER.md", kind: "file" }] }).errors.join(" "), /file already exists/);
  match(plan({ entries: [{ path: "PRIME/FEVER.md", kind: "folder" }] }).errors.join(" "), /folder already exists/);
  match(plan({ entries: [{ path: "prime/fever.MD", kind: "file" }] }).errors.join(" "), /already exists/);
});

test("blocks a parent segment occupied by a file", () => {
  match(plan({ entries: [{ path: "PRIME", kind: "file" }] }).errors.join(" "), /not a folder/);
});

test("blocks recognised-book titles after trimming and case folding", () => {
  match(plan({ title: " emergence " }).errors.join(" "), /recognised book titled/);
});

test("allows the same Markdown basename in a different folder", () => {
  const result = plan({
    path: "Future/FEVER.md",
    entries: [{ path: "Archive/FEVER.md", kind: "file" }]
  });
  equal(result.errors.length, 0);
});

test("preview bytes are stable when a fresh snapshot remains valid", () => {
  const preview = plan();
  const confirmation = plan({ title: preview.title, path: preview.path });
  equal(confirmation.markdown, preview.markdown);
  equal(confirmation.path, preview.path);
});

test("a collision introduced after preview invalidates confirmation", () => {
  equal(plan().errors.length, 0);
  const stale = plan({ entries: [{ path: "PRIME/FEVER.md", kind: "file" }] });
  match(stale.errors.join(" "), /already exists/);
});
