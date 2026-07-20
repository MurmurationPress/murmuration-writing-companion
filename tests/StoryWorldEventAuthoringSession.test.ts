import { equal } from "node:assert/strict";
import { test } from "node:test";
import {
  StoryWorldEventAuthoringSession
} from "../src/companion/StoryWorldEventAuthoringSession";
import type { ProseWikilinkOccurrence } from "../src/companion/ProseWikilinkChanges";

function occurrence(raw = "[[The Failure]]"): ProseWikilinkOccurrence {
  return {
    raw,
    linkpath: raw.slice(2, -2),
    displayText: null,
    start: 7,
    end: 7 + raw.length
  };
}

test("queues one offer and remembers an explicit dismissal for the session", () => {
  const session = new StoryWorldEventAuthoringSession();
  const link = occurrence();
  equal(session.enqueueCandidate("Scene.md", link, "The Failure"), true);
  equal(session.enqueueCandidate("Scene.md", link, "The Failure"), false);
  equal(session.getPending("Scene.md")?.kind, "create-event");
  equal(session.dismiss("Scene.md"), true);
  equal(session.getPending("Scene.md"), null);
  equal(session.enqueueCandidate("Scene.md", link, "The Failure"), false);
});

test("replaces the creation offer with a separate World Context decision", () => {
  const session = new StoryWorldEventAuthoringSession();
  const link = occurrence();
  session.enqueueCandidate("Scene.md", link, "The Failure");
  const pending = session.getPending("Scene.md");
  if (!pending || pending.kind !== "create-event") throw new Error("Expected candidate");

  equal(session.markCreated("Scene.md", pending, {
    eventName: "The Failure",
    eventPath: "Story World/Events/The Failure.md",
    reference: "[[The Failure]]",
    sourceRawLink: link.raw
  }), true);
  equal(session.getPending("Scene.md")?.kind, "add-world-context");
  equal(session.complete("Scene.md"), true);
  equal(session.getPending("Scene.md"), null);
});

test("removes stale creation offers when their prose link disappears", () => {
  const session = new StoryWorldEventAuthoringSession();
  session.seed("Scene.md", "Before [[The Failure]].");
  session.enqueueCandidate("Scene.md", occurrence(), "The Failure");
  session.updateText("Scene.md", "Before the failure.", 19);
  equal(session.getPending("Scene.md"), null);
});

test("retains a post-creation World Context offer when prose tracking refreshes", () => {
  const session = new StoryWorldEventAuthoringSession();
  const link = occurrence();
  session.enqueueCandidate("Scene.md", link, "The Failure");
  const pending = session.getPending("Scene.md");
  if (!pending || pending.kind !== "create-event") throw new Error("Expected candidate");
  session.markCreated("Scene.md", pending, {
    eventName: "The Failure",
    eventPath: "Story World/Events/The Failure.md",
    reference: "[[The Failure]]",
    sourceRawLink: link.raw
  });
  session.seed("Scene.md", "The prose link was later removed.");
  session.updateText("Scene.md", "The prose link was later removed. More.", 39);
  equal(session.getPending("Scene.md")?.kind, "add-world-context");
});
