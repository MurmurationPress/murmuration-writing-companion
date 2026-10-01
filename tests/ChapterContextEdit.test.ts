import { deepEqual, equal, rejects } from 'node:assert/strict';
import { test } from 'node:test';
import { ChapterContextEdit } from '../src/companion/ChapterContextEdit';

test('context commits serialize old/new edits and preserve a newer unsaved draft', async () => {
  const edit = new ChapterContextEdit(); const writes: string[] = [];
  let release!: () => void;
  const first = edit.commit('first', async value => { await new Promise<void>(r => release = r); writes.push(value); });
  await Promise.resolve(); await Promise.resolve();
  const second = edit.commit('second', async value => { writes.push(value); });
  edit.change('still typing');
  release(); await Promise.all([first, second]);
  deepEqual(writes, ['first', 'second']); equal(edit.draft, 'still typing');
});

test('duplicate commit does not write twice, including a new input event with the same value', async () => {
  const edit = new ChapterContextEdit(); let writes = 0;
  const write = async () => { writes++; };
  const first = edit.commit('summary', write);
  edit.change('summary');
  await Promise.all([first, edit.commit('summary', write)]);
  equal(writes, 1); equal(edit.draft, null);
});

test('failed commit retains the draft, rejects visibly and permits explicit retry', async () => {
  const edit = new ChapterContextEdit();
  await rejects(edit.commit('keep me', async () => { throw new Error('read only'); }), /read only/);
  equal(edit.draft, 'keep me');
  await edit.commit('keep me', async () => {});
  equal(edit.draft, null);
});

test('a failed old commit does not block a newer queued commit or clear its draft', async () => {
  const edit = new ChapterContextEdit(); let saved = '';
  const first = edit.commit('old', async () => { throw new Error('failed'); });
  const second = edit.commit('new', async value => { saved = value; });
  await rejects(first); await second;
  equal(saved, 'new'); equal(edit.draft, null);
});

test('rapid A/B/A commits write the last A rather than treating stale cached A as current', async () => {
  const edit = new ChapterContextEdit(); const written: string[] = [];
  const write = async (value: string) => { written.push(value); };
  await Promise.all(['A', 'B', 'A'].map(value => edit.commit(value, write)));
  deepEqual(written, ['A', 'B', 'A']); equal(edit.draft, null);
});
