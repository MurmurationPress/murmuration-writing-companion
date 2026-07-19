import { deepEqual, equal, match } from "node:assert/strict";
import { test } from "node:test";
import type {
  ManuscriptDocumentRecord,
  ManuscriptOrderDiagnostic,
  ManuscriptOrderResult
} from "../../src/manuscript/ManuscriptOrder";
import {
  manuscriptNeedsReconciliation,
  manuscriptReconciliationPlacementOptions,
  planManuscriptReconciliation
} from "../../src/manuscript/ManuscriptReconciliation";

const bookPath = "Books/PLURALITY.md";
const partPath = "Books/PLURALITY/ABSENCE.md";
const firstPath = "Books/PLURALITY/ABSENCE/Domestic Distance.md";
const secondPath = "Books/PLURALITY/ABSENCE/Uninvited Contact.md";

function record(
  path: string,
  title: string,
  kind: ManuscriptDocumentRecord["kind"],
  parentPath: string | null,
  orderKey: string | null,
  orderKeyPresent = true,
  explicitParent = kind !== "book",
  parentReferenceInvalid = false
): ManuscriptDocumentRecord {
  return {
    path,
    basename: path.split("/").pop()!.replace(/\.md$/i, ""),
    title,
    kind,
    bookPath,
    parentPath,
    orderKey,
    orderKeyPresent,
    explicitParent,
    parentReferenceInvalid
  };
}

const book = record(bookPath, "PLURALITY", "book", null, null, false, false);
const part = record(partPath, "ABSENCE", "part", bookPath, "C000000000");
const first = record(firstPath, "Domestic Distance", "scene", partPath, "C000000000");

function result(
  entries: readonly ManuscriptDocumentRecord[],
  diagnostics: readonly ManuscriptOrderDiagnostic[]
): ManuscriptOrderResult {
  return {
    source: "distributed",
    entries,
    roots: [],
    scenes: entries.filter((entry) => entry.kind === "scene"),
    diagnostics
  };
}

function frontmatter(
  entries: readonly ManuscriptDocumentRecord[]
): Map<string, Record<string, unknown>> {
  const values = new Map<string, Record<string, unknown>>([
    [bookPath, { type: "book" }]
  ]);
  for (const entry of entries) {
    values.set(entry.path, {
      type: entry.kind,
      parent: `[[${(entry.parentPath ?? bookPath).replace(/\.md$/i, "")}]]`,
      ...(entry.orderKeyPresent ? { manuscript_order_key: entry.orderKey } : {})
    });
  }
  return values;
}

test("requires an explicit placement for a newly added unranked scene", () => {
  const unranked = record(secondPath, "Uninvited Contact", "scene", partPath, null, false);
  const order = result([part, first, unranked], [{
    kind: "missing_order_key",
    path: secondPath,
    message: "Uninvited Contact has no manuscript_order_key."
  }]);
  const input = {
    book,
    result: order,
    frontmatterByPath: frontmatter([part, first, unranked])
  };

  equal(manuscriptNeedsReconciliation(order), true);
  const incomplete = planManuscriptReconciliation(input);
  equal(incomplete.canApply, false);
  match(incomplete.unresolved[0], /needs a position/i);

  const before = manuscriptReconciliationPlacementOptions(input, secondPath)
    .find((option) => option.choice.position === "before"
      && option.choice.targetPath === firstPath)!;
  const plan = planManuscriptReconciliation(input, {
    placements: { [secondPath]: before.choice },
    rebalanceParents: []
  });

  equal(plan.canApply, true);
  equal(plan.files.length, 1);
  equal(plan.files[0].path, secondPath);
  equal(plan.files[0].mutation.set.parent, undefined);
  equal(typeof plan.files[0].mutation.set.manuscript_order_key, "string");
});

test("writes an inferred parent canonically without changing the key", () => {
  const inferred = record(secondPath, "Uninvited Contact", "scene", partPath, "I000000000", true, false);
  const order = result([part, first, inferred], [{
    kind: "missing_parent",
    path: secondPath,
    message: "Uninvited Contact needs a canonical parent property."
  }]);
  const values = frontmatter([part, first, inferred]);
  delete values.get(secondPath)!.parent;

  const plan = planManuscriptReconciliation({
    book,
    result: order,
    frontmatterByPath: values
  });

  equal(plan.canApply, true);
  equal(plan.files.length, 1);
  deepEqual(plan.files[0].mutation.set, {
    parent: `[[${partPath.replace(/\.md$/, "")}]]`
  });
});

test("a broken parent requires explicit replacement and placement", () => {
  const broken = record(secondPath, "Uninvited Contact", "scene", partPath, "I000000000", true, true, true);
  const order = result([part, first, broken], [{
    kind: "missing_parent",
    path: secondPath,
    message: "Uninvited Contact's explicit parent could not be resolved."
  }]);
  const values = frontmatter([part, first, broken]);
  values.get(secondPath)!.parent = "[[Missing Part]]";
  const input = { book, result: order, frontmatterByPath: values };

  const choice = manuscriptReconciliationPlacementOptions(input, secondPath)
    .find((option) => option.choice.parentPath === partPath
      && option.choice.position === "after"
      && option.choice.targetPath === firstPath)!;
  const plan = planManuscriptReconciliation(input, {
    placements: { [secondPath]: choice.choice },
    rebalanceParents: []
  });

  equal(plan.canApply, true);
  equal(plan.files[0].mutation.set.parent, `[[${partPath.replace(/\.md$/, "")}]]`);
  equal(typeof plan.files[0].mutation.set.manuscript_order_key, "string");
});

test("duplicate sibling keys require explicit acceptance of displayed order", () => {
  const duplicate = record(secondPath, "Uninvited Contact", "scene", partPath, "C000000000");
  const diagnostics: ManuscriptOrderDiagnostic[] = [first, duplicate].map((entry) => ({
    kind: "duplicate_order_key",
    path: entry.path,
    message: `${entry.title} shares a key.`
  }));
  const input = {
    book,
    result: result([part, first, duplicate], diagnostics),
    frontmatterByPath: frontmatter([part, first, duplicate])
  };

  const blocked = planManuscriptReconciliation(input);
  equal(blocked.canApply, false);
  match(blocked.unresolved[0], /confirm the displayed order/i);

  const plan = planManuscriptReconciliation(input, {
    placements: {},
    rebalanceParents: [partPath]
  });
  equal(plan.canApply, true);
  deepEqual(plan.files.map((file) => file.path), [firstPath, secondPath]);
  equal(
    plan.files[0].mutation.set.manuscript_order_key
      === plan.files[1].mutation.set.manuscript_order_key,
    false
  );
});

test("sync conflict markers block all reconciliation writes", () => {
  const unranked = record(secondPath, "Uninvited Contact", "scene", partPath, null, false);
  const order = result([part, first, unranked], [{
    kind: "missing_order_key",
    path: secondPath,
    message: "Uninvited Contact has no manuscript_order_key."
  }]);
  const input = {
    book,
    result: order,
    frontmatterByPath: frontmatter([part, first, unranked]),
    conflictPaths: new Set([secondPath])
  };
  const end = manuscriptReconciliationPlacementOptions(input, secondPath)
    .find((option) => option.choice.parentPath === partPath
      && option.choice.position === "end")!;
  const plan = planManuscriptReconciliation(input, {
    placements: { [secondPath]: end.choice },
    rebalanceParents: []
  });

  equal(plan.canApply, false);
  match(plan.unresolved[0], /conflict markers/i);
});

test("removes an obsolete central array without changing distributed notes", () => {
  const order = result([part, first], [{
    kind: "obsolete_order_array",
    path: bookPath,
    message: "manuscript_order is obsolete."
  }]);
  const values = frontmatter([part, first]);
  values.get(bookPath)!.manuscript_order = ["[[obsolete]]"];

  const plan = planManuscriptReconciliation({
    book,
    result: order,
    frontmatterByPath: values
  });

  equal(plan.canApply, true);
  equal(plan.files.length, 1);
  equal(plan.files[0].path, bookPath);
  deepEqual(plan.files[0].mutation.remove, ["manuscript_order"]);
});
