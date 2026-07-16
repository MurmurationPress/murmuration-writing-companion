import { equal } from "node:assert/strict";
import { test } from "node:test";
import { getWorldEventDisplayTime } from "../src/story-world/WorldTime";
import { StoryWorldEntityRecord } from "../src/story-world/StoryWorldIndex";

function entity(
  entityType: string,
  worldTime: unknown
): StoryWorldEntityRecord {
  return {
    path: "World/Event.md",
    basename: "Event",
    entityType,
    name: "Event",
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

test("reads scalar event time", () => {
  equal(
    getWorldEventDisplayTime(entity("event", "2029-04-19")),
    "2029-04-19"
  );
});

test("reads structured event time from the authoritative from value", () => {
  equal(
    getWorldEventDisplayTime(entity("event", {
      from: "2029-04-19T09:00:00+01:00",
      precision: "hour"
    })),
    "2029-04-19T09:00:00+01:00"
  );
});

test("ignores malformed time and non-event entities", () => {
  equal(getWorldEventDisplayTime(entity("event", { precision: "hour" })), null);
  equal(
    getWorldEventDisplayTime(entity("character", "2029-04-19")),
    null
  );
});
