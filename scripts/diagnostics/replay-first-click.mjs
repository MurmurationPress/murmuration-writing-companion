// Real Chromium input in an isolated Obsidian instance, NOT a synthetic DOM test.
// Requires the explicit marker and fixture described in docs/first-click-follow-up.md.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { strict as assert } from 'node:assert';
const args = new Map(process.argv.slice(2).map(arg => { const i = arg.indexOf('='); return i < 0 ? [arg, true] : [arg.slice(0,i),arg.slice(i+1)]; }));
const vaultPath = args.get('--vault');
if (typeof vaultPath !== 'string' || !path.isAbsolute(vaultPath)) throw new Error('Supply --vault=/absolute/disposable/path');
assert.equal(await readFile(path.join(vaultPath, '.mwc-performance-fixture'), 'utf8'), 'MWC disposable performance fixture\n');
const endpoint = new URL(args.get('--endpoint') ?? 'http://127.0.0.1:19347');
assert.ok(['127.0.0.1','localhost'].includes(endpoint.hostname), 'Only a local isolated debugger is supported');
const targets = await (await fetch(new URL('/json/list',endpoint))).json();
const target = targets.find(t => t.type === 'page' && t.url === 'app://obsidian.md/index.html');
assert.ok(target, 'Obsidian page missing');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject) => { socket.onopen=resolve; socket.onerror=reject; });
const pending = new Map(); let nextId=0;
socket.onmessage = ({data}) => { const m=JSON.parse(data); if(!m.id)return; const p=pending.get(m.id); pending.delete(m.id); m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result); };
const send = (method,params={}) => new Promise((resolve,reject) => { pending.set(++nextId,{resolve,reject}); socket.send(JSON.stringify({id:nextId,method,params})); });
const evaluate = async expression => { const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true}); if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
const quote = JSON.stringify;
const normalize = p => process.platform === 'win32' ? p.replaceAll('\\','/').toLowerCase() : p;
const instrumented = !args.has('--uninstrumented');
const here = path.dirname(fileURLToPath(import.meta.url));
const results=[], prose=[];
try {
  assert.equal(normalize(await evaluate('app.vault.adapter.getBasePath()')),normalize(vaultPath),'Refusing a different vault');
  const environment = await evaluate(`({title:document.title,electron:process.versions.electron,chrome:process.versions.chrome,platform:process.platform,notes:app.vault.getMarkdownFiles().length,plugins:Object.keys(app.plugins.plugins),theme:document.body.className})`);
  assert.deepEqual(environment.plugins,['murmuration-writing-companion'],'Use MWC alone');
  const pluginHash = createHash('sha256').update(await readFile(path.join(vaultPath,'.obsidian/plugins/murmuration-writing-companion/main.js'))).digest('hex');
  if(instrumented) {
    await evaluate(await readFile(path.join(here,'capture-interactions.js'),'utf8'));
    await evaluate(await readFile(path.join(here,'capture-numbering.js'),'utf8'));
  }
  await evaluate(`(async()=>{const p=app.plugins.plugins['murmuration-writing-companion'];await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath('B0S000.md'));await p.activateView();await p.activateManuscriptNavigator();})()`);
  await wait(500);
  const cases=args.has('--prose-only') ? [] : [
    {name:'manuscript',type:'murmuration-manuscript-navigator-view',selector:'.mwc-manuscript-create-book',state:`document.querySelectorAll('.modal-container').length`},
    {name:'companion',type:'murmuration-writing-companion-view',selector:'.mwc-collapsible-section--chapterNotes .mwc-section-toggle',state:`document.querySelector('.mwc-collapsible-section--chapterNotes .mwc-section-toggle')?.getAttribute('aria-expanded')`},
    {name:'native',type:'file-explorer',selector:'.nav-folder-title[data-path="Control"]',state:`document.querySelector('.nav-folder-title[data-path="Control"]')?.closest('.nav-folder').classList.contains('is-collapsed')`}
  ];
  for(const item of cases) for(const active of [true,false]) for(let repeat=0;repeat<5;repeat++) {
    await evaluate(`(async()=>{document.querySelector('.modal-close-button')?.click();const leaf=app.workspace.getLeavesOfType(${quote(item.type)})[0];await app.workspace.revealLeaf(leaf);})()`);
    await wait(120);
    await evaluate(`(()=>{const leaf=app.workspace.getLeavesOfType(${quote(active?item.type:'markdown')})[0];app.workspace.setActiveLeaf(leaf,{focus:true});})()`);
    await wait(300);
    await evaluate(`document.querySelector(${quote(item.selector)}).scrollIntoView({block:'center'})`);
    await wait(60);
    await evaluate(`(()=>{globalThis.__clickProbe={calls:0,watched:[],started:performance.now()};})()`);
    if(instrumented)await evaluate(`globalThis.__interaction=startMwcInteractionCapture();globalThis.__numbering=startMwcNumberingCapture()`);
    const clicks=[];
    const initial=await evaluate(item.state);
    for(let attempt=0;attempt<2;attempt++) {
      const rect=await evaluate(`(()=>{const b=document.querySelector(${quote(item.selector)});const f=b.onclick;if(${instrumented} && typeof f==='function'){const w=function(...args){__clickProbe.calls++;return f.apply(this,args)};b.onclick=w;__clickProbe.watched.push({b,f,w});}__clickProbe.button=b;__clickProbe.downAt=performance.now();const r=b.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;if(!b.contains(document.elementFromPoint(x,y)))throw new Error('Control is obscured');return {x,y}})()`);
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',...rect});
      await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...rect});
      await wait(35);
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...rect});
      await wait(300);
      const outcome=await evaluate(`({state:${item.state},handlerCalls:${instrumented?'__clickProbe.calls':'null'},downConnected:__clickProbe.button.isConnected})`);
      clicks.push(outcome);
      if(outcome.state!==initial)break;
    }
    const captures=instrumented?await evaluate(`({numbering:__numbering.stop(),interaction:__interaction.stop()})`):{};
    await evaluate(`__clickProbe.watched.forEach(({b,f,w})=>{if(b.onclick===w)b.onclick=f})`);
    results.push({control:item.name,active,repeat,initial,clicks,...captures});
    if(instrumented){assert.equal(captures.interaction.dropped,0);assert.equal(captures.numbering.dropped,0);}
    if(args.has('--expect-fixed')){
      assert.notEqual(clicks[0].state,initial,`${item.name}: first click failed, active=${active}`);
      if(item.name!=='native' && instrumented)assert.equal(clicks[0].handlerCalls,1,'Exactly one original handler invocation');
    }
  }
  if(args.has('--prose-only')) {
    assert.ok(instrumented, 'Prose measurements require the capture tools');
    for(let repeat=0;repeat<5;repeat++) {
      await evaluate(`(()=>{const l=app.workspace.getLeavesOfType('markdown')[0];app.workspace.setActiveLeaf(l,{focus:true});l.view.editor.focus();const e=l.view.editor;const line=e.lastLine();e.setCursor({line,ch:e.getLine(line).length});})()`);
      await wait(400);
      await evaluate(`globalThis.__interaction=startMwcInteractionCapture();globalThis.__numbering=startMwcNumberingCapture()`);
      await send('Input.insertText',{text:' synthetic edit'});
      // Obsidian's normal editor save debounce is about two seconds in this fixture.
      await wait(4000);
      const sample=await evaluate(`({numbering:__numbering.stop(),interaction:__interaction.stop(),pending:app.plugins.plugins['murmuration-writing-companion'].manuscriptIntegrityCoordinator.timer!==null})`);
      assert.equal(sample.pending,false,'Capture ended before settlement');
      assert.equal(sample.numbering.counts['host-changed'],1,'Expected one actual prose save');
      assert.equal(sample.numbering.counts['regeneration-pass:start'],1);
      assert.equal(sample.numbering.counts['reporting-write-attempt:start']??0,0);
      assert.equal(sample.interaction.dropped,0);assert.equal(sample.numbering.dropped,0);
      prose.push(sample);
    }
  }
  console.log(JSON.stringify({environment,pluginHash,instrumented,note:'Real Obsidian/Electron on a synthetic disposable vault; CDP mouse input is trusted. 35 ms requested hold; observed event intervals include main-thread blocking. Handler wrappers are restored between trials. This is not Ted\'s vault, Windows, or physical OS focus switching.',results,prose},null,2));
} finally {
  await evaluate(`(()=>{globalThis.__numbering?.stop();globalThis.__interaction?.stop();globalThis.__clickProbe?.watched?.forEach(({b,f,w})=>{if(b.onclick===w)b.onclick=f});document.querySelector('.modal-close-button')?.click();})()`).catch(()=>{});
  socket.close();
}
