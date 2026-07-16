import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  buildManuscriptOrder,
  ManuscriptDocumentRecord,
  nextManuscriptScene,
  previousManuscriptScene,
  proposeLegacyFilenameOrder,
  rewriteManuscriptOrderForRename
} from "../src/manuscript/ManuscriptOrder";

function record(
  path: string,
  title: string,
  kind: ManuscriptDocumentRecord["kind"],
  bookPath: string,
  parentPath: string | null,
  basename = path.split("/").pop()!.replace(/\.md$/i, "")
): ManuscriptDocumentRecord {
  return { path, basename, title, kind, bookPath, parentPath };
}

const bookPath = "Manuscripts/PLURALITY.md";
const book = record(bookPath, "PLURALITY", "book", bookPath, null);
const experiment = record(
  "Manuscripts/Parts/EXPERIMENT.md",
  "EXPERIMENT",
  "part",
  bookPath,
  bookPath
);
const containment = record(
  "Manuscripts/Parts/CONTAINMENT.md",
  "CONTAINMENT",
  "part",
  bookPath,
  bookPath
);
const domestic = record(
  "Manuscripts/Scenes/Domestic Distance.md",
  "Domestic Distance",
  "scene",
  bookPath,
  experiment.path
);
const wilderness = record(
  "Manuscripts/Scenes/Tobias in the Wilderness.md",
  "Tobias in the Wilderness",
  "scene",
  bookPath,
  experiment.path
);
const prime = record(
  "Manuscripts/Scenes/Prime Without Interpreter.md",
  "Prime Without Interpreter",
  "scene",
  bookPath,
  containment.path
);

function resolver(records: readonly ManuscriptDocumentRecord[]) {
  const map = new Map<string, ManuscriptDocumentRecord>();
  for (const item of records) {
    const withoutExtension = item.path.replace(/\.md$/i, "");
    const relativeToManuscripts = withoutExtension.replace(/^Manuscripts\//i, "");
    map.set(withoutExtension.toLowerCase(), item);
    map.set(relativeToManuscripts.toLowerCase(), item);
    map.set(item.basename.toLowerCase(), item);
    map.set(item.title.toLowerCase(), item);
  }
  return (linkpath: string) => map.get(linkpath.toLowerCase()) ?? null;
}

test("resolves explicit order and derives hierarchy from parent metadata", () => {
  const records = [book, experiment, containment, domestic, wilderness, prime];
  const result = buildManuscriptOrder(
    book,
    {
      manuscript_order: [
        "[[Parts/EXPERIMENT]]",
        "[[Domestic Distance]]",
        "[[Tobias in the Wilderness]]",
        "[[Parts/CONTAINMENT]]",
        "[[Prime Without Interpreter]]"
      ]
    },
    records,
    resolver(records)
  );

  equal(result.source, "explicit");
  deepEqual(result.entries.map((entry) => entry.title), [
    "EXPERIMENT",
    "Domestic Distance",
    "Tobias in the Wilderness",
    "CONTAINMENT",
    "Prime Without Interpreter"
  ]);
  deepEqual(result.roots.map((node) => node.entry.title), [
    "EXPERIMENT",
    "CONTAINMENT"
  ]);
  deepEqual(result.roots[0].children.map((node) => node.entry.title), [
    "Domestic Distance",
    "Tobias in the Wilderness"
  ]);
  deepEqual(result.roots[1].children.map((node) => node.entry.title), [
    "Prime Without Interpreter"
  ]);
  equal(result.diagnostics.length, 0);
});

test("reports duplicate, unresolved, cross-book and unlisted entries", () => {
  const otherBookPath = "Manuscripts/EMERGENCE.md";
  const foreign = record(
    "Manuscripts/Scenes/Foreign Scene.md",
    "Foreign Scene",
    "scene",
    otherBookPath,
    otherBookPath
  );
  const records = [book, experiment, domestic, wilderness, foreign];
  const result = buildManuscriptOrder(
    book,
    {
      manuscript_order: [
        "[[Parts/EXPERIMENT]]",
        "[[Domestic Distance]]",
        "[[Domestic Distance]]",
        "[[Missing Scene]]",
        "[[Foreign Scene]]"
      ]
    },
    records,
    resolver(records)
  );

  deepEqual(result.diagnostics.map((item) => item.kind).sort(), [
    "cross_book_entry",
    "duplicate_entry",
    "unlisted_entry",
    "unresolved_reference"
  ]);
  equal(
    result.diagnostics.find((item) => item.kind === "unlisted_entry")?.path,
    wilderness.path
  );
});

test("does not hide an invalid explicit property behind legacy fallback", () => {
  const result = buildManuscriptOrder(
    book,
    { manuscript_order: "[[Domestic Distance]]" },
    [book, domestic],
    resolver([domestic])
  );

  equal(result.source, "invalid");
  equal(result.entries.length, 0);
  equal(result.diagnostics[0]?.kind, "invalid_property_shape");
});

test("proposes depth-first legacy order from numeric sibling prefixes", () => {
  const legacyRecords = [
    record(containment.path, containment.title, "part", bookPath, bookPath, "2 CONTAINMENT"),
    record(prime.path, prime.title, "scene", bookPath, containment.path, "1 Prime Without Interpreter"),
    record(experiment.path, experiment.title, "part", bookPath, bookPath, "1 EXPERIMENT"),
    record(wilderness.path, wilderness.title, "scene", bookPath, experiment.path, "2 Tobias in the Wilderness"),
    record(domestic.path, domestic.title, "scene", bookPath, experiment.path, "1 Domestic Distance")
  ];

  const proposal = proposeLegacyFilenameOrder(bookPath, legacyRecords);
  deepEqual(proposal.entries.map((entry) => entry.title), [
    "EXPERIMENT",
    "Domestic Distance",
    "Tobias in the Wilderness",
    "CONTAINMENT",
    "Prime Without Interpreter"
  ]);
  deepEqual(proposal.ambiguousPaths, []);
});

test("marks missing and duplicate numeric prefixes as migration ambiguities", () => {
  const first = record(domestic.path, domestic.title, "scene", bookPath, bookPath, "1 Domestic Distance");
  const duplicate = record(wilderness.path, wilderness.title, "scene", bookPath, bookPath, "1 Tobias in the Wilderness");
  const unnumbered = record(prime.path, prime.title, "scene", bookPath, bookPath, "Prime Without Interpreter");
  const proposal = proposeLegacyFilenameOrder(bookPath, [unnumbered, duplicate, first]);

  deepEqual(new Set(proposal.ambiguousPaths), new Set([
    first.path,
    duplicate.path,
    unnumbered.path
  ]));
});

test("finds previous and next scenes across part boundaries", () => {
  const records = [book, experiment, containment, domestic, wilderness, prime];
  const result = buildManuscriptOrder(
    book,
    {
      manuscript_order: [
        "[[EXPERIMENT]]",
        "[[Domestic Distance]]",
        "[[Tobias in the Wilderness]]",
        "[[CONTAINMENT]]",
        "[[Prime Without Interpreter]]"
      ]
    },
    records,
    resolver(records)
  );

  equal(previousManuscriptScene(result, domestic.path), null);
  equal(previousManuscriptScene(result, prime.path)?.path, wilderness.path);
  equal(nextManuscriptScene(result, wilderness.path)?.path, prime.path);
  equal(nextManuscriptScene(result, prime.path), null);
});

test("reports parent cycles and missing listed parents without dropping scenes", () => {
  const partA = record("Manuscripts/Parts/A.md", "A", "part", bookPath, "Manuscripts/Parts/B.md");
  const partB = record("Manuscripts/Parts/B.md", "B", "part", bookPath, partA.path);
  const orphan = record("Manuscripts/Scenes/Orphan.md", "Orphan", "scene", bookPath, "Manuscripts/Parts/Unlisted.md");
  const records = [book, partA, partB, orphan];
  const result = buildManuscriptOrder(
    book,
    { manuscript_order: ["[[A]]", "[[B]]", "[[Orphan]]"] },
    records,
    resolver(records)
  );

  equal(result.entries.length, 3);
  equal(result.diagnostics.filter((item) => item.kind === "parent_cycle").length, 2);
  equal(result.diagnostics.filter((item) => item.kind === "missing_parent").length, 1);
});

test("rewrites renamed order targets while preserving display aliases", () => {
  const frontmatter: Record<string, unknown> = {
    manuscript_order: [
      "[[Parts/1 EXPERIMENT|Experiment]]",
      "[[Scenes/1 Domestic Distance]]"
    ]
  };

  equal(
    rewriteManuscriptOrderForRename(
      frontmatter,
      "Parts/1 EXPERIMENT.md",
      "Parts/EXPERIMENT.md"
    ),
    true
  );
  deepEqual(frontmatter.manuscript_order, [
    "[[Parts/EXPERIMENT|Experiment]]",
    "[[Scenes/1 Domestic Distance]]"
  ]);
});
