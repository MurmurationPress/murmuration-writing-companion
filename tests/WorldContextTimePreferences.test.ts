import { equal, match } from "node:assert/strict";
import { test } from "node:test";
import {
  createWorldContextTimePreferenceKey,
  parseWorldContextTimePreference,
  serializeWorldContextTimePreference,
  WorldContextTimePreferences
} from "../src/companion/WorldContextTimePreferences";

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

test("defaults missing or malformed preferences to automatic", () => {
  equal(parseWorldContextTimePreference(null), "automatic");
  equal(parseWorldContextTimePreference("not json"), "automatic");
  equal(
    parseWorldContextTimePreference(JSON.stringify({
      version: 1,
      relativeTimeMode: "fortnights"
    })),
    "automatic"
  );
});

test("round-trips each supported presentation mode", () => {
  for (const mode of ["automatic", "calendar", "total-months", "total-days"] as const) {
    equal(
      parseWorldContextTimePreference(serializeWorldContextTimePreference(mode)),
      mode
    );
  }
});

test("persists presentation state without manuscript data", () => {
  const storage = new MemoryStorage();
  const key = createWorldContextTimePreferenceKey(
    "murmuration-writing-companion",
    "PrimeTrilogy",
    "/vault/PrimeTrilogy"
  );
  const preferences = new WorldContextTimePreferences(storage, key);

  equal(preferences.getMode(), "automatic");
  equal(preferences.setMode("calendar"), true);
  equal(preferences.getMode(), "calendar");
  equal(preferences.setMode("calendar"), false);
  match(storage.values.get(key) ?? "", /calendar/);

  const reloaded = new WorldContextTimePreferences(storage, key);
  equal(reloaded.getMode(), "calendar");
});

test("uses a vault-specific preference key", () => {
  const first = createWorldContextTimePreferenceKey("mwc", "Vault A", "/one");
  const second = createWorldContextTimePreferenceKey("mwc", "Vault A", "/two");
  equal(first === second, false);
});
