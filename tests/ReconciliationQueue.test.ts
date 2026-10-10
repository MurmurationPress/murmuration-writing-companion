import { equal } from 'node:assert/strict';
import { test } from 'node:test';
import { ReconciliationQueue } from '../src/projections/ReconciliationQueue';

function fixture() {
  let now = 0, id = 0, passes = 0;
  const timers = new Map<number, {at:number; callback:()=>void}>();
  const queue = new ReconciliationQueue(() => passes++, {
    schedule(callback, delay) { timers.set(++id,{at:now+delay,callback}); return id; },
    cancel(handle) { timers.delete(handle); }
  });
  return {queue,timers,passes:()=>passes,advance(ms:number) {
    const until=now+ms;
    for (;;) {const next=[...timers].filter(([,v])=>v.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].callback();}now=until;
  }};
}
test('resolution bursts perform one pass and later external batches still reconcile',()=>{
  const f=fixture();for(let i=0;i<1000;i++)f.queue.request();equal(f.timers.size,2);f.advance(99);equal(f.passes(),0);f.advance(1);equal(f.passes(),1);equal(f.timers.size,0);
  f.queue.request();f.advance(100);equal(f.passes(),2);
});
test('continuous imports cannot starve reconciliation; disposal cancels trailing and deadline work',()=>{
  const f=fixture();for(let i=0;i<40;i++){f.queue.request();f.advance(50);}equal(f.passes(),2);
  f.queue.request();f.queue.dispose();f.queue.request();f.advance(2000);equal(f.passes(),2);equal(f.timers.size,0);
});
test('cancelled callbacks cannot run after unload even if the host already queued them',()=>{
  const f=fixture();f.queue.request();const late=[...f.timers.values()].map(t=>t.callback);f.queue.dispose();late.forEach(fn=>fn());equal(f.passes(),0);
});

test('metadata-driven Navigator batches use the latest state, including later removals and context changes', () => {
  let callback: (() => void) | undefined;
  const entries = new Set<string>();
  let context = 'first';
  const renders: { entries: number; context: string }[] = [];
  const queue = new ReconciliationQueue(() => renders.push({ entries: entries.size, context }), {
    schedule(fn) { callback = fn; return 1; }, cancel() {}
  });
  for (let i = 0; i < 2000; i++) { entries.add(String(i)); queue.request(); }
  context = 'last'; entries.delete('0');
  equal(renders.length, 0);
  callback!();
  equal(renders.length, 1); equal(renders[0].entries, 1999); equal(renders[0].context, 'last');
  queue.request(); queue.dispose(); callback!(); equal(renders.length, 1);
});
