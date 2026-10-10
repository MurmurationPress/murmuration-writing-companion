// Appended ONLY to a disposable fixture's built main.js by profile-startup.mjs.
// Never imported by the production entry. Host readiness begins before this probe.
;(() => {
  const PluginClass = module.exports.default ?? module.exports;
  const load = PluginClass.prototype.onload;
  PluginClass.prototype.onload = async function (...args) {
    if (!this.app.vault.adapter.basePath.startsWith('/tmp/mwc-startup-')) throw Error('Not a startup fixture');
    const start = performance.now(), app = this.app;
    const instance = (globalThis.__startupInstances = (globalThis.__startupInstances ?? 0) + 1);
    const probe = globalThis.__startupProbe = {start, events: [], counts: {}, context: [], ready: false, instance};
    let cause = 'plugin.onload';
    const record = (name, ms = 0, path) => {
      const entry = probe.counts[name] ??= {calls: 0, ms: 0}; entry.calls++; entry.ms += ms;
      if (probe.events.length < 30000 && !['cache.read','metadata.changed'].includes(name)) probe.events.push({name, at:performance.now()-start, ms, cause, path});
    };
    const wrap = (object, key, name) => {
      const fn = object[key]; if (typeof fn !== 'function') return;
      object[key] = function (...a) { const before = performance.now(), parent = cause; cause = `${parent}/${name}`;
        try { return fn.apply(this,a); } finally { record(name,performance.now()-before,a[0]?.path); cause = parent; }
      };
    };
    for (const [obj,key,name] of [[app.vault,'getMarkdownFiles','vault.scan'],[app.metadataCache,'getFileCache','cache.read'],[app.fileManager,'processFrontMatter','frontmatter.write']]) wrap(obj,key,name);
    for (const key of ['refreshView','renderCompanion','refreshManuscriptNavigator','renderManuscriptNavigator','scheduleManuscriptChronologyRefresh','scheduleStoryWorldMetadataRefresh','refreshStoryWorldIndexConsumers']) wrap(this,key,key);
    for (const [key,methods] of [['storyWorldIndex',['rebuild']],['manuscriptProjection',['rebuild']],['manuscriptIntegrityCoordinator',['initialise','queue','settle']],['storyWorldStartup',['initialise','settle','metadataResolved']]]) {
      let value; Object.defineProperty(this,key,{configurable:true,get:()=>value,set:next=>{value=next;for(const method of methods)wrap(next,method,`${key}.${method}`);}});
    }
    const timeout = window.setTimeout;
    window.setTimeout = function (fn,delay,...a) { const origin=cause; return timeout.call(this,typeof fn==='function'?function(...b){const parent=cause;cause=`timer(${origin})`;try{return fn(...b)}finally{cause=parent;}}:fn,delay,...a); };
    const eventOn=app.metadataCache.on;
    app.metadataCache.on=function(name,fn,ctx){return eventOn.call(this,name,function(...a){const parent=cause;cause=`metadata.${name}`;record(cause,0,a[0]?.path);try{return fn.apply(this,a)}finally{cause=parent;}},ctx);};
    probe.pendingAtStart=app.metadataCache.inProgressTaskCount;
    app.workspace.onLayoutReady(()=>record('layout.ready'));
    try { await load.apply(this,args); } catch(error) { probe.error=String(error?.stack??error); throw error; } finally { app.metadataCache.on=eventOn; }
    record('plugin.loaded',performance.now()-start); probe.ready=true; cause='idle';
    probe.sample=()=>({elapsedMs:performance.now()-start,counts:structuredClone(probe.counts),events:probe.events.slice(),pending:app.metadataCache.inProgressTaskCount,current:this.getCurrentChapter()?.path??null});
    probe.reset=()=>{probe.counts={};probe.events=[];};
  };
})();
