/* Paste into Obsidian's developer console, then call startMwcInteractionCapture().
 * Development-only: never imported by the plugin; no content, paths or key values.
 */
globalThis.startMwcInteractionCapture = function ({ app = globalThis.app, win = globalThis.window } = {}) {
  const plugin = app?.plugins?.plugins?.["murmuration-writing-companion"];
  if (!plugin) throw new Error("Enable MWC before starting the capture.");
  if (win.mwcInteractionCapture) throw new Error("Stop the previous capture first.");
  const records = [], cleanup = [], pointers = new Map(), ids = new WeakMap(), calls = new Map();
  const start = win.performance.now();
  let nextId = 0, dropped = 0, stopped = false;
  const id = node => {
    if (!node || (typeof node !== "object" && typeof node !== "function")) return null;
    if (!ids.has(node)) ids.set(node, ++nextId);
    return ids.get(node);
  };
  const record = (kind, data = {}) => {
    if (stopped) return;
    if (records.length >= 5000) { dropped++; return; }
    records.push({ t: win.performance.now() - start, kind, ...data });
  };
  const describe = node => ({
    node: id(node), connected: Boolean(node?.isConnected),
    disabled: Boolean(node?.disabled),
    activeElement: node === win.document.activeElement,
    pane: id(node?.closest?.(".workspace-leaf")),
    activePane: Boolean(app.workspace.activeLeaf?.containerEl?.contains(node))
  });
  const listen = (target, event, handler) => {
    target.addEventListener(event, handler, true);
    cleanup.push(() => target.removeEventListener(event, handler, true));
  };
  for (const type of ["pointerdown", "pointerup", "pointercancel", "click", "focusin", "focusout", "input", "change", "keydown"]) {
    listen(win.document, type, event => {
      const target = event.target;
      if (type === "pointerdown") pointers.set(event.pointerId, target);
      record(type, { ...describe(target), trusted: event.isTrusted,
        defaultPreventedAtCapture: event.defaultPrevented,
        ...(type.startsWith("pointer") ? { pointer: event.pointerId } : {}) });
      if (type === "pointerup" || type === "pointercancel") {
        const down = pointers.get(event.pointerId);
        record("press-end", { down: id(down), downConnected: Boolean(down?.isConnected), up: id(target) });
        pointers.delete(event.pointerId);
      }
      if (type === "click" || type === "input") {
        // A frame opportunity is not proof of paint or successful action execution.
        const began = win.performance.now();
        const frame = win.requestAnimationFrame(() => {
          frames.delete(frame);
          record("next-frame-opportunity", { event: type, node: id(target), elapsedMs: win.performance.now() - began });
        });
        frames.add(frame);
      }
    });
  }
  const frames = new Set();
  cleanup.push(() => { for (const frame of frames) win.cancelAnimationFrame(frame); });
  for (const event of ["focus", "blur"]) listen(win, event, () => record(`window-${event}`));
  listen(win.document, "visibilitychange", () => record("visibility", { hidden: win.document.hidden }));
  const mutations = new win.MutationObserver(entries => {
    let added = 0, removed = 0;
    for (const entry of entries) { added += entry.addedNodes.length; removed += entry.removedNodes.length; }
    record("dom-batch", { added, removed });
    for (const [pointer, target] of pointers) {
      if (!target.isConnected) record("pressed-target-removed", { pointer, node: id(target) });
    }
  });
  mutations.observe(win.document.body, { childList: true, subtree: true });
  cleanup.push(() => mutations.disconnect());
  // Only fixed method labels and numeric timings are recorded, never arguments/results.
  const wrapped = new WeakMap();
  const wrap = (owner, name, label) => {
    if (!owner || typeof owner[name] !== "function") return;
    let names = wrapped.get(owner);
    if (!names) wrapped.set(owner, names = new Set());
    if (names.has(name)) return;
    names.add(name);
    const original = owner[name], own = Object.getOwnPropertyDescriptor(owner, name);
    const replacement = function (...args) {
      const began = win.performance.now();
      try { return original.apply(this, args); }
      finally {
        const elapsedMs = win.performance.now() - began;
        const total = calls.get(label) ?? { count: 0, totalMs: 0, maxMs: 0 };
        total.count++; total.totalMs += elapsedMs; total.maxMs = Math.max(total.maxMs, elapsedMs);
        calls.set(label, total);
        if (name.startsWith("refresh") || name === "render" || name === "save") record("call", { label, elapsedMs });
      }
    };
    try { owner[name] = replacement; }
    catch { record("wrapper-unavailable", { label }); return; }
    cleanup.push(() => {
      if (owner[name] !== replacement) return; // Do not undo another tool's later wrapper.
      if (own) Object.defineProperty(owner, name, own); else delete owner[name];
    });
  };
  for (const name of ["refreshView", "refreshManuscriptNavigator", "refreshContinuityReview", "refreshStoryWorldNavigator", "refreshStoryWorldReview", "refreshStoryWorldGraph", "refreshStoryWorldTimeline", "updateChapterContextProperty", "navigateToAnnotation"]) wrap(plugin, name, name);
  for (const [key, names] of [
    ["storyWorldIndex", ["rebuild", "handleMetadataChanged"]],
    ["storyWorldReviewProjection", ["get", "invalidate", "refreshMetadata"]],
    ["manuscriptProjection", ["get", "rebuild", "publish"]],
    ["storeService", ["save", "updateChapterNote", "flushChapterNote", "addAnnotation"]]
  ]) for (const name of names) wrap(plugin[key], name, `${key}.${name}`);
  for (const name of ["getAll", "upsert"]) wrap(plugin.storyWorldIndex?.index, name, `index.${name}`);
  // These counters include native/other-plugin work; compare isolated MWC captures.
  wrap(app.vault, "getMarkdownFiles", "vault.getMarkdownFiles");
  const viewTypes = ["murmuration-writing-companion-view", "murmuration-manuscript-navigator-view", "murmuration-story-world-navigator", "murmuration-story-world-timeline", "murmuration-story-world-review", "murmuration-story-world-graph", "murmuration-continuity-review"];
  const attachViews = () => {
    for (const type of viewTypes) for (const leaf of app.workspace.getLeavesOfType(type)) {
      const view = leaf.view;
      wrap(view, "render", `${type}.render`);
    }
  };
  attachViews();
  for (const [owner, events] of [[app.workspace, ["active-leaf-change", "file-open", "layout-change", "editor-change"]], [app.metadataCache, ["changed", "resolved"]]]) {
    for (const event of events) {
      const ref = owner.on(event, () => { record(`obsidian-${event}`); if (event === "layout-change") attachViews(); });
      cleanup.push(() => owner.offref(ref));
    }
  }
  if (win.PerformanceObserver) for (const type of ["event", "longtask"]) {
    try {
      const observer = new win.PerformanceObserver(list => {
        for (const entry of list.getEntries()) record(type === "event" ? "event-timing" : "long-task", {
          startMs: entry.startTime - start, durationMs: entry.duration,
          ...(type === "event" ? { inputDelayMs: entry.processingStart - entry.startTime,
            processingMs: entry.processingEnd - entry.processingStart, interaction: entry.interactionId } : {})
        });
      });
      observer.observe({ type, buffered: false, ...(type === "event" ? { durationThreshold: 16 } : {}) });
      cleanup.push(() => observer.disconnect());
    } catch { record("observer-unavailable", { type }); }
  }
  const capture = {
    snapshot: () => ({ schema: 1, limit: 5000, dropped, calls: Object.fromEntries([...calls].map(([label, total]) => [label, { ...total }])), records: records.map(row => ({ ...row })) }),
    stop: () => {
      if (stopped) return capture.snapshot();
      for (const dispose of cleanup.reverse()) dispose();
      record("stop"); stopped = true; pointers.clear();
      if (win.mwcInteractionCapture === capture) delete win.mwcInteractionCapture;
      return capture.snapshot();
    }
  };
  win.mwcInteractionCapture = capture;
  record("start");
  return capture;
};
