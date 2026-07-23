import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  buildContinuityObservation,
  ObservationEvidence,
  ObservationNoteReference
} from "../src/observations/ContinuityObservation";
import {
  chapterContextCardNavigationNotes,
  manuscriptChronologyCardPresentation,
  readableSceneLabel
} from "../src/companion/ContinuityCardPresentation";

const book = note("Books/Book.md", "Book");
const partOne = note("Books/Part One.md", "Absence");
const partTwo = note("Books/Part Two.md", "Experiment");

function note(path: string, label: string, role: "manuscript" | "story_world" = "manuscript") {
  return { role, path, label } satisfies ObservationNoteReference;
}

function date(scene: ObservationNoteReference, role: string, value: string): ObservationEvidence {
  return {
    role,
    source: { note: scene, property: ["story_date"] },
    value: { kind: "date", value, precision: "day" }
  };
}

function sequence(scene: ObservationNoteReference, part: ObservationNoteReference): ObservationEvidence[] {
  return [{
    role: "part_parent",
    source: { note: part, property: ["parent"] },
    value: { kind: "resolved_note", note: book }
  }, {
    role: "scene_parent",
    source: { note: scene, property: ["parent"] },
    value: { kind: "resolved_note", note: part }
  }];
}

function chronology(
  first: ObservationNoteReference,
  second: ObservationNoteReference,
  firstPart = partOne,
  secondPart = partOne
) {
  return buildContinuityObservation({
    kind: "manuscript.chronology.reversal",
    severity: "review",
    classification: "review_concern",
    primary: second,
    evidence: [
      date(first, "previous_scene_story_date", "2028-05-02"),
      date(second, "later_scene_story_date", "2028-05-01"),
      ...sequence(first, firstPart),
      ...sequence(second, secondPart)
    ],
    summary: "Scene chronology reverses manuscript order",
    explanation: "Review the transition.",
    rule: { id: "mwc.manuscript.chronology.reversal", version: 1 },
    logicalOccurrence: { first: first.path, second: second.path }
  });
}

test("prefers an authoritative non-empty title and falls back to basename", () => {
  equal(readableSceneLabel({ title: "  Domestic Distance  " }, "1 Domestic Distance"), "Domestic Distance");
  equal(readableSceneLabel({ title: "  " }, "1 Domestic Distance"), "1 Domestic Distance");
  equal(readableSceneLabel(undefined, "1 Domestic Distance"), "1 Domestic Distance");
});

test("Book Review navigation includes direct scenes but omits book and part actions", () => {
  const first = note("Books/Part One/1.md", "Domestic Distance");
  const second = note("Books/Part One/2.md", "Tobias in the Wilderness");
  const presentation = manuscriptChronologyCardPresentation(chronology(first, second));
  deepEqual(presentation.navigationNotes.map((item) => item.label), [
    "Tobias in the Wilderness",
    "Domestic Distance"
  ]);
  equal(presentation.navigationNotes.some((item) => item.path === book.path), false);
  equal(presentation.navigationNotes.some((item) => item.path === partOne.path), false);
  deepEqual(presentation.partContext, []);
});

test("duplicate titles receive restrained part disambiguation", () => {
  const first = note("Books/Part One/Return.md", "Return");
  const second = note("Books/Part Two/Return.md", "Return");
  const presentation = manuscriptChronologyCardPresentation(
    chronology(first, second, partOne, partTwo)
  );
  deepEqual(new Set(presentation.partContext), new Set([
    "Return · Absence",
    "Return · Experiment"
  ]));
});

test("cross-part transitions may show secondary part context without part actions", () => {
  const first = note("Books/Part One/Invitation.md", "An Invitation to Write");
  const second = note("Books/Part Two/Response.md", "Prime Reassesses Humans");
  const presentation = manuscriptChronologyCardPresentation(
    chronology(first, second, partOne, partTwo)
  );
  deepEqual(new Set(presentation.partContext), new Set([
    "An Invitation to Write · Absence",
    "Prime Reassesses Humans · Experiment"
  ]));
  equal(presentation.navigationNotes.some((item) => item.path === partOne.path), false);
  equal(presentation.navigationNotes.some((item) => item.path === partTwo.path), false);
});

test("chapter-context cards expose directly relevant Story World notes only", () => {
  const chapter = note("Books/Chapter.md", "Chapter");
  const event = note("World/Event.md", "The Event", "story_world");
  const observation = buildContinuityObservation({
    kind: "chapter-context.event.after-chapter",
    severity: "conflict",
    classification: "contradiction",
    primary: chapter,
    evidence: [
      date(chapter, "chapter_story_date", "2028-05-01"),
      { role: "owning_book", source: { note: book, property: ["title"] }, value: { kind: "value", value: "Book" } },
      { role: "event", source: { note: event, property: ["world_time"] }, value: { kind: "date", value: "2028-05-02", precision: "day" } }
    ],
    summary: "Event occurs later",
    explanation: "Review event timing.",
    rule: { id: "mwc.chapter-context.event-after-chapter", version: 1 },
    logicalOccurrence: { event: event.path }
  });
  deepEqual(chapterContextCardNavigationNotes(observation), [event]);
});
