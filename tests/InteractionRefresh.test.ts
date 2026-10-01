import { deepEqual, equal } from 'node:assert/strict';
import { test } from 'node:test';
import { InteractionRefresh } from '../src/ui/InteractionRefresh';

function fixture(reportError?: (error: unknown) => void) {
  const frames = new Map<number, FrameRequestCallback>(); let next = 0;
  const win = Object.assign(new EventTarget(), {
    requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++next, callback); return next; },
    cancelAnimationFrame: (id: number) => frames.delete(id)
  });
  const body = { matches: () => false, getAttribute: () => null, closest: () => null };
  const doc = Object.assign(new EventTarget(), { defaultView: win, body, activeElement: body as any });
  const refresh = new InteractionRefresh(reportError); refresh.observe(doc as any);
  const emit = (type: string, properties: object = {}, target: EventTarget = doc) => target.dispatchEvent(Object.assign(new Event(type), properties));
  const frame = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(0)); };
  return { refresh, doc, win, emit, frame, frames };
}

test('blur metadata cannot remove a pointer target; latest render runs once after the native click', () => {
  const f = fixture(); const sequence: string[] = [];
  f.emit('pointerdown', { pointerId: 1 });
  f.refresh.request('view', () => sequence.push('stale render'));
  f.emit('focusout'); f.frame(); // A frame during a long hold must not release the barrier.
  f.refresh.request('view', () => sequence.push('latest render'));
  equal(sequence.length, 0);
  f.emit('pointerup', { pointerId: 1 });
  f.refresh.request('view', () => sequence.push('latest render'));
  sequence.push('native click'); f.emit('click');
  deepEqual(sequence, ['native click']);
  f.frame(); deepEqual(sequence, ['native click', 'latest render']);
  f.frame(); equal(sequence.length, 2); // No action replay or duplicate render.
  f.refresh.dispose();
});

test('release without click, cancellation, and losing window focus all release queued renders', () => {
  for (const event of ['pointerup', 'pointercancel', 'blur']) {
    const f = fixture(); let renders = 0;
    f.emit('pointerdown', { pointerId: 9 }); f.refresh.request('view', () => renders++);
    f.emit(event, { pointerId: 9 }, event === 'blur' ? f.win : f.doc); f.frame();
    equal(renders, 1, event); f.refresh.dispose();
  }
});

test('Space and Enter retain their target through keyup and native activation', () => {
  for (const key of [' ', 'Enter']) {
    const f = fixture(); let renders = 0;
    f.emit('keydown', { key }); f.refresh.request('view', () => renders++); f.frame();
    equal(renders, 0); f.emit('keyup', { key }); equal(renders, 0);
    f.emit('click'); f.frame(); equal(renders, 1); f.refresh.dispose();
  }
});

test('dirty context edits and composition survive unrelated refreshes until committed on blur', () => {
  const f = fixture(); let renders = 0;
  f.doc.activeElement = { matches: (s: string) => s.includes('textarea'), value: 'draft', defaultValue: 'saved' };
  f.refresh.request('view', () => renders++); equal(renders, 0);
  f.emit('compositionstart'); f.doc.activeElement = f.doc.body;
  f.emit('focusout'); f.frame(); equal(renders, 0);
  f.emit('compositionend'); f.frame(); equal(renders, 1); f.refresh.dispose();
});

test('clean context inputs do not suppress external metadata updates', () => {
  const f = fixture(); let renders = 0;
  f.doc.activeElement = { matches: (s: string) => s.includes('textarea'), value: 'saved', defaultValue: 'saved', getAttribute: () => null, closest: () => null };
  f.refresh.request('view', () => renders++); equal(renders, 1); f.refresh.dispose();
});

test('focused control is restored only in its original pane and scene, without stealing action focus', () => {
  for (const mode of ['same', 'new scene', 'action focused elsewhere']) {
    const f = fixture(); let focused = 0; let context = 'scene A';
    const replacement = { getAttribute: () => 'toggle', focus: () => focused++ };
    const root = { isConnected: true, getAttribute: () => context, querySelectorAll: () => [replacement] };
    const original = { isConnected: true, matches: () => false, getAttribute: () => 'toggle', closest: () => root };
    f.doc.activeElement = original;
    f.refresh.request('view', () => {
      original.isConnected = false; f.doc.activeElement = f.doc.body;
      if (mode === 'new scene') context = 'scene B';
      if (mode === 'action focused elsewhere') f.doc.activeElement = {};
    });
    equal(focused, mode === 'same' ? 1 : 0); f.refresh.dispose();
  }
});

test('dispose removes listeners, frames and pending callbacks, including later requests', () => {
  const f = fixture(); let renders = 0;
  f.emit('pointerdown', { pointerId: 1 }); f.refresh.request('view', () => renders++);
  f.emit('pointerup', { pointerId: 1 }); f.refresh.dispose();
  equal(f.frames.size, 0); f.frame(); f.emit('focusout');
  f.refresh.request('view', () => renders++); equal(renders, 0); equal(f.frames.size, 0);
});


test('a failed deferred view reports its error without dropping other consumers', () => {
  const errors: unknown[] = []; const f = fixture(error => errors.push(error)); let rendered = 0;
  f.emit('pointerdown', { pointerId: 1 });
  f.refresh.request('bad view', () => { throw new Error('broken renderer'); });
  f.refresh.request('good view', () => rendered++);
  f.emit('pointerup', { pointerId: 1 }); f.frame();
  equal(errors.length, 1); equal(rendered, 1); f.refresh.dispose();
});

test('closing an observed window clears its held gestures and scheduled frame', () => {
  const f = fixture(); let renders = 0;
  f.emit('pointerdown', { pointerId: 1 }); f.refresh.request('view', () => renders++);
  f.emit('pointerup', { pointerId: 1 }); f.emit('pagehide', {}, f.win);
  equal(f.frames.size, 0);
  f.refresh.request('view', () => renders++); equal(renders, 1);
  f.refresh.dispose();
});

test('committed compact editor permits its resting control to render after Enter release', () => {
  const f = fixture(); let renders = 0; let committing = false;
  f.doc.activeElement = { matches: () => true, getAttribute: (name: string) => name === 'data-mwc-editing' && committing ? 'false' : null, closest: () => null };
  f.emit('keydown', { key: 'Enter' }); committing = true;
  f.refresh.request('compact editor', () => renders++); equal(renders, 0);
  f.emit('keyup', { key: 'Enter' }); f.frame(); equal(renders, 1); f.refresh.dispose();
});
