import { equal } from "node:assert/strict";
import { test } from "node:test";
import { StoryWorldRelationAuthoringSession } from "../src/companion/StoryWorldRelationAuthoringSession";
import type { ProseWikilinkOccurrence } from "../src/companion/ProseWikilinkChanges";

const chapter = "Books/Quiet Contact.md";
const link: ProseWikilinkOccurrence = {
  raw: "[[Crap Bot goes Viral|Crap Bot]]",
  linkpath: "Crap Bot goes Viral",
  displayText: "Crap Bot",
  start: 20,
  end: 59
};

function enqueue(session: StoryWorldRelationAuthoringSession): boolean {
  return session.enqueueCandidate(
    chapter,
    link,
    3,
    "Story World/Characters/Tobias.md",
    "Tobias Hale",
    "Story World/Events/Crap Bot goes Viral.md",
    "Crap Bot goes Viral",
    "event"
  );
}

test("does not treat links present when a chapter opens as newly authored", () => {
  const session = new StoryWorldRelationAuthoringSession();
  const text = `Before ${link.raw} after`;
  session.seed(chapter, text);
  equal(session.updateText(chapter, text, text.length), null);
  equal(session.getPending(chapter), null);
});

test("queues one prompt for a newly authored resolved link", () => {
  const session = new StoryWorldRelationAuthoringSession();
  session.seed(chapter, "Before ");
  const text = `Before ${link.raw}`;
  const occurrence = session.updateText(chapter, text, text.length);
  if (!occurrence) throw new Error("Expected changed link");

  equal(enqueue(session), true);
  equal(enqueue(session), false);
  const pending = session.getPending(chapter);
  equal(pending?.kind, "author-relation");
  if (pending?.kind === "author-relation") {
    equal(pending.sourceEntityName, "Tobias Hale");
    equal(pending.targetEntityName, "Crap Bot goes Viral");
    equal(pending.sourceLine, 3);
  }
});

test("dismissal suppresses the same link identity for the session", () => {
  const session = new StoryWorldRelationAuthoringSession();
  enqueue(session);
  equal(session.dismiss(chapter), true);
  equal(session.getPending(chapter), null);
  equal(enqueue(session), false);
});

test("advances independently to a World Context decision", () => {
  const session = new StoryWorldRelationAuthoringSession();
  enqueue(session);
  const pending = session.getPending(chapter);
  if (pending?.kind !== "author-relation") throw new Error("Expected relation prompt");

  equal(session.advance(chapter, pending, {
    targetEntityPath: "Story World/Events/Crap Bot goes Viral.md",
    targetEntityName: "Crap Bot goes Viral",
    reference: "[[Crap Bot goes Viral]]",
    sourceRawLink: link.raw
  }), true);
  const followUp = session.getPending(chapter);
  equal(followUp?.kind, "add-world-context");
  equal(session.complete(chapter), true);
  equal(session.getPending(chapter), null);
});

test("can complete without offering World Context when it is already present", () => {
  const session = new StoryWorldRelationAuthoringSession();
  enqueue(session);
  const pending = session.getPending(chapter);
  if (pending?.kind !== "author-relation") throw new Error("Expected relation prompt");
  equal(session.advance(chapter, pending, null), true);
  equal(session.getPending(chapter), null);
});

test("removing the source link removes an unhandled prompt", () => {
  const session = new StoryWorldRelationAuthoringSession();
  session.seed(chapter, `Before ${link.raw}`);
  enqueue(session);
  session.updateText(chapter, "Before ", 7);
  equal(session.getPending(chapter), null);
});

test("renames chapter-local pending state", () => {
  const session = new StoryWorldRelationAuthoringSession();
  session.seed(chapter, `Before ${link.raw}`);
  enqueue(session);
  const renamed = "Books/Renamed Contact.md";
  session.rename(chapter, renamed);
  equal(session.getPending(chapter), null);
  const pending = session.getPending(renamed);
  equal(pending?.chapterPath, renamed);
});
