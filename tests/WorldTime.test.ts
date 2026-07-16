import { equal } from "node:assert/strict";
import { test } from "node:test";
import {
  getWorldEventDisplayTime,
  getWorldEventRelativeTiming,
  getWorldEventTimePresentation
} from "../src/story-world/WorldTime";
import { StoryWorldEntityRecord } from "../src/story-world/StoryWorldIndex";

function entity(
  entityType: string,
  worldTime: unknown,
  name = "The Article"
): StoryWorldEntityRecord {
  return {
    path: "World/Event.md",
    basename: "Event",
    entityType,
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

test("formats scalar ISO values using evident precision", () => {
  equal(getWorldEventDisplayTime(entity("event", "2026")), "2026");
  equal(getWorldEventDisplayTime(entity("event", "2026-07")), "July 2026");
  equal(
    getWorldEventDisplayTime(entity("event", "2026-07-16")),
    "Thursday, 16 July 2026"
  );
  equal(
    getWorldEventDisplayTime(entity("event", "2026-07-16T14:22+01:00")),
    "Thursday, 16 July 2026, 14:22"
  );
  equal(
    getWorldEventDisplayTime(entity("event", "2026-07-16T14:22:37+01:00")),
    "Thursday, 16 July 2026, 14:22:37"
  );
});

test("declared precision suppresses finer ISO detail", () => {
  equal(
    getWorldEventDisplayTime(entity("event", {
      from: "2026-07-16T14:22:37+01:00",
      precision: "day"
    })),
    "Thursday, 16 July 2026"
  );
  equal(
    getWorldEventDisplayTime(entity("event", {
      from: "2026-07-16T14:22:37+01:00",
      precision: "hour"
    })),
    "Thursday, 16 July 2026, 14:00"
  );
  equal(
    getWorldEventDisplayTime(entity("event", {
      from: "2026-07-16T14:22:37+01:00",
      precision: "minute"
    })),
    "Thursday, 16 July 2026, 14:22"
  );
});

test("does not manufacture finer precision than the source provides", () => {
  equal(
    getWorldEventDisplayTime(entity("event", {
      at: "2026-07-16",
      precision: "second"
    })),
    "Thursday, 16 July 2026"
  );
});

test("preserves the written story date and wall-clock time across offsets", () => {
  equal(
    getWorldEventDisplayTime(entity("event", {
      at: "2026-07-16T00:30:00+14:00",
      precision: "minute"
    })),
    "Thursday, 16 July 2026, 00:30"
  );
});

test("preserves ranges instead of presenting them as point events", () => {
  const presentation = getWorldEventTimePresentation(entity("event", {
    from: "2026-07-16T14:22:00+01:00",
    until: "2026-07-16T14:25:00+01:00",
    precision: "minute"
  }));

  equal(
    presentation?.display,
    "Thursday, 16 July 2026, 14:22 – Thursday, 16 July 2026, 14:25"
  );
  equal(presentation?.point, false);
  equal(presentation?.datetime, null);
});

test("falls back conservatively for unknown declared precision", () => {
  equal(
    getWorldEventDisplayTime(entity("event", {
      at: "2026-07-16T14:22:00+01:00",
      precision: "observed-window"
    })),
    "2026-07-16T14:22:00+01:00"
  );
});

test("calculates before, after and same-day relative labels", () => {
  const event = entity("event", {
    at: "2026-07-16T14:22:00+01:00",
    precision: "minute"
  });

  equal(
    getWorldEventRelativeTiming(event, "2026-07-15"),
    "1 day before The Article"
  );
  equal(
    getWorldEventRelativeTiming(event, "2026-07-18"),
    "2 days after The Article"
  );
  equal(
    getWorldEventRelativeTiming(event, "2026-07-16"),
    "On the day of The Article"
  );
});

test("relative timing handles leap years and year boundaries", () => {
  equal(
    getWorldEventRelativeTiming(
      entity("event", { at: "2024-02-29", precision: "day" }),
      "2024-03-01"
    ),
    "1 day after The Article"
  );
  equal(
    getWorldEventRelativeTiming(
      entity("event", { at: "2026-12-31", precision: "day" }),
      "2027-01-02"
    ),
    "2 days after The Article"
  );
});

test("omits relative timing for ranges and insufficient precision", () => {
  equal(
    getWorldEventRelativeTiming(
      entity("event", {
        from: "2026-07-16",
        until: "2026-07-18",
        precision: "day"
      }),
      "2026-07-17"
    ),
    null
  );
  equal(
    getWorldEventRelativeTiming(
      entity("event", { at: "2026-07", precision: "month" }),
      "2026-07-17"
    ),
    null
  );
});

test("ignores malformed time and non-event entities", () => {
  equal(getWorldEventDisplayTime(entity("event", { precision: "hour" })), null);
  equal(getWorldEventDisplayTime(entity("event", "2026-02-30")), null);
  equal(
    getWorldEventDisplayTime(entity("character", "2026-07-16")),
    null
  );
});
