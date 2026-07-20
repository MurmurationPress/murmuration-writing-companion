import { equal } from "node:assert/strict";
import { test } from "node:test";
import {
  getWorldEventRelativeTimingPresentation
} from "../src/story-world/WorldRelativeTime";
import { StoryWorldEntityRecord } from "../src/story-world/StoryWorldIndex";

function event(worldTime: unknown, name = "The Article"): StoryWorldEntityRecord {
  return {
    path: "World/Event.md",
    basename: "Event",
    entityType: "event",
    name,
    aliases: [],
    facets: [],
    scope: [],
    status: "confirmed",
    summary: null,
    firstAppearance: null,
    sources: [],
    links: [],
    properties: { world_time: worldTime }
  };
}

test("presents the Robin birth offset as a calendar interval", () => {
  const robin = event(
    { at: "2027-09-23", precision: "day" },
    "Robin is Born"
  );

  const automatic = getWorldEventRelativeTimingPresentation(
    robin,
    "2029-06-28"
  );
  equal(automatic?.display, "1 year, 9 months, 5 days after Robin is Born");
  equal(automatic?.resolvedMode, "calendar");
  equal(automatic?.exactTotalDays, 644);
  equal(automatic?.exactTotalDayDisplay, "644 days after Robin is Born");

  equal(
    getWorldEventRelativeTimingPresentation(
      robin,
      "2029-06-28",
      robin.name,
      "calendar"
    )?.display,
    "1 year, 9 months, 5 days after Robin is Born"
  );
});

test("supports total months and total days modes", () => {
  const robin = event(
    { at: "2027-09-23", precision: "day" },
    "Robin is Born"
  );

  equal(
    getWorldEventRelativeTimingPresentation(
      robin,
      "2029-06-28",
      robin.name,
      "total-months"
    )?.display,
    "21 months, 5 days after Robin is Born"
  );
  equal(
    getWorldEventRelativeTimingPresentation(
      robin,
      "2029-06-28",
      robin.name,
      "total-days"
    )?.display,
    "644 days after Robin is Born"
  );
});

test("automatic mode keeps short intervals in days", () => {
  const article = event({ at: "2026-07-16", precision: "day" });
  const timing = getWorldEventRelativeTimingPresentation(article, "2026-07-18");

  equal(timing?.display, "2 days after The Article");
  equal(timing?.resolvedMode, "total-days");
});

test("automatic mode uses months below a year and omits zero units", () => {
  const article = event({ at: "2026-01-15", precision: "day" });

  equal(
    getWorldEventRelativeTimingPresentation(article, "2026-04-18")?.display,
    "3 months, 3 days after The Article"
  );
  equal(
    getWorldEventRelativeTimingPresentation(
      event({ at: "2024-02-29", precision: "day" }),
      "2026-03-03",
      "Leap Event",
      "calendar"
    )?.display,
    "2 years, 3 days after Leap Event"
  );
});

test("calendar decomposition clamps month ends deterministically", () => {
  const january = event({ at: "2026-01-31", precision: "day" });

  equal(
    getWorldEventRelativeTimingPresentation(
      january,
      "2026-02-28",
      january.name,
      "calendar"
    )?.display,
    "1 month after The Article"
  );
  equal(
    getWorldEventRelativeTimingPresentation(
      january,
      "2026-03-01",
      january.name,
      "calendar"
    )?.display,
    "1 month, 1 day after The Article"
  );
});

test("calendar decomposition clamps leap-day years deterministically", () => {
  const leap = event({ at: "2024-02-29", precision: "day" }, "Leap Event");

  equal(
    getWorldEventRelativeTimingPresentation(
      leap,
      "2025-02-28",
      leap.name,
      "calendar"
    )?.display,
    "1 year after Leap Event"
  );
  equal(
    getWorldEventRelativeTimingPresentation(
      leap,
      "2025-03-01",
      leap.name,
      "calendar"
    )?.display,
    "1 year, 1 day after Leap Event"
  );
});

test("before and after magnitudes are symmetric", () => {
  const article = event({ at: "2026-04-30", precision: "day" });
  const before = getWorldEventRelativeTimingPresentation(
    article,
    "2025-01-28",
    article.name,
    "calendar"
  );
  const reverseEvent = event({ at: "2025-01-28", precision: "day" });
  const after = getWorldEventRelativeTimingPresentation(
    reverseEvent,
    "2026-04-30",
    reverseEvent.name,
    "calendar"
  );

  equal(before?.display, "1 year, 3 months, 2 days before The Article");
  equal(after?.display, "1 year, 3 months, 2 days after The Article");
});

test("preserves same-day wording and singular forms", () => {
  const article = event({ at: "2026-07-16", precision: "day" });

  equal(
    getWorldEventRelativeTimingPresentation(article, "2026-07-16")?.display,
    "On the day of The Article"
  );
  equal(
    getWorldEventRelativeTimingPresentation(article, "2026-07-15")?.display,
    "1 day before The Article"
  );
});

test("does not shift explicit timezone dates", () => {
  equal(
    getWorldEventRelativeTimingPresentation(
      event({ at: "2026-07-16T00:30:00+14:00", precision: "minute" }),
      "2026-07-17T23:30:00-12:00"
    )?.display,
    "1 day after The Article"
  );
});

test("omits intervals for ranges, insufficient precision and invalid dates", () => {
  equal(
    getWorldEventRelativeTimingPresentation(
      event({
        from: "2026-07-16",
        until: "2026-07-18",
        precision: "day"
      }),
      "2026-07-17"
    ),
    null
  );
  equal(
    getWorldEventRelativeTimingPresentation(
      event({ at: "2026-07", precision: "month" }),
      "2026-07-17"
    ),
    null
  );
  equal(
    getWorldEventRelativeTimingPresentation(
      event({ at: "2026-02-28", precision: "day" }),
      "2026-02-30"
    ),
    null
  );
});
