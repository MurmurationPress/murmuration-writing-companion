import { deepEqual, equal, throws } from "node:assert/strict";
import { test } from "node:test";
import {
  compareManuscriptOrderKeys,
  evenlySpacedManuscriptOrderKeys,
  MANUSCRIPT_ORDER_KEY_LENGTH,
  manuscriptOrderKey,
  manuscriptOrderKeyAssignments,
  manuscriptOrderKeyBetween
} from "../src/manuscript/ManuscriptOrderKey";

test("accepts only canonical fixed-width uppercase order keys", () => {
  equal(manuscriptOrderKey("000000000A"), "000000000A");
  equal(manuscriptOrderKey(" 000000000A "), "000000000A");
  equal(manuscriptOrderKey("000000000a"), null);
  equal(manuscriptOrderKey("A"), null);
  equal(manuscriptOrderKey(null), null);
  equal("000000000A".length, MANUSCRIPT_ORDER_KEY_LENGTH);
});

test("allocates evenly spaced lexical keys", () => {
  const keys = evenlySpacedManuscriptOrderKeys(5);
  equal(keys.length, 5);
  equal(new Set(keys).size, 5);
  deepEqual([...keys].sort(compareManuscriptOrderKeys), keys);
});

test("creates a key between neighbours without rewriting either neighbour", () => {
  const [first, second] = evenlySpacedManuscriptOrderKeys(2);
  const middle = manuscriptOrderKeyBetween(first, second);

  equal(typeof middle, "string");
  equal(compareManuscriptOrderKeys(first, middle!), -1);
  equal(compareManuscriptOrderKeys(middle!, second), -1);
});

test("creates keys before the first and after the last sibling", () => {
  const [first, second] = evenlySpacedManuscriptOrderKeys(2);
  const before = manuscriptOrderKeyBetween(null, first);
  const after = manuscriptOrderKeyBetween(second, null);

  equal(compareManuscriptOrderKeys(before!, first), -1);
  equal(compareManuscriptOrderKeys(second, after!), -1);
});

test("signals when a sibling-set rebalance is required", () => {
  equal(manuscriptOrderKeyBetween("000000000A", "000000000B"), null);
});

test("assigns deterministic keys to a reviewed sequence", () => {
  const assignments = manuscriptOrderKeyAssignments(["Part A.md", "Scene.md", "Part B.md"]);
  deepEqual([...assignments.keys()], ["Part A.md", "Scene.md", "Part B.md"]);
  deepEqual(
    [...assignments.values()],
    evenlySpacedManuscriptOrderKeys(3)
  );
});

test("rejects invalid allocation counts", () => {
  throws(() => evenlySpacedManuscriptOrderKeys(-1));
  throws(() => evenlySpacedManuscriptOrderKeys(1.5));
});
