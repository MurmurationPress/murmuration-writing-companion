import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  createVaultBackupRemotePreferenceKey,
  VaultBackupRemotePreference,
  vaultBackupRemoteOptions
} from "../src/backup/VaultBackupRemotePreference";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); }
    }
  };
}

test("persists and reloads only the explicitly selected remote name", () => {
  const memory = memoryStorage();
  const key = createVaultBackupRemotePreferenceKey("mwc", "Author Vault");
  const preference = new VaultBackupRemotePreference(memory.storage, key);
  equal(preference.get(), null);
  preference.set("upstream");
  deepEqual([...memory.values.entries()], [[key, "upstream"]]);
  equal(new VaultBackupRemotePreference(memory.storage, key).get(), "upstream");
});

test("missing and malformed legacy preference state loads compatibly", () => {
  const memory = memoryStorage();
  memory.values.set("backup", "   ");
  equal(new VaultBackupRemotePreference(memory.storage, "backup").get(), null);
  const unavailable = new VaultBackupRemotePreference({
    getItem: () => { throw new Error("unavailable"); },
    setItem: () => { throw new Error("unavailable"); },
    removeItem: () => { throw new Error("unavailable"); }
  }, "backup");
  equal(unavailable.get(), null);
  unavailable.set("upstream");
  equal(unavailable.get(), "upstream");
});

test("clearing an override removes the one persisted value", () => {
  const memory = memoryStorage();
  const preference = new VaultBackupRemotePreference(memory.storage, "backup");
  preference.set("upstream");
  preference.set(null);
  equal(memory.values.size, 0);
  equal(preference.get(), null);
});

test("Settings remote options contain only detected ambiguous remote names", () => {
  deepEqual(vaultBackupRemoteOptions(["backup", "upstream"]), ["backup", "upstream"]);
  deepEqual(vaultBackupRemoteOptions(["origin", "upstream"]), []);
  deepEqual(vaultBackupRemoteOptions(["upstream"]), []);
  deepEqual(vaultBackupRemoteOptions([]), []);
});
