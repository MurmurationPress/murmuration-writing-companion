import { equal, rejects } from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import type { Annotation } from "../src/editorial/EditorialNote";

test("failed creation rolls back, and retry after count-projection failure does not duplicate the saved draft", async () => {
  const { build } = createRequire(import.meta.url)("esbuild") as typeof import("esbuild");
  const result = await build({ entryPoints: ["src/editorial/EditorialStore.ts"], bundle: true, platform: "node", format: "cjs", external: ["obsidian"], write: false });
  const module = { exports: {} as any };
  const obsidian = new Proxy({}, { get: () => class {} });
  runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require: () => obsidian, crypto: globalThis.crypto });
  const annotations: Annotation[] = [];
  let failSave = true, failProjection = false;
  const host = { getPage: () => ({ annotations }), save: async () => { if (failSave) throw new Error("disk unavailable"); },
    syncOpenAnnotationProperty: async () => { if (failProjection) throw new Error("count unavailable"); }, onChange: () => {} };
  const add = (id: string, body = "Draft") => module.exports.EditorialStoreService.prototype.addAnnotation.call(host, { path: "Scene.md" }, { text: "passage" }, body, "Editorial", id);
  await rejects(add("first"), /disk unavailable/); equal(annotations.length, 0);
  failSave = false; await add("first"); equal(annotations.length, 1);
  failProjection = true; await rejects(add("second"), /count unavailable/); equal(annotations.length, 2);
  failProjection = false; await add("second", "Revised draft"); equal(annotations.length, 2); equal(annotations[1].body, "Revised draft");
});
