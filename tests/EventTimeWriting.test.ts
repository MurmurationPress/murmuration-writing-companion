import { deepEqual, rejects } from "node:assert/strict";
import { test } from "node:test";
import { EventTimeDocumentState, EventTimeVerificationError, EventTimeWriteHost, StaleEventTimeWriteError, writeEventTimeMutation } from "../src/story-world/EventTimeWriting";

const initial: Record<string, unknown> = { world_entity: "event", title: "Robin is Born", custom: { keep: true }, world_time: { at: "2026-01-01", precision: "day" } };
function state(revision: string, frontmatter: Record<string, unknown> = initial): EventTimeDocumentState { return { revision, text: revision, frontmatter }; }

test("writes only world_time, verifies authoritative content and preserves unrelated frontmatter", async () => {
  let written = initial as Record<string, unknown>;
  const host: EventTimeWriteHost = {
    readCurrent: async () => state("one"),
    processFrontmatter: async (change) => { written = structuredClone(initial); change(written); },
    readAuthoritative: async () => state("two", written), restore: async () => {}
  };
  await writeEventTimeMutation(host, state("one"), { kind: "set", value: { mode: "range", precision: "day", from: { date: "2026-02-01", time: "", offset: "" }, to: { date: "2026-02-03", time: "", offset: "" } } });
  deepEqual(written.custom, { keep: true });
  deepEqual(written.world_time, { from: "2026-02-01", until: "2026-02-03", precision: "day" });
});

test("rejects stale editor content before writing", async () => {
  let processed = false;
  const host: EventTimeWriteHost = { readCurrent: async () => state("newer"), readAuthoritative: async () => state("newer"), processFrontmatter: async () => { processed = true; }, restore: async () => {} };
  await rejects(writeEventTimeMutation(host, state("old"), { kind: "clear" }), StaleEventTimeWriteError);
  deepEqual(processed, false);
});

test("clears explicitly and verifies the saved frontmatter", async () => {
  let written = structuredClone(initial) as Record<string, unknown>;
  const host: EventTimeWriteHost = { readCurrent: async () => state("one"), processFrontmatter: async (change) => change(written), readAuthoritative: async () => state("two", written), restore: async () => {} };
  await writeEventTimeMutation(host, state("one"), { kind: "clear" });
  deepEqual(written, { world_entity: "event", title: "Robin is Born", custom: { keep: true } });
});

test("post-write verification reads authoritative content even when the editor buffer remains old", async () => {
  let written = structuredClone(initial) as Record<string, unknown>;
  const host: EventTimeWriteHost = { readCurrent: async () => state("editor-old"), processFrontmatter: async (change) => change(written), readAuthoritative: async () => state("vault-new", written), restore: async () => { throw new Error("should not roll back"); } };
  await writeEventTimeMutation(host, state("editor-old"), { kind: "clear" });
});

test("a genuine verification failure rolls back only when unrelated content is unchanged", async () => {
  let restored = "";
  const failed = structuredClone(initial) as Record<string, unknown>;
  failed.world_time = { at: "wrong", precision: "day" };
  const host: EventTimeWriteHost = { readCurrent: async () => state("one"), processFrontmatter: async () => {}, readAuthoritative: async () => state("failed", failed), restore: async (text) => { restored = text; } };
  await rejects(writeEventTimeMutation(host, state("one"), { kind: "clear" }), EventTimeVerificationError);
  deepEqual(restored, "one");
});
