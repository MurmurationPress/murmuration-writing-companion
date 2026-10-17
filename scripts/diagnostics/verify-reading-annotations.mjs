import { reviewReadingAnnotations } from "./reading-annotation-review-cases.mjs";
// Native Obsidian acceptance replay. Uses only a new /tmp synthetic vault/profile.
// Run: node scripts/diagnostics/verify-reading-annotations.mjs [evidence.json]
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const root = process.cwd(), fixture = await mkdtemp('/tmp/mwc-reading-acceptance-');
const vault = path.join(fixture, 'vault'), profile = path.join(fixture, 'profile');
const pluginId = 'murmuration-writing-companion', port = 19360;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const pluginDirectory = path.join(vault, '.obsidian/plugins', pluginId);
await mkdir(pluginDirectory, { recursive: true }); await mkdir(profile);
for (const file of ['main.js', 'manifest.json', 'styles.css']) await copyFile(path.join(root, file), path.join(pluginDirectory, file));
await writeFile(path.join(vault, '.obsidian/community-plugins.json'), JSON.stringify([pluginId]));
await writeFile(path.join(vault, '.obsidian/hotkeys.json'), JSON.stringify({ [`${pluginId}:annotate`]: [{ modifiers: ['Mod', 'Shift'], key: 'A' }] }));
await writeFile(path.join(vault, 'Book.md'), '---\ntype: book\ntitle: Synthetic Book\n---\n');
const before = '---\ntype: scene\ntitle: Synthetic Scene\nparent: "[[Book]]"\nmanuscript_order_key: "0000000001"\nfixture_property: retain me\n---\n\nRepeated passage.\n\nA **bold** word and an *italic* word with a [link](https://example.org).\n\nRepeated passage.\n\nFirst paragraph of a longer selection.\n\nSecond paragraph with **formatting** here.\n\n' + Array.from({ length: 60 }, (_, i) => `Synthetic scrolling paragraph ${i}.\n\n`).join('');
const otherBefore = '---\ntype: scene\ntitle: Other\nparent: "[[Book]]"\nmanuscript_order_key: "0000000002"\n---\n\nOther manuscript.\n';
await writeFile(path.join(vault, 'Scene.md'), before); await writeFile(path.join(vault, 'Other.md'), otherBefore);
const leaf = (id, type, state = {}) => ({ id, type: 'leaf', state: { type, state } });
const tabs = (id, children) => ({ id, type: 'tabs', children });
await writeFile(path.join(vault, '.obsidian/workspace.json'), JSON.stringify({
  main: { id: 'root', type: 'split', children: [tabs('editor-tabs', [leaf('editor', 'markdown', { file: 'Scene.md', mode: 'preview' })])], direction: 'vertical' },
  left: { id: 'left', type: 'split', children: [tabs('left-tabs', [leaf('navigator', 'murmuration-manuscript-navigator-view')])], direction: 'horizontal', width: 280, collapsed: false },
  right: { id: 'right', type: 'split', children: [tabs('right-tabs', [leaf('companion', 'murmuration-writing-companion-view')])], direction: 'horizontal', width: 330, collapsed: false }, active: 'editor', lastOpenFiles: ['Scene.md']
}));
await writeFile(path.join(profile, 'obsidian.json'), JSON.stringify({ vaults: { 2702590000000002: { path: vault, ts: 1, open: true } } }));
let child, ws, sequence = 0; const pending = new Map();
async function send(method, params) {
  const id = ++sequence, result = new Promise(resolve => pending.set(id, resolve));
  ws.send(JSON.stringify({ id, method, params }));
  const response = await result; if (response.error) throw Error(JSON.stringify(response.error)); return response.result;
}
async function evaluate(code) {
  const result = await send('Runtime.evaluate', { expression: `(async()=>{if(globalThis.app && app.vault.adapter.basePath!==${JSON.stringify(vault)})throw Error('Wrong vault');${code}})()`, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value;
}
async function launch() {
  child = spawn('/opt/Obsidian/obsidian', [`--user-data-dir=${profile}`, '--no-sandbox', '--disable-gpu', '--ozone-platform=x11', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', `--remote-debugging-port=${port}`], { stdio: 'ignore' });
  let page;
  for (let i = 0; i < 150 && !page; i++) { await pause(200); try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p => p.type === 'page' && p.url.startsWith('app://obsidian.md')); } catch {} }
  assert.ok(page, 'Native Obsidian page unavailable');
  ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise(resolve => ws.onopen = resolve);
  ws.onmessage = event => { const message = JSON.parse(event.data); if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); } };
  for (let i = 0; i < 200; i++) {
    const ready = await evaluate(`if(!globalThis.app)return false;const trust=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Trust author'));if(trust&&!globalThis.__mwcTrustClicked){globalThis.__mwcTrustClicked=true;trust.click();}return app.workspace?.layoutReady&&!!app.plugins.plugins['${pluginId}']?.manuscriptPreparationCommands;`);
    if (ready) break; await pause(200);
    if (i === 199) throw Error('Plugin did not become ready');
  }
  await pause(1600);
  await evaluate(`if(activeWindow!==window)activeWindow.close();window.focus();globalThis.p=app.plugins.plugins['${pluginId}'];globalThis.md=app.workspace.getLeavesOfType('markdown')[0].view;globalThis.scene=app.vault.getAbstractFileByPath('Scene.md');globalThis.other=app.vault.getAbstractFileByPath('Other.md');globalThis.settle=()=>new Promise(r=>setTimeout(r,700));`);
  await pause(900);
}
async function stop() {
  ws?.close(); ws = null;
  if (child && child.exitCode === null) { child.kill('SIGTERM'); await Promise.race([new Promise(resolve => child.once('exit', resolve)), pause(5000)]); }
}
async function click(selector, text) {
  const position = await evaluate(`const els=[...document.querySelectorAll(${JSON.stringify(selector)})];const el=els.find(e=>${text ? `e.textContent===${JSON.stringify(text)}` : 'true'});if(!el)throw Error('Missing control');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, ...position });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1, ...position });
  await pause(850);
}
async function select(first, last = first) {
  return evaluate(`const ps=[...md.contentEl.querySelectorAll('.el-p p')];const a=ps[${first}],b=ps[${last}];if(!a||!b)throw Error('Missing rendered passage');const nodes=el=>{const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),n=[];while(w.nextNode())n.push(w.currentNode);return n};const an=nodes(a),bn=nodes(b);const range=document.createRange();range.setStart(an[0],0);range.setEnd(bn.at(-1),bn.at(-1).length);document.getSelection().removeAllRanges();document.getSelection().addRange(range);document.dispatchEvent(new Event('selectionchange'));const c=p.readingSelection?.selection;return c?{from:c.from,to:c.to,text:c.source.slice(c.from,c.to)}:null;`);
}
async function draftState() { return evaluate(`return {focus:document.activeElement?.className,mode:md.getMode(),modals:document.querySelectorAll('.modal').length,count:p.storeService.getPage(scene).annotations.length,scroll:md.previewMode.getScroll()};`); }
const evidence = { fixture, bundleSha256: createHash('sha256').update(await readFile(path.join(root, 'main.js'))).digest('hex'), results: {} };
try {
  await launch(); evidence.environment = await evaluate(`return {title:document.title,userAgent:navigator.userAgent};`);
  // Context menu: native host DOM range, browser context event, one native menu-item click.
  const repeated = await select(2); assert.equal(repeated.from, before.lastIndexOf('Repeated passage.'));
  await evaluate(`const el=md.contentEl.querySelectorAll('.el-p p')[2];const r=el.getBoundingClientRect();el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.x+30,clientY:r.y+10}));`);
  await click('.menu-item-title', 'Annotate');
  let state = await draftState(); assert.equal(state.focus, 'mwc-annotation-body'); assert.equal(state.mode, 'preview'); assert.equal(state.modals, 1); assert.equal(state.count, 0);
  await send('Input.insertText', { text: 'Native context-menu annotation.' });
  await click('.modal button', 'Save annotation');
  state = await draftState(); assert.equal(state.count, 1); assert.equal(state.mode, 'preview'); assert.equal(state.modals, 0);
  const saved = await evaluate(`return p.storeService.getPage(scene).annotations[0];`); assert.equal(saved.body, 'Native context-menu annotation.'); assert.equal(saved.anchor.text, 'Repeated passage.');
  evidence.results.contextMenu = { selected: repeated, savedAnchor: saved.anchor, singleActivation: true, bodyFocus: true };
  // Shortcut and cancel, formatted selection.
  await evaluate(`app.workspace.setActiveLeaf(md.leaf,{focus:true});`); const formatted = await select(1);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 10, key: 'A', code: 'KeyA', windowsVirtualKeyCode: 65 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 10, key: 'A', code: 'KeyA', windowsVirtualKeyCode: 65 }); await pause(700);
  state = await draftState(); assert.equal(state.modals, 1); assert.equal(state.focus, 'mwc-annotation-body');
  await send('Input.insertText', { text: 'Cancelled draft.' }); await click('.modal button', 'Cancel');
  assert.equal((await draftState()).count, 1); evidence.results.shortcutCancel = { selected: formatted, storedCount: 1 };
  // Capture before opening command palette, then move the active scene before saving.
  await evaluate(`app.workspace.setActiveLeaf(md.leaf,{focus:true});`); const spanning = await select(3, 4);
  await evaluate(`app.commands.executeCommandById('command-palette:open');`); await pause(300);
  await send('Input.insertText', { text: 'Murmuration Writing Companion: Annotate' }); await pause(300);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }); await pause(700);
  state = await draftState(); assert.equal(state.modals, 1); assert.equal(state.focus, 'mwc-annotation-body');
  await evaluate(`await md.leaf.openFile(other,{state:{mode:'preview'}});p.currentChapter=other;await settle();document.querySelector('.modal textarea').focus();`);
  await send('Input.insertText', { text: 'Original-note association.' }); await click('.modal button', 'Save annotation');
  const association = await evaluate(`return {original:p.storeService.getPage(scene).annotations.map(a=>({body:a.body,text:a.anchor.text})),other:p.storeService.getPage(other).annotations.length,mode:md.getMode()};`);
  assert.equal(association.original.length, 2); assert.equal(association.other, 0); assert.equal(association.mode, 'preview'); assert.equal(association.original[1].text, spanning.text); evidence.results.paletteAndAssociation = association;
  // Navigation from a different note and a scrolled-away passage, through the public workflow.
  await evaluate(`await p.navigateToAnnotation(scene,p.storeService.getPage(scene).annotations[0]);await settle();md.previewMode.applyScroll(100);await settle();await p.navigateToAnnotation(scene,p.storeService.getPage(scene).annotations[0]);await settle();`);
  const navigation = await evaluate(`return {mode:md.getMode(),file:md.file.path,selection:document.getSelection()?.toString(),scroll:md.previewMode.getScroll()};`);
  assert.equal(navigation.mode, 'preview'); assert.equal(navigation.file, 'Scene.md'); assert.equal(navigation.selection, 'Repeated passage.'); assert.ok(navigation.scroll < 30); evidence.results.navigation = navigation;
  const competingLeaf = await evaluate(`const editable=app.workspace.getLeaf('split');await editable.openFile(scene,{state:{mode:'source'}});await md.leaf.openFile(other,{state:{mode:'preview'}});app.workspace.setActiveLeaf(md.leaf,{focus:true});await p.navigateToAnnotation(scene,p.storeService.getPage(scene).annotations[0]);await settle();const result={readingMode:md.getMode(),readingFile:md.file.path,otherMode:editable.view.getMode()};editable.detach();return result;`);
  assert.deepEqual(competingLeaf, { readingMode: 'preview', readingFile: 'Scene.md', otherMode: 'source' });
  evidence.results.competingEditableLeaf = competingLeaf;
  // Review/edit, resolve and reopen with a single native click each.
  await evaluate(`p.currentChapter=scene;await p.activateView();p.refreshView();await settle();`);
  await click('.mwc-annotation-card textarea'); await send('Input.insertText', { text: 'Edited review body.' });
  await click('.mwc-annotation-resolve');
  await click('.mwc-resolved-toggle');
  await click('.mwc-annotation-reopen');
  const lifecycle = await evaluate(`return {mode:md.getMode(),statuses:p.storeService.getPage(scene).annotations.map(a=>a.status),bodies:p.storeService.getPage(scene).annotations.map(a=>a.body)};`);
  assert.equal(lifecycle.mode, 'preview'); assert.deepEqual(lifecycle.statuses, ['open','open']); assert.ok(lifecycle.bodies.some(b=>b.includes('Edited review body.'))); evidence.results.lifecycle = lifecycle;
  // Stale composition must retain the draft, save nothing, and explain the problem.
  await evaluate(`app.workspace.setActiveLeaf(md.leaf,{focus:true});`); await select(0);
  await evaluate(`app.commands.executeCommandById('${pluginId}:annotate');await settle();await app.vault.modify(scene,(await app.vault.read(scene))+'\\nSynthetic external edit.\\n');await settle();`);
  await click('.modal button', 'Save annotation');
  const stale = await evaluate(`return {count:p.storeService.getPage(scene).annotations.length,modal:!!document.querySelector('.modal'),notices:[...document.querySelectorAll('.notice')].map(n=>n.textContent),mode:md.getMode()};`);
  assert.equal(stale.count, 2); assert.equal(stale.modal, true); assert.ok(stale.notices.some(n=>n.includes('selected note has changed'))); assert.equal(stale.mode, 'preview');
  await click('.modal button', 'Cancel'); await evaluate(`await app.vault.modify(scene,(await app.vault.read(scene)).replace('\\nSynthetic external edit.\\n',''));await settle();`); evidence.results.stale = stale;
  // Edit mode still uses the existing Companion creation path.
  await evaluate(`await md.leaf.setViewState({type:'markdown',state:{file:scene.path,mode:'source',source:true}});app.workspace.setActiveLeaf(md.leaf,{focus:true});await settle();const editor=md.editor;const from=editor.getValue().indexOf('Repeated passage.');editor.setSelection(editor.offsetToPos(from),editor.offsetToPos(from+17));app.commands.executeCommandById('${pluginId}:annotate');await settle();`);
  const editing = await draftState(); assert.equal(editing.mode, 'source'); assert.equal(editing.count, 3); assert.equal(editing.focus, 'mwc-annotation-body'); evidence.results.editMode = editing;
  await evaluate(`await md.leaf.setViewState({type:'markdown',state:{file:scene.path,mode:'preview'}});await settle();`);
  // Draft cancellation preserves a deeper Reading-view position.
  await evaluate(`app.workspace.setActiveLeaf(md.leaf,{focus:true});md.previewMode.applyScroll(70);await settle();`);
  const deepIndex = await evaluate(`return [...md.contentEl.querySelectorAll('.el-p p')].findIndex(e=>e.textContent==='Synthetic scrolling paragraph 25.');`);
  assert.ok(deepIndex >= 0); await select(deepIndex);
  const deepScroll = await evaluate(`return md.previewMode.getScroll();`);
  await evaluate(`app.commands.executeCommandById('${pluginId}:annotate');await settle();`);
  await click('.modal button', 'Cancel');
  const retainedScroll = await evaluate(`return md.previewMode.getScroll();`);
  assert.ok(Math.abs(deepScroll - retainedScroll) < 1);
  evidence.results.scrollRetention = { before: deepScroll, afterCancel: retainedScroll };
  await select(deepIndex);
  await evaluate(`app.commands.executeCommandById('${pluginId}:annotate');await settle();`);
  assert.equal((await draftState()).focus, 'mwc-annotation-body');
  await send('Input.insertText', { text: 'Deep Reading-view annotation.' });
  await click('.modal button', 'Save annotation');
  const savedScroll = await evaluate(`return md.previewMode.getScroll();`);
  assert.ok(Math.abs(deepScroll - savedScroll) < 2);
  evidence.results.scrollRetention.afterSave = savedScroll;
  // Preference survives a full process restart; disabled and re-enabled indicators refresh.
  const defaults = await evaluate(`return {enabled:p.filenameTitlePreference.get(),indicators:document.querySelectorAll('.mwc-manuscript-name-mismatch').length};`); assert.equal(defaults.enabled, true); assert.ok(defaults.indicators > 0);
  const setting = await evaluate(`app.setting.open();await settle();app.setting.openTabById('${pluginId}');await settle();const doc=activeWindow.document;const row=[...doc.querySelectorAll('.setting-item')].find(e=>e.querySelector('.setting-item-name')?.textContent==='Notify when filename differs from title');if(!row)throw Error('Missing filename/title setting');const description=row.querySelector('.setting-item-description')?.textContent;row.querySelector('.checkbox-container').click();app.setting.close();window.focus();await settle();return {description,enabled:p.filenameTitlePreference.get()};`);
  assert.equal(setting.enabled, false); evidence.results.settingControl = setting;
  assert.equal(await evaluate(`return document.querySelectorAll('.mwc-manuscript-name-mismatch').length;`), 0);
  await evaluate(`setTimeout(()=>require('electron').remote.app.quit(),50);return true;`);
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), pause(5000)]);
  await stop(); await launch();
  const restarted = await evaluate(`return {enabled:p.filenameTitlePreference.get(),indicators:document.querySelectorAll('.mwc-manuscript-name-mismatch').length,count:p.storeService.getPage(scene).annotations.length,mode:md.getMode()};`);
  assert.equal(restarted.enabled, false); assert.equal(restarted.indicators, 0); assert.equal(restarted.count, 4); assert.equal(restarted.mode, 'preview');
  await evaluate(`p.filenameTitlePreference.set(true);p.refreshManuscriptNavigator();await settle();`);
  assert.ok(await evaluate(`return document.querySelectorAll('.mwc-manuscript-name-mismatch').length>0;`)); evidence.results.preferenceRestart = { defaults, restarted, restored: true };
  const after = await readFile(path.join(vault, 'Scene.md'), 'utf8');
  assert.equal(after.replace(/^mwc_open_annotations:.*\n/m, ''), before);
  assert.equal(await readFile(path.join(vault, 'Other.md'), 'utf8'), otherBefore);
  evidence.results.manuscriptIntegrity = { exactExceptDerivedCount: true, unrelatedNoteUnchanged: true, beforeSha256: createHash('sha256').update(before).digest('hex'), afterSha256: createHash('sha256').update(after).digest('hex') };
  evidence.results.review = await reviewReadingAnnotations({ evaluate, send, click, pause, pluginId });
  console.log(JSON.stringify(evidence, null, 2));
  if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(evidence, null, 2) + '\n');
} finally { await stop(); }
