// Native Linux DOM/application activation smoke. Uses only a freshly allocated vault.
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = await mkdtemp('/tmp/mwc276-');
const vault = path.join(root, 'vault'), profile = path.join(root, 'profile');
const id = 'murmuration-writing-companion';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
await mkdir(path.join(vault, '.obsidian/plugins', id), { recursive: true });
await mkdir(profile);
for (const name of ['main.js', 'manifest.json', 'styles.css']) await copyFile(name, path.join(vault, '.obsidian/plugins', id, name));
const notes = {
  'Mira.md': '---\nworld_entity: character\nworld_name: Mira\ncustom: preserved\n---\n\nMira is a navigator.\n',
  'Base.md': '---\nworld_entity: pov-profile\nworld_name: Mira Base\n---\n\nNotices distances before faces.\n',
  'One.md': '---\ntype: book\ntitle: One\n---\n',
  'Two.md': '---\ntype: book\ntitle: Two\n---\n',
  'Scene.md': '---\ntype: scene\nparent: "[[Two]]"\npov: "[[Mira]]"\nmanuscript_order_key: "a0"\n---\n\nSynthetic manuscript stays intact.\n'
};
for (const [name, text] of Object.entries(notes)) await writeFile(path.join(vault, name), text);
await writeFile(path.join(vault, '.obsidian/community-plugins.json'), JSON.stringify([id]));
const leaf = (id, type, state = {}) => ({ id, type: 'leaf', state: { type, state } });
await writeFile(path.join(vault, '.obsidian/workspace.json'), JSON.stringify({ main: { id: 'root', type: 'split', children: [{ id: 'tabs', type: 'tabs', children: [leaf('editor', 'markdown', { file: 'Mira.md', mode: 'preview' })] }], direction: 'vertical' }, right: { id: 'right', type: 'split', children: [{ id: 'righttabs', type: 'tabs', children: [leaf('companion', 'murmuration-writing-companion-view')] }], direction: 'horizontal', width: 440, collapsed: false }, active: 'editor' }));
await writeFile(path.join(profile, 'obsidian.json'), JSON.stringify({ vaults: { 2000000000000276: { path: vault, ts: 1, open: true } } }));
let ws, seq = 0; const pending = new Map();
const child = spawn('/opt/Obsidian/obsidian', [`--user-data-dir=${profile}`, '--no-sandbox', '--disable-gpu', '--ozone-platform=x11', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--remote-debugging-port=19376'], { stdio: 'ignore' });
async function send(method, params) { const id = ++seq; const reply = new Promise(resolve => pending.set(id, resolve)); ws.send(JSON.stringify({ id, method, params })); const r = await reply; if (r.error) throw Error(JSON.stringify(r.error)); return r.result; }
async function run(code) { const r = await send('Runtime.evaluate', { expression: `(async()=>{if(globalThis.app&&app.vault.adapter.basePath!==${JSON.stringify(vault)})throw Error('wrong vault');${code}})()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; }
const evidence = { vault, method: 'Linux native Obsidian, DOM/application activation through CDP; no physical input or accessibility claim', checks: [] };
evidence.assets = {};
for (const name of ['main.js', 'manifest.json', 'styles.css']) evidence.assets[name] = createHash('sha256').update(await readFile(name)).digest('hex');
const check = (value, name) => { assert.ok(value, name); evidence.checks.push(name); };
try {
  let page;
  for (let n = 0; n < 150 && !page; n++) { await pause(200); try { page = (await (await fetch('http://127.0.0.1:19376/json/list')).json()).find(p => p.type === 'page' && p.url.startsWith('app://obsidian.md')); } catch {} }
  assert.ok(page, 'native page'); ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise(resolve => ws.onopen = resolve);
  ws.onmessage = event => { const m = JSON.parse(event.data); pending.get(m.id)?.(m); pending.delete(m.id); };
  let ready;
  for (let n = 0; n < 200; n++) { ready = await run(`if(!globalThis.app)return false;[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Trust author'))?.click();return !!app.plugins?.plugins?.['${id}']?.manuscriptPreparationCommands;`); if (ready) break; await pause(200); }
  assert.ok(ready, 'plugin loaded'); await pause(2500);
  await run(`if(activeWindow!==window)activeWindow.close();window.focus();`);
  await run(`window.p=app.plugins.plugins['${id}'];window.wait=ms=>new Promise(r=>setTimeout(r,ms));window.clickText=(root,text)=>{const b=[...root.querySelectorAll('button')].find(b=>b.textContent===text);if(!b)throw Error('No button: '+text);b.click();};window.openNote=async path=>{await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path),{active:true});await wait(800);p.refreshView();await wait(400);};`);
  evidence.environment = await run('return {userAgent:navigator.userAgent,electron:process.versions.electron,platform:process.platform};');
  check(await run(`const host=document.querySelector('.mwc-character-pov');return host&&host.scrollWidth<=host.clientWidth+2;`), 'Inspector controls fit the native sidebar');
  check(await run(`return document.querySelector('.mwc-character-pov')?.textContent.includes('No profile yet');`), 'character without profile is optional');
  check(await run(`const host=document.querySelector('.mwc-character-pov');host.querySelector('select').value='Base.md';clickText(host,'Associate selected profile');await wait(1200);return (await app.vault.read(app.vault.getAbstractFileByPath('Mira.md'))).includes('[[Base]]');`), 'retrospective association persists');
  check(await run(`clickText(document.querySelector('.mwc-character-pov'),'Remove association');await wait(1200);return !(await app.vault.read(app.vault.getAbstractFileByPath('Mira.md'))).includes('pov_profile');`), 'remove preserves profile note');
  check(await run(`clickText(document.querySelector('.mwc-character-pov'),'Create a profile for this character');await wait(500);return document.querySelector('.modal')?.textContent.includes('Mira POV');`), 'profile creation retains character context');
  await run(`clickText(document.querySelector('.modal'),'Create');await wait(1800);`);
  await run(`await openNote('Scene.md');`);
  evidence.afterCreate = await run('return [...document.querySelectorAll(".modal")].map(m=>m.innerText);');
  check(await run(`const modal=[...document.querySelectorAll('.modal')].find(m=>m.textContent.includes('Confirm association'));clickText(modal,'Confirm association and return to character');await wait(1500);return (await app.vault.read(app.vault.getAbstractFileByPath('Mira.md'))).includes('Mira POV');`), 'explicit confirmation returns to original character');
  check(await run(`const host=document.querySelector('.mwc-character-pov');host.querySelector('details').open=true;const books=host.querySelector('[aria-label="POV guidance Book"]');books.value='Two.md';books.dispatchEvent(new Event('change'));clickText(host,'Create extension for this Book');await wait(500);return document.querySelector('.modal')?.textContent.includes('Book-scoped extension');`), 'Book extension creation is accessible from character');
  await run(`clickText(document.querySelector('.modal'),'Create');await wait(1800);clickText(document.querySelector('.modal'),'Return without changing association');await wait(1200);`);
  check(await run(`const host=document.querySelector('.mwc-character-pov');host.querySelector('details').open=true;const books=host.querySelector('[aria-label="POV guidance Book"]');books.value='Two.md';books.dispatchEvent(new Event('change'));await wait(500);return host.textContent.includes('Book-specific guidance')&&host.textContent.includes('Associated guidance (applies directly)');`), 'base and Book-specific guidance remain distinct');
  check(await run(`const base=app.vault.getAbstractFileByPath('Story World/POV Profiles/Mira POV.md');const before=await app.vault.read(base);const host=document.querySelector('.mwc-character-pov');const row=[...host.querySelectorAll('details')].find(row=>row.querySelector('summary')?.textContent.includes('Book-specific guidance'));row.open=true;clickText(row,'Edit this profile’s guidance');await wait(800);const leaf=app.workspace.getMostRecentLeaf();const path=leaf.view.file.path;await leaf.setViewState({type:'markdown',state:{file:path,mode:'source',source:true}});await wait(300);const editor=leaf.view.editor;editor.replaceRange(' Trust the crew.',{line:editor.lastLine(),ch:editor.getLine(editor.lastLine()).length});for(let n=0;n<40&&!(await app.vault.read(leaf.view.file)).includes('Trust the crew.');n++)await wait(200);return path.endsWith('Mira POV — Two.md')&&(await app.vault.read(base))===before&&(await app.vault.read(leaf.view.file)).includes('Trust the crew.');`), 'editing extension guidance through its editor preserves the base profile');
  check(await run(`await openNote('Scene.md');return document.body.textContent.includes('Mira POV');`), 'Chapter Context resolves character guidance');
  check(await run(`return await app.vault.read(app.vault.getAbstractFileByPath('Scene.md'))===${JSON.stringify(notes['Scene.md'])};`), 'manuscript is byte-identical');
  check(await run(`const text=await app.vault.read(app.vault.getAbstractFileByPath('Mira.md'));return text.endsWith(${JSON.stringify('\nMira is a navigator.\n')})&&text.includes('custom: preserved');`), 'character prose and unrelated property preserved');
  check(await run(`await openNote('Mira.md');const host=document.querySelector('.mwc-character-pov');host.querySelector('select').value='Base.md';clickText(host,'Associate selected profile');await wait(1000);return (await app.vault.read(app.vault.getAbstractFileByPath('Mira.md'))).includes('[[Base]]');`), 'changing association leaves both profiles intact');
  check(await run(`const count=app.vault.getMarkdownFiles().length;clickText(document.querySelector('.mwc-character-pov'),'Create a profile for this character');await wait(300);clickText(document.querySelector('.modal'),'Cancel');await wait(300);return app.vault.getMarkdownFiles().length===count;`), 'cancel creates no profile');
  check(await run(`const before=await app.vault.read(app.vault.getAbstractFileByPath('Mira.md'));const original=app.fileManager.processFrontMatter;app.fileManager.processFrontMatter=async()=>{throw Error('Synthetic save failure; retry');};try{const host=document.querySelector('.mwc-character-pov');host.querySelector('select').value='Story World/POV Profiles/Mira POV.md';clickText(host,'Associate selected profile');await wait(400);return host.textContent.includes('Synthetic save failure')&&before===await app.vault.read(app.vault.getAbstractFileByPath('Mira.md'));}finally{app.fileManager.processFrontMatter=original;}`), 'failed persistence retains the authoritative association and clear retry feedback');
  check(await run(`const base=app.vault.getAbstractFileByPath('Base.md');const renamed=app.fileManager.renameFile(base,'Renamed.md');await wait(700);const prompt=[...document.querySelectorAll('button')].find(b=>b.textContent==='Just once');if(prompt)prompt.click();await renamed;await wait(1200);p.refreshView();await wait(300);const host=document.querySelector('.mwc-character-pov');return host.textContent.includes('Mira Base');`), 'renamed profile remains selectable through the index');
  check(await run(`await app.vault.delete(app.vault.getAbstractFileByPath('Renamed.md'));await wait(1200);p.refreshView();await wait(300);return document.querySelector('.mwc-character-pov').textContent.includes('Unavailable profile');`), 'deleted profile is visible and repairable');
} catch (error) { evidence.error = String(error); evidence.dom = await run(`return document.body.innerText;`); throw error; }
finally { await writeFile(process.argv[2] ?? '/tmp/mwc276-native.json', JSON.stringify(evidence, null, 2)); ws?.close(); child.kill('SIGTERM'); }
