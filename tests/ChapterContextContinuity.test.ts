import { deepEqual, equal, notEqual } from "node:assert/strict";
import { test } from "node:test";
import {
  ChapterContextContinuityInput,
  evaluateChapterContextContinuity
} from "../src/observations/ChapterContextContinuity";
import { StoryWorldEntityRecord } from "../src/story-world/StoryWorldIndex";

function entity(
  path: string,
  type: string,
  properties: Record<string, unknown> = {}
): StoryWorldEntityRecord {
  const name = path.replace(/\.md$/, "").split("/").pop()!;
  return {
    path, basename: name, entityType: type, name, aliases: [], facets: [], scope: [],
    status: "confirmed", summary: null, firstAppearance: null, sources: [], links: [], properties
  };
}

function input(
  frontmatter: Record<string, unknown>,
  entities: readonly StoryWorldEntityRecord[],
  owningBook: ChapterContextContinuityInput["owningBook"] = null
): ChapterContextContinuityInput {
  const byName = new Map(entities.map((item) => [item.name, item]));
  return {
    chapter: { role: "manuscript", path: "Chapters/One.md", label: "One" },
    frontmatter,
    owningBook,
    resolveEntity: (reference) => {
      const name = /^\[\[([^\]|/]+\/)?([^\]|]+)(?:\|[^\]]+)?\]\]$/.exec(reference)?.[2];
      return name ? byName.get(name) ?? null : null;
    },
    resolveScope: (reference) => reference === "[[Books/One]]"
      ? { note: { role: "manuscript", path: "Books/One.md", label: "One" }, book: true }
      : reference === "[[Books/Two]]"
        ? { note: { role: "manuscript", path: "Books/Two.md", label: "Two" }, book: true }
        : null
  };
}

test("reports a directly referenced event only when its interval is proven later", () => {
  const later = entity("World/Later.md", "event", { world_time: "2027" });
  const overlap = entity("World/Overlap.md", "event", { world_time: "2026-07" });
  const observations = evaluateChapterContextContinuity(input({
    story_date: "2026",
    world_context: ["[[Later]]", "[[Overlap]]"]
  }, [later, overlap]));

  equal(observations.filter((item) => item.kind === "chapter-context.event.after-chapter").length, 1);
  const conflict = observations.find((item) => item.kind === "chapter-context.event.after-chapter")!;
  equal(conflict.primary.path, "Chapters/One.md");
  deepEqual(conflict.evidence.map((item) => item.source.property), [
    ["story_date"], ["world_context", 0], ["world_time"]
  ]);
});

test("supports numeric chapter and event years from YAML", () => {
  const numericEvent = entity("World/Numeric Event.md", "event", { world_time: 2027 });
  const conflict = evaluateChapterContextContinuity(input({
    story_date: 2026,
    world_context: "[[Numeric Event]]"
  }, [numericEvent]));
  equal(conflict.filter((item) => item.kind === "chapter-context.event.after-chapter").length, 1);
  equal(conflict.some((item) => item.kind.startsWith("chapter-context.source-data")), false);

  const sameYear = evaluateChapterContextContinuity(input({
    story_date: 2027,
    world_context: "[[Numeric Event]]"
  }, [numericEvent]));
  equal(sameYear.some((item) => item.classification === "contradiction"), false);
  equal(sameYear.some((item) => item.kind.startsWith("chapter-context.source-data")), false);
});

test("handles quoted years and overlapping month-versus-year intervals", () => {
  const quotedEvent = entity("World/Quoted Event.md", "event", { world_time: "2027" });
  const quotedConflict = evaluateChapterContextContinuity(input({
    story_date: "2026",
    world_context: "[[Quoted Event]]"
  }, [quotedEvent]));
  equal(quotedConflict.filter((item) => item.kind === "chapter-context.event.after-chapter").length, 1);
  equal(quotedConflict.some((item) => item.kind.startsWith("chapter-context.source-data")), false);

  const overlap = evaluateChapterContextContinuity(input({
    story_date: "2027-06",
    world_context: "[[Quoted Event]]"
  }, [quotedEvent]));
  equal(overlap.some((item) => item.classification === "contradiction"), false);
});

test("keeps malformed numeric years and unsupported structures as review observations", () => {
  const malformed = entity("World/Malformed.md", "event", { world_time: 2027.5 });
  const unsupported = entity("World/Unsupported.md", "event", {
    world_time: { at: "2027", source: "[[Calendar]]" }
  });
  const observations = evaluateChapterContextContinuity(input({
    story_date: 2026,
    world_context: ["[[Malformed]]", "[[Unsupported]]"]
  }, [malformed, unsupported]));
  equal(observations.some((item) => item.classification === "contradiction"), false);
  equal(observations.filter((item) => item.severity === "review").length, 2);
  equal(observations.some((item) => item.classification === "malformed_evidence"), true);
  equal(observations.some((item) => item.classification === "review_concern"), true);
});

test("requires both relationship endpoints in explicit world_context", () => {
  const owner = entity("World/Owner.md", "character", {
    world_relationships: [{
      predicate: "works_for",
      target: "[[Target]]",
      valid_from: "2027-01-01"
    }]
  });
  const target = entity("World/Target.md", "organisation");

  equal(evaluateChapterContextContinuity(input({
    story_date: "2026-12-31", world_context: ["[[Owner]]"]
  }, [owner, target])).filter((item) => item.kind.includes("relationship.before")).length, 0);

  const observations = evaluateChapterContextContinuity(input({
    story_date: "2026-12-31", world_context: ["[[Owner]]", "[[Target]]"]
  }, [owner, target]));
  equal(observations.filter((item) => item.kind === "chapter-context.relationship.before-valid-from").length, 1);
});

test("reports expired relationships and keeps duplicate logical occurrences distinct", () => {
  const assertion = { predicate: "works_for", target: "[[Target]]", valid_until: "2026" };
  const owner = entity("World/Owner.md", "character", {
    world_relationships: [assertion, assertion]
  });
  const target = entity("World/Target.md", "organisation");
  const observations = evaluateChapterContextContinuity(input({
    story_date: "2027", world_context: ["[[Owner]]", "[[Target]]"]
  }, [owner, target])).filter((item) => item.kind === "chapter-context.relationship.after-valid-until");
  equal(observations.length, 2);
  notEqual(observations[0].lineageKey, observations[1].lineageKey);
});

test("turns malformed dates and references into review observations without false conflicts", () => {
  const event = entity("World/Event.md", "event", { world_time: "2026-02-30" });
  const observations = evaluateChapterContextContinuity(input({
    story_date: "2026-01-01",
    world_context: ["[[Event]]", "plain text", "[[Missing]]"]
  }, [event]));
  equal(observations.some((item) => item.classification === "contradiction"), false);
  equal(observations.filter((item) => item.classification === "malformed_evidence").length, 2);
  equal(observations.filter((item) => item.classification === "unresolved_evidence").length, 1);
});

test("keeps unresolved context lineage stable when a different reference is inserted", () => {
  const before = evaluateChapterContextContinuity(input({
    story_date: "2026", world_context: ["[[Missing]]"]
  }, [])).find((item) => item.classification === "unresolved_evidence")!;
  const after = evaluateChapterContextContinuity(input({
    story_date: "2026", world_context: ["[[Other]]", "[[Missing]]"]
  }, [])).find((item) => item.evidence.some((evidence) =>
    evidence.value.kind === "unresolved_reference" && evidence.value.reference === "[[Missing]]"
  ))!;
  equal(after.lineageKey, before.lineageKey);
  notEqual(after.fingerprint, before.fingerprint);
});

test("reports book exclusion only from complete resolved book scope", () => {
  const excluded = entity("World/Excluded.md", "character", { world_scope: "[[Books/Two]]" });
  const included = entity("World/Included.md", "character", { world_scope: ["[[Books/Two]]", "[[Books/One]]"] });
  const book = {
    note: { role: "manuscript" as const, path: "Books/One.md", label: "One" },
    source: {
      note: { role: "manuscript" as const, path: "Chapters/One.md", label: "One" },
      property: ["book"]
    }
  };
  const observations = evaluateChapterContextContinuity(input({
    story_date: "2026-01-01", world_context: ["[[Excluded]]", "[[Included]]"]
  }, [excluded, included], book));
  equal(observations.filter((item) => item.kind === "chapter-context.entity.out-of-scope").length, 1);
});

test("does not treat non-book scope as series exclusion", () => {
  const scoped = entity("World/Scoped.md", "character", { world_scope: "[[Series/Prime]]" });
  const observations = evaluateChapterContextContinuity({
    ...input({ story_date: "2026", world_context: "[[Scoped]]" }, [scoped], {
      note: { role: "manuscript", path: "Books/One.md", label: "One" },
      source: {
        note: { role: "manuscript", path: "Chapters/One.md", label: "One" },
        property: ["book"]
      }
    }),
    resolveScope: () => ({
      note: { role: "story_world", path: "Series/Prime.md", label: "Prime" }, book: false
    })
  });
  equal(observations.some((item) => item.kind === "chapter-context.entity.out-of-scope"), false);
});
