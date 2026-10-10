/* Paste in Obsidian DevTools in a DISPOSABLE synthetic vault. No automatic execution.
 * Supplement PR #255's pointer/DOM capture. Never deploy to an author vault.
 */
function startMwcNumberingCapture() {
  const plugin = app.plugins.plugins['murmuration-writing-companion'];
  const coordinator = plugin?.manuscriptIntegrityCoordinator;
  const service = plugin?.manuscriptNumbering?.service;
  if (!service) throw new Error('MWC numbering service not available');
  const trace = [], counts = {}, restores = [];
  let dropped = 0, stopped = false;
  const record = (name, durationMs) => {
    if (stopped) return;
    counts[name] = (counts[name] ?? 0) + 1;
    if (trace.length < 5000) trace.push({ name, atMs: performance.now(), ...(durationMs === undefined ? {} : { durationMs }) });
    else dropped++;
  };
  const wrap = (object, key, name, asyncDuration = false) => {
    const original = object?.[key]; if (typeof original !== 'function') return;
    const owned = Object.prototype.hasOwnProperty.call(object, key);
    function wrapped(...args) {
      const start = performance.now(); record(`${name}:start`);
      let result;
      try { result = original.apply(this, args); }
      catch (error) { record(`${name}:error`, performance.now() - start); throw error; }
      if (asyncDuration && result?.then) result.then(
        () => record(`${name}:end`, performance.now() - start),
        () => record(`${name}:error`, performance.now() - start));
      else record(`${name}:end`, performance.now() - start);
      return result;
    }
    object[key] = wrapped;
    restores.push(() => { if (object[key] === wrapped) { if (owned) object[key] = original; else delete object[key]; } });
  };
  wrap(service, 'renumber', 'renumber-request', true);
  wrap(service, 'renumberNow', 'renumber-pass', true);
  wrap(coordinator?.projection, 'rebuild', 'library-rebuild');
  for (const key of ['refreshView', 'refreshManuscriptNavigator', 'refreshStoryWorldGraph', 'refreshStoryWorldNavigator', 'refreshContinuityReview']) wrap(plugin, key, key);
  let viewId = 0;
  app.workspace.iterateAllLeaves(leaf => {
    if (leaf.view?.getViewType?.().includes('murmuration') || leaf.view?.plugin === plugin) {
      wrap(leaf.view, 'render', `view-${++viewId}-render`);
    }
  });
  for (const [owner, event] of [[app.metadataCache, 'changed'], [app.metadataCache, 'resolved'], [app.vault, 'modify']]) {
    const ref = owner.on(event, () => record(`host-${event}`));
    restores.push(() => owner.offref(ref));
  }
  return { stop() {
    if (!stopped) { stopped = true; restores.reverse().forEach(restore => restore()); }
    return { counts: { ...counts }, dropped, trace: trace.slice(),
      caveat: 'Host events include other writers. Renumber passes include verification and may perform zero writes. Views opened after capture are not wrapped. Async durations overlap; do not sum.' };
  } };
}
