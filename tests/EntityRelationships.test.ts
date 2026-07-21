import { deepEqual, equal, match, rejects } from "node:assert/strict";
import { test } from "node:test";
import {
  applyEntityRelationshipMutation,
  projectEntityRelationships
} from "../src/story-world/EntityRelationships";
import {
  EntityRelationshipDocumentState,
  EntityRelationshipWriteHost,
  StaleEntityRelationshipWriteError,
  writeEntityRelationshipMutation
} from "../src/story-world/EntityRelationshipWriting";

test("projects valid target relationships as readable sentences with implicit subjects", () => {
  const [relation] = projectEntityRelationships("Pip", [{
    predicate: "parent_of",
    target: "[[Robin]]",
    status: "confirmed"
  }]);
  equal(relation.valid, true);
  equal(relation.sentence, "Pip is parent of Robin.");
  equal(relation.objectKind, "target");
  equal(relation.statusLabel, "Confirmed");
});

test("projects literal values without exposing raw triples", () => {
  const [relation] = projectEntityRelationships("JANUS", [{
    predicate: "believes",
    value: "PRIME has been excluded",
    status: "unresolved"
  }]);
  equal(relation.valid, true);
  equal(relation.sentence, "JANUS believes PRIME has been excluded.");
  equal(relation.objectKind, "value");
  equal(relation.statusLabel, "Unresolved");
});

test("keeps incomplete assertions visible without presenting them as fact", () => {
  const [relation] = projectEntityRelationships("Pip", [{ predicate: "knows" }]);
  equal(relation.valid, false);
  equal(relation.sentence, "Incomplete relationship assertion.");
  match(relation.issue ?? "", /needs either a target or a literal value/);
});

test("does not present a non-list world_relationships property as settled fact", () => {
  const [relation] = projectEntityRelationships("Pip", {
    predicate: "parent_of",
    target: "[[Robin]]",
    status: "confirmed"
  });
  equal(relation.valid, false);
  equal(relation.index, -1);
  equal(relation.sentence, "Incomplete relationship collection.");
  match(relation.issue ?? "", /not a list/);
});

test("uses custom labels and readable fallbacks for unknown predicates", () => {
  const [custom, fallback] = projectEntityRelationships("PRIME", [
    { predicate: "routes_around", predicate_label: "routes around", target: "[[JANUS]]" },
    { predicate: "phase_locks_with", target: "[[HALCYON]]" }
  ]);
  equal(custom.sentence, "PRIME routes around JANUS.");
  equal(fallback.sentence, "PRIME phase locks with HALCYON.");
  equal(fallback.predicate, "phase_locks_with");
});

test("retains provenance, status and all known or unknown qualifiers in projection", () => {
  const [relation] = projectEntityRelationships("Tobias", [{
    predicate: "works_for",
    target: "[[Northbridge Systems]]",
    status: "candidate",
    source: ["[[Quiet Load]]", "[[Review Notes]]"],
    as_of: "2026-04-05",
    valid_until: "2027",
    confidence: "low",
    private_revision_key: { keep: true }
  }]);
  deepEqual(relation.sources, ["[[Quiet Load]]", "[[Review Notes]]"]);
  equal(relation.statusLabel, "Candidate");
  deepEqual(relation.qualifiers, {
    source: ["[[Quiet Load]]", "[[Review Notes]]"],
    as_of: "2026-04-05",
    valid_until: "2027",
    confidence: "low",
    private_revision_key: { keep: true }
  });
});

const baseFrontmatter = {
  world_entity: "character",
  world_name: "Tobias",
  unrelated: { nested: ["keep", 7] },
  world_relationships: [{
    predicate: "works_for",
    target: "[[Northbridge Systems]]",
    status: "confirmed",
    source: ["[[Quiet Load]]"],
    as_of: "2026-04-05",
    mystery_qualifier: { untouched: true }
  }]
};

test("adds an explicit entity-owned relationship without a stored subject", () => {
  const next = applyEntityRelationshipMutation(baseFrontmatter, {
    kind: "add",
    draft: {
      predicate: "trusts",
      objectKind: "target",
      objectValue: "[[Pip]]",
      status: "planned",
      qualifierUpdates: { source: "[[Planning Notes]]" }
    }
  });
  const added = (next.world_relationships as Record<string, unknown>[])[1];
  deepEqual(added, {
    predicate: "trusts",
    target: "[[Pip]]",
    status: "planned",
    source: "[[Planning Notes]]"
  });
  equal("subject" in added, false);
  deepEqual(next.unrelated, baseFrontmatter.unrelated);
});

test("edits a simple relationship while preserving provenance and unknown qualifiers", () => {
  const next = applyEntityRelationshipMutation(baseFrontmatter, {
    kind: "edit",
    index: 0,
    draft: {
      predicate: "opposes",
      objectKind: "target",
      objectValue: "[[Northbridge Systems]]",
      status: "candidate"
    }
  });
  deepEqual((next.world_relationships as unknown[])[0], {
    predicate: "opposes",
    target: "[[Northbridge Systems]]",
    status: "candidate",
    source: ["[[Quiet Load]]"],
    as_of: "2026-04-05",
    mystery_qualifier: { untouched: true }
  });
  deepEqual(next.unrelated, baseFrontmatter.unrelated);
});

test("preserves an unknown predicate and qualifier while deliberately changing provenance", () => {
  const frontmatter = {
    ...baseFrontmatter,
    world_relationships: [{
      predicate: "phase_locks_with",
      target: "[[PRIME]]",
      status: "confirmed",
      source: ["[[Old Source]]"],
      unknown_time_model: { cycle: 4 }
    }]
  };
  const next = applyEntityRelationshipMutation(frontmatter, {
    kind: "edit",
    index: 0,
    draft: {
      predicate: "phase_locks_with",
      objectKind: "target",
      objectValue: "[[PRIME]]",
      status: "confirmed",
      qualifierUpdates: { source: "[[New Source]]" }
    }
  });
  deepEqual((next.world_relationships as unknown[])[0], {
    predicate: "phase_locks_with",
    target: "[[PRIME]]",
    status: "confirmed",
    source: "[[New Source]]",
    unknown_time_model: { cycle: 4 }
  });
});

test("supersedes and removes only the selected assertion", () => {
  const superseded = applyEntityRelationshipMutation(baseFrontmatter, { kind: "supersede", index: 0 });
  equal((superseded.world_relationships as Record<string, unknown>[])[0].status, "superseded");
  equal((superseded.world_relationships as Record<string, unknown>[])[0].source instanceof Array, true);

  const removed = applyEntityRelationshipMutation(baseFrontmatter, { kind: "remove", index: 0 });
  equal("world_relationships" in removed, false);
  deepEqual(removed.unrelated, baseFrontmatter.unrelated);
});

function state(
  revision: string,
  frontmatter: Record<string, unknown> = baseFrontmatter
): EntityRelationshipDocumentState {
  return { revision, text: `text-${revision}`, frontmatter };
}

test("rejects a stale write before invoking the frontmatter writer", async () => {
  let writes = 0;
  const host: EntityRelationshipWriteHost = {
    read: async () => state("newer"),
    processFrontmatter: async () => { writes += 1; },
    restore: async () => {}
  };
  await rejects(
    writeEntityRelationshipMutation(host, state("original"), { kind: "remove", index: 0 }),
    StaleEntityRelationshipWriteError
  );
  equal(writes, 0);
});

test("verifies add, edit, supersede and remove writes while preserving unrelated frontmatter", async () => {
  for (const mutation of [
    { kind: "add", draft: { predicate: "knows", objectKind: "target", objectValue: "[[Pip]]", status: "confirmed" } },
    { kind: "edit", index: 0, draft: { predicate: "trusts", objectKind: "target", objectValue: "[[Pip]]", status: "planned" } },
    { kind: "supersede", index: 0 },
    { kind: "remove", index: 0 }
  ] as const) {
    let current = state("original");
    const host: EntityRelationshipWriteHost = {
      read: async () => current,
      processFrontmatter: async (change) => {
        const frontmatter = structuredClone(current.frontmatter);
        change(frontmatter);
        current = { revision: "written", text: "written", frontmatter };
      },
      restore: async () => { throw new Error("Unexpected rollback"); }
    };
    const written = await writeEntityRelationshipMutation(host, state("original"), mutation);
    deepEqual(written.frontmatter.unrelated, baseFrontmatter.unrelated);
  }
});

test("rolls back only its own failed verification result", async () => {
  let current = state("original");
  let restored: string | null = null;
  const host: EntityRelationshipWriteHost = {
    read: async () => current,
    processFrontmatter: async () => { current = state("bad-write"); },
    restore: async (text) => { restored = text; }
  };
  await rejects(writeEntityRelationshipMutation(host, state("original"), { kind: "remove", index: 0 }));
  equal(restored, "text-original");
});

test("does not roll back over a concurrent unrelated author change", async () => {
  let current = state("original");
  let restores = 0;
  const host: EntityRelationshipWriteHost = {
    read: async () => current,
    processFrontmatter: async () => {
      current = state("concurrent", { ...baseFrontmatter, unrelated: { newer: true } });
    },
    restore: async () => { restores += 1; }
  };
  await rejects(writeEntityRelationshipMutation(host, state("original"), { kind: "remove", index: 0 }));
  equal(restores, 0);
  deepEqual(current.frontmatter.unrelated, { newer: true });
});
