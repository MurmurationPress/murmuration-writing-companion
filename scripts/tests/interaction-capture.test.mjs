import { test } from "node:test";
import { equal, deepEqual, throws, strictEqual } from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../diagnostics/capture-interactions.js", import.meta.url), "utf8");
function host() {
  const document = new EventTarget(), win = new EventTarget();
  let observer, tick = 0;
  const frames = new Map();
  const events = () => ({ handlers: new Map(), on(name, fn) { this.handlers.set(name, fn); return name; }, offref(name) { this.handlers.delete(name); }, getLeavesOfType: () => [] });
  const plugin = { refreshView() { return this; }, storeService: { save: () => Promise.resolve("private result") } };
  const app = { plugins: { plugins: { "murmuration-writing-companion": plugin } }, workspace: events(), metadataCache: events(), vault: { getMarkdownFiles: () => ["private path"] } };
  Object.assign(win, { document, performance: { now: () => ++tick }, MutationObserver: class {
    constructor(fn) { observer = fn; } observe() {} disconnect() { observer = null; }
  }, requestAnimationFrame(fn) { const id = ++tick; frames.set(id, fn); return id; }, cancelAnimationFrame(id) { frames.delete(id); } });
  document.body = {};
  const context = vm.createContext({}); vm.runInContext(source, context);
  const start = () => context.startMwcInteractionCapture({ app, win });
  const dispatch = (type, target, pointerId = 1) => {
    const event = new Event(type);
    Object.defineProperties(event, { target: { value: target }, pointerId: { value: pointerId } });
    document.dispatchEvent(event);
  };
  return { start, plugin, app, win, document, dispatch, frames, mutate: entries => observer(entries) };
}

test("capture observes a removed press target without activating or retrying it (simulated events only)", () => {
  const h = host(), capture = h.start();
  const target = { isConnected: true, textContent: "PRIVATE", value: "PRIVATE", path: "PRIVATE" };
  h.dispatch("pointerdown", target); target.isConnected = false;
  h.mutate([{ addedNodes: [{}], removedNodes: [target] }]);
  h.dispatch("pointerup", { isConnected: true });
  const report = capture.stop();
  equal(report.records.filter(row => row.kind === "pressed-target-removed").length, 1);
  equal(report.records.find(row => row.kind === "press-end").downConnected, false);
  equal(report.records.filter(row => row.kind === "click").length, 0);
  equal(JSON.stringify(report).includes("PRIVATE"), false);
});

test("wrappers preserve this, arguments, return/promise identity, errors and exactly one invocation", () => {
  const h = host(); let calls = 0;
  const promise = Promise.resolve("PRIVATE");
  h.plugin.refreshView = function (arg) { calls++; strictEqual(this, h.plugin); equal(arg, "PRIVATE"); return promise; };
  const original = h.plugin.refreshView, capture = h.start();
  strictEqual(h.plugin.refreshView("PRIVATE"), promise); equal(calls, 1);
  capture.stop(); strictEqual(h.plugin.refreshView, original);
  const failure = new Error("PRIVATE");
  h.plugin.refreshView = () => { throw failure; };
  const second = h.start(); throws(() => h.plugin.refreshView(), err => err === failure);
  equal(JSON.stringify(second.stop()).includes("PRIVATE"), false);
});

test("stop removes listeners, wrappers and pending frames; snapshots are independent", () => {
  const h = host(), original = h.app.vault.getMarkdownFiles, capture = h.start();
  throws(() => h.start(), /previous capture/);
  h.dispatch("click", { isConnected: true }); equal(h.frames.size, 1);
  const copy = capture.snapshot(); copy.records[0].kind = "changed";
  equal(capture.snapshot().records[0].kind, "start");
  const stopped = capture.stop();
  equal(h.frames.size, 0); equal(h.app.workspace.handlers.size, 0); equal(h.app.metadataCache.handlers.size, 0);
  strictEqual(h.app.vault.getMarkdownFiles, original);
  h.dispatch("click", {}); deepEqual(capture.snapshot(), stopped); deepEqual(capture.stop(), stopped);
});

test("trace is bounded and reports dropped entries", () => {
  const h = host(), capture = h.start();
  for (let i = 0; i < 6000; i++) h.dispatch("keydown", {});
  const result = capture.stop(); equal(result.records.length, 5000); equal(result.dropped > 0, true);
});

test("stop restores inherited methods without overwriting later wrappers", () => {
  const h = host(), inherited = () => "original";
  delete h.plugin.refreshView; Object.setPrototypeOf(h.plugin, { refreshView: inherited });
  const capture = h.start(); capture.stop();
  equal(Object.hasOwn(h.plugin, "refreshView"), false); strictEqual(h.plugin.refreshView, inherited);
  const second = h.start(), later = () => "later";
  h.plugin.refreshView = later; second.stop(); strictEqual(h.plugin.refreshView, later);
});
