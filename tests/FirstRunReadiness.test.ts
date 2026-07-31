import { equal } from "node:assert/strict";
import { test } from "node:test";
import { FirstRunReadinessPreference, firstRunReadinessKey } from "../src/onboarding/FirstRunReadiness";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

test("the first-run invitation waits for indexes and is shown once across reloads", () => {
  const storage = new MemoryStorage();
  const key = firstRunReadinessKey("mwc", "PRIME");
  const preference = new FirstRunReadinessPreference(storage, key);
  equal(preference.shouldInvite(false), false);
  equal(preference.shouldInvite(true), true);
  preference.markShown();
  equal(new FirstRunReadinessPreference(storage, key).shouldInvite(true), false);
});

test("vault-local dismissal does not write when storage is unavailable", () => {
  const preference = new FirstRunReadinessPreference(null, "readiness");
  equal(preference.shouldInvite(true), true);
  preference.markShown();
  equal(preference.hasBeenShown(), false);
});

test("different vaults retain independent invitation state", () => {
  const storage = new MemoryStorage();
  const first = new FirstRunReadinessPreference(storage, firstRunReadinessKey("mwc", "A"));
  const second = new FirstRunReadinessPreference(storage, firstRunReadinessKey("mwc", "B"));
  first.markShown();
  equal(first.shouldInvite(true), false);
  equal(second.shouldInvite(true), true);
});

test("the first MWC interaction hints once until readiness is opened", () => {
  const storage = new MemoryStorage();
  const preference = new FirstRunReadinessPreference(storage, "readiness");
  equal(preference.shouldHintOnFirstInteraction(), true);
  preference.markInteractionHintShown();
  equal(preference.shouldHintOnFirstInteraction(), false);
  const anotherInstall = new FirstRunReadinessPreference(new MemoryStorage(), "readiness");
  anotherInstall.markOpened();
  equal(anotherInstall.shouldHintOnFirstInteraction(), false);
});
