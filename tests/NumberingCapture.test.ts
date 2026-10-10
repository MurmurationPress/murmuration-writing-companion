import { equal, deepEqual } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

function fixture() {
  const refs = new Set<object>();
  const events = { on: () => { const ref = {}; refs.add(ref); return ref; }, offref: (ref: object) => refs.delete(ref) };
  let writes = 0;
  const result = Promise.resolve();
  class Service {
    sync() { writes++; return result; }
    renumberNow() { return this.sync(); }
    renumber() { return this.renumberNow(); }
  }
  const service = new Service();
  const plugin = { manuscriptNumbering: { service }, manuscriptIntegrityCoordinator: { projection: { rebuild() {} } } };
  const start = runInNewContext(readFileSync('scripts/diagnostics/capture-numbering.js', 'utf8') + '\nstartMwcNumberingCapture;', {
    app: { plugins: { plugins: { 'murmuration-writing-companion': plugin } },
      workspace: { iterateAllLeaves() {} }, metadataCache: events, vault: events }, performance
  });
  return { start, service, result, refs, writes: () => writes };
}

test('numbering capture forwards original promises and restores inherited methods and event refs', async () => {
  const f = fixture(); const before = Object.keys(f.service); const capture = f.start();
  equal(f.service.renumber(), f.result); await f.result;
  equal(f.writes(), 1); equal(f.refs.size, 3);
  const report = capture.stop(); equal(f.refs.size, 0);
  deepEqual(Object.keys(f.service), before);
  equal(report.counts['renumber-pass:start'], 1);
  equal(report.counts['renumber-pass:end'], 1);
  capture.stop(); equal(f.service.sync(), f.result); equal(f.writes(), 2);
});
