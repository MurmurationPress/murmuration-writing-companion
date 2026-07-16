import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  buildManuscriptOrder,
  ManuscriptDocumentRecord,
  rewriteManuscriptOrderForRename
} from "../src/manuscript/ManuscriptOrder";

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

test("rejects recognised book-owned notes that are not parts or scenes", () => {
  const bookPath = "Manuscripts/PLURALITY.md";
  const book = record(bookPath, "PLURALITY", "book", bookPath, null);
  const research = record(
    "Manuscripts/Research/Climate.md",
    "Climate research",
    "other",
    bookPath,
    bookPath
  );
  const result = buildManuscriptOrder(
    book,
    { manuscript_order: ["[[Climate]]"] },
    [book, research],
    (linkpath) => linkpath === "Climate" ? research : null
  );

  equal(result.entries.length, 0);
  equal(result.diagnostics.length, 1);
  equal(result.diagnostics[0]?.kind, "invalid_entry_kind");
});

test("rewrites a relative wikilink when Obsidian reports full vault rename paths", () => {
  const frontmatter: Record<string, unknown> = {
    manuscript_order: [
      "[[Parts/1 EXPERIMENT|Experiment]]",
      "[[Scenes/1 Domestic Distance]]"
    ]
  };

  equal(
    rewriteManuscriptOrderForRename(
      frontmatter,
      "Manuscripts/Parts/1 EXPERIMENT.md",
      "Manuscripts/Parts/EXPERIMENT.md"
    ),
    true
  );
  deepEqual(frontmatter.manuscript_order, [
    "[[Parts/EXPERIMENT|Experiment]]",
    "[[Scenes/1 Domestic Distance]]"
  ]);
});
