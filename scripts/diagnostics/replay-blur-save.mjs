// Real Chromium input in an isolated Obsidian instance, NOT a synthetic DOM test.
// Requires the explicit marker and fixture described in docs/first-click-follow-up.md.
// Mutates synthetic scene metadata. Do not use a manuscript vault.
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
const results=[], keyboard=[], external=[], failures=[], keyboardTitle=[], compactEnter=[];
const plugin=`app.plugins.plugins['murmuration-writing-companion']`;
const toggle='.mwc-collapsible-section--chapterNotes .mwc-section-toggle';
const source='B0S000.md', destination='B0S001.md';
const point=async selector => evaluate(`(()=>{const b=document.querySelector(${quote(selector)});if(!b)throw new Error('Missing '+${quote(selector)});b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;if(!b.contains(document.elementFromPoint(x,y)))throw new Error('Obscured target');return {x,y}})()`);
const click=async(selector,hold=35)=>{
  const rect=await point(selector);
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',...rect});
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...rect});
  await wait(hold);
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...rect});
};
const key=async(key,code,num,modifiers=0)=>{
  await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:num,modifiers,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:key===' '?{text:' ',unmodifiedText:' '}:{})});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:num,modifiers});
};
const prepare=async()=>{
  await evaluate(`(async()=>{document.querySelector('.modal-close-button')?.click();const p=${plugin};await app.workspace.getLeavesOfType('markdown')[0].openFile(app.vault.getAbstractFileByPath(${quote(destination)}),{active:true});await app.workspace.getLeavesOfType('markdown')[0].openFile(app.vault.getAbstractFileByPath(${quote(source)}),{active:true});p.sidebarSectionPreferences.setExpanded('chapterContext',true);p.refreshView();})()`);
  await wait(500);
  await evaluate(`(async()=>{await app.workspace.revealLeaf(app.workspace.getLeavesOfType('murmuration-writing-companion-view')[0]);})()`);
  await wait(150);
};
const edit=async(label,value)=>{
  await evaluate(`(()=>{const b=document.querySelector('[aria-label='+${quote(JSON.stringify(label))}+']');b.scrollIntoView({block:'center'});b.focus();b.select();})()`);
  await send('Input.insertText',{text:value});
};
try {
  assert.equal(normalize(await evaluate('app.vault.adapter.getBasePath()')),normalize(vaultPath),'Refusing a different vault');
  const environment=await evaluate(`({title:document.title,electron:process.versions.electron,chrome:process.versions.chrome,platform:process.platform,notes:app.vault.getMarkdownFiles().length,plugins:Object.keys(app.plugins.plugins)})`);
  assert.deepEqual(environment.plugins,['murmuration-writing-companion']);
  await evaluate('globalThis.__blurProbe=null;globalThis.__blurCapture=null;globalThis.__keyProbe=null;globalThis.__titleKey=null;globalThis.__enterSave=null;globalThis.__failureProbe=null');
  const pluginHash=createHash('sha256').update(await readFile(path.join(vaultPath,'.obsidian/plugins/murmuration-writing-companion/main.js'))).digest('hex');
  await evaluate(`(async()=>{await ${plugin}.activateView();await ${plugin}.activateManuscriptNavigator();})()`);
  await wait(1000); // Settle layout-ready work after a plugin reload.
  if(instrumented)await evaluate(await readFile(path.join(here,'capture-interactions.js'),'utf8'));
  // Source and destination are captured before editing. The delayed-host case
  // deliberately lets navigation finish before the original file's write does.
  const cases=instrumented?[
    ['summary-toggle','Change summary','change_summary',toggle],
    ['summary-scene','Change summary','change_summary','.mwc-manuscript-entry[aria-label="Open Scene 0 001"]'],
    ['summary-modal','Change summary','change_summary','.mwc-manuscript-create-book'],
    ['title-toggle','Title','title',toggle],
    ['pov-toggle','POV character','pov',toggle],
    ['location-toggle','Scene location','location',toggle],
    ['slow-summary-scene','Change summary','change_summary','.mwc-manuscript-entry[aria-label="Open Scene 0 001"]']
  ]:[['summary-toggle','Change summary','change_summary',toggle]];
  for(const [name,label,property,selector] of cases.filter(c=>!args.has('--case')||c[0]===args.get('--case')))for(let repeat=0;repeat<5;repeat++){
    await prepare();
    if(property==='pov')await click('[aria-label="Edit POV character"]');
    if(property==='location')await click('[aria-label="Edit Scene location"]');
    const value=`fixture-${name}-${repeat}-${Date.now()}`;
    await edit(label,value);
    await evaluate(`(()=>{const p=${plugin};globalThis.__blurProbe={calls:0,writes:[],fn:p.updateChapterContextProperty,button:document.querySelector(${quote(selector)}),host:app.fileManager.processFrontMatter};const q=__blurProbe;q.before=q.button.getAttribute('aria-expanded');q.original=q.button.onclick;if(${instrumented}){q.button.onclick=function(...args){q.calls++;q.actionAt=performance.now();return q.original.apply(this,args)};p.updateChapterContextProperty=async function(file,field,value){const record={path:file.path,field:field.key,value};q.writes.push(record);await q.fn.call(this,file,field,value);record.done=true;record.completedAt=performance.now()};}if(${quote(name)}.startsWith('slow-'))app.fileManager.processFrontMatter=async function(...args){await new Promise(r=>setTimeout(r,300));return q.host.apply(this,args)};})()`);
    if(instrumented)await evaluate('globalThis.__blurCapture=startMwcInteractionCapture()');
    const otherBefore=await evaluate(`app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(${quote(destination)}))?.frontmatter?.[${quote(property)}]??null`);
    await click(selector,repeat===4?180:35);await wait(800);
    const outcome=await evaluate(`(async()=>{const q=__blurProbe;return {before:q.before,after:document.querySelector(${quote(selector)})?.getAttribute('aria-expanded'),calls:${instrumented?'q.calls':'null'},writes:q.writes,actionAt:q.actionAt,current:${plugin}.getCurrentChapter()?.path,modals:document.querySelectorAll('.modal-container').length,cache:app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(${quote(source)}))?.frontmatter?.[${quote(property)}],disk:(await app.vault.read(app.vault.getAbstractFileByPath(${quote(source)}))).includes(${quote(value)}),other:app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(${quote(destination)}))?.frontmatter?.[${quote(property)}]??null,...(${instrumented}?{capture:__blurCapture.stop()}:{})}})()`);
    await evaluate(`(()=>{const q=__blurProbe;q.button.onclick=q.original;${plugin}.updateChapterContextProperty=q.fn;app.fileManager.processFrontMatter=q.host;document.querySelector('.modal-close-button')?.click();})()`);
    const worked=name.endsWith('scene')?outcome.current===destination:name.endsWith('modal')?outcome.modals===1:typeof outcome.after==='string' && outcome.after!==outcome.before;
    results.push({name,repeat,holdMs:repeat===4?180:35,worked,...outcome});
    assert.equal(outcome.disk,true,`${name}: missing disk edit`);
    assert.equal(outcome.cache,property==='pov'?`[[${value}]]`:value,`${name}: metadata differs`);
    assert.equal(outcome.other,otherBefore,`${name}: wrote wrong scene`);
    if(instrumented){if(name.startsWith('slow-'))assert.ok(outcome.writes[0].completedAt>outcome.actionAt,'Expected action before delayed persistence');assert.equal(outcome.writes.length,1,`${name}: duplicate write`);assert.equal(outcome.writes[0].path,source);assert.equal(outcome.writes[0].done,true);assert.equal(outcome.capture.dropped,0);}
    if(args.has('--expect-fixed')){assert.equal(worked,true,`${name}: first action lost`);if(instrumented)assert.equal(outcome.calls,1,`${name}: handler count`);}
  }
  if(instrumented && args.has('--expect-fixed')){
    for(const activation of [[' ','Space',32],['Enter','Enter',13]])for(let repeat=0;repeat<5;repeat++){
      await prepare();const value=`keyboard-${activation[1]}-${repeat}-${Date.now()}`;await edit('Change summary',value);
      await key('Tab','Tab',9);const focus=await evaluate(`({key:document.activeElement.getAttribute('data-mwc-focus-key'),before:document.activeElement.getAttribute('aria-expanded')})`);
      await wait(500);
      assert.ok(focus.key,'Tab must reach an explicitly identified control');
      assert.equal(await evaluate(`document.activeElement.getAttribute('data-mwc-focus-key')`),focus.key,'Save lost keyboard focus');
      await evaluate(`(()=>{globalThis.__keyProbe={button:document.activeElement,calls:0};const q=__keyProbe;q.fn=q.button.onclick;q.button.onclick=function(...args){q.calls++;return q.fn.apply(this,args)}})()`);
      await key(...activation);await wait(300);
      const outcome=await evaluate(`(async()=>({calls:__keyProbe.calls,after:document.activeElement.getAttribute('aria-expanded'),disk:(await app.vault.read(app.vault.getAbstractFileByPath(${quote(source)}))).includes(${quote(value)})}))()`);
      await evaluate('__keyProbe.button.onclick=__keyProbe.fn');
      assert.equal(outcome.calls,1);assert.notEqual(outcome.after,focus.before);assert.equal(outcome.disk,true);
      keyboard.push({activation:activation[1],repeat,...focus,...outcome});
    }
    for(let repeat=0;repeat<5;repeat++){
      await prepare();const value=`keyboard-title-${repeat}-${Date.now()}`;await edit('Title',value);
      await key('Tab','Tab',9);await wait(500);
      assert.equal(await evaluate(`document.activeElement.getAttribute('data-mwc-focus-key')`),'context:pov-display');
      await evaluate(`(()=>{globalThis.__titleKey={button:document.activeElement,calls:0};const q=__titleKey;q.fn=q.button.onkeydown;q.button.onkeydown=function(...args){q.calls++;return q.fn.apply(this,args)}})()`);
      await key('Enter','Enter',13);await wait(150);
      const outcome=await evaluate(`(async()=>({calls:__titleKey.calls,editors:document.querySelectorAll('.mwc-pov-input').length,disk:(await app.vault.read(app.vault.getAbstractFileByPath(${quote(source)}))).includes(${quote(value)})}))()`);
      assert.equal(outcome.calls,1);assert.equal(outcome.editors,1);assert.equal(outcome.disk,true);
      await key('Escape','Escape',27);keyboardTitle.push({repeat,...outcome});
    }
    for(const [label,property,editLabel] of [['POV character','pov','Edit POV character'],['Scene location','location','Edit Scene location']])for(let repeat=0;repeat<5;repeat++){
      await prepare();await click(`[aria-label="${editLabel}"]`);const value=`enter-${property}-${repeat}-${Date.now()}`;await edit(label,value);
      await evaluate(`(()=>{globalThis.__enterSave={fn:${plugin}.updateChapterContextProperty,calls:0};const q=__enterSave;${plugin}.updateChapterContextProperty=async function(...args){q.calls++;return q.fn.apply(this,args)}})()`);
      await key('Enter','Enter',13);await wait(600);
      const outcome=await evaluate(`({calls:__enterSave.calls,editors:document.querySelectorAll('input[aria-label='+${quote(JSON.stringify(label))}+']').length,focus:document.activeElement.getAttribute('data-mwc-focus-key'),stored:app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(${quote(source)})).frontmatter[${quote(property)}]})`);
      await evaluate(`${plugin}.updateChapterContextProperty=__enterSave.fn`);
      assert.equal(outcome.calls,1);assert.equal(outcome.editors,0);assert.equal(outcome.focus,`context:${property}-display`);assert.equal(outcome.stored,property==='pov'?`[[${value}]]`:value);compactEnter.push({property,repeat,...outcome});
    }
    // One injected host failure: the first action still executes once, the
    // unsaved draft survives a refresh, and leaving it again explicitly retries.
    await prepare();const failedValue=`retry-summary-${Date.now()}`;await edit('Change summary',failedValue);
    await evaluate(`(()=>{globalThis.__failureProbe={fn:app.fileManager.processFrontMatter,attempts:0,calls:0,button:document.querySelector(${quote(toggle)})};const q=__failureProbe;q.onclick=q.button.onclick;q.button.onclick=function(...args){q.calls++;return q.onclick.apply(this,args)};app.fileManager.processFrontMatter=async function(...args){if(args[0].path===${quote(source)} && ++q.attempts===1)throw new Error('Injected disposable write failure');return q.fn.apply(this,args)}})()`);
    await click(toggle);await wait(350);
    await evaluate(`${plugin}.refreshView()`);await wait(150);
    assert.equal(await evaluate(`document.querySelector('[aria-label="Change summary"]').value`),failedValue,'Failed draft was discarded');
    assert.equal(await evaluate('__failureProbe.calls'),1);
    assert.equal(await evaluate(`app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(${quote(source)})).frontmatter.change_summary===${quote(failedValue)}`),false);
    await evaluate(`document.querySelector('[aria-label="Change summary"]').focus()`);await click(toggle);await wait(500);
    const failure=await evaluate(`(async()=>({attempts:__failureProbe.attempts,firstActionCalls:__failureProbe.calls,disk:(await app.vault.read(app.vault.getAbstractFileByPath(${quote(source)}))).includes(${quote(failedValue)})}))()`);
    await evaluate('app.fileManager.processFrontMatter=__failureProbe.fn;__failureProbe.button.onclick=__failureProbe.onclick');
    assert.equal(failure.attempts,2);assert.equal(failure.disk,true);failures.push(failure);
    // External writes must still converge with a clean field focused. A dirty
    // local draft survives an unrelated update and commits on the original file.
    for(const dirty of [false,true]){
      await prepare();const value=`external-title-${Date.now()}`, summary=`local-draft-${Date.now()}`;
      if(dirty)await edit('Change summary',summary);else await evaluate(`document.querySelector('[aria-label="Change summary"]').focus()`);
      await evaluate(`app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(${quote(source)}),fm=>{fm.title=${quote(value)};${dirty?'':`fm.change_summary=${quote(value)}`}})`);
      await wait(500);
      if(dirty)assert.equal(await evaluate(`document.querySelector('[aria-label="Change summary"]').value`),summary,'External update lost local draft');
      else assert.equal(await evaluate(`document.querySelector('[aria-label="Change summary"]').value`),value,'External summary not rendered');
      await click(toggle);await wait(500);
      const outcome=await evaluate(`({title:document.querySelector('[aria-label="Title"]').value,summary:document.querySelector('[aria-label="Change summary"]').value})`);
      assert.equal(outcome.title,value);assert.equal(outcome.summary,dirty?summary:value);external.push({dirty,...outcome});
    }
  }
  console.log(JSON.stringify({environment,pluginHash,instrumented,results,keyboard,keyboardTitle,compactEnter,external,failures,note:'Actual isolated Obsidian; trusted CDP input. Slow cases inject 300 ms host latency. Five repetitions per case, last pointer hold 180 ms. No physical OS focus or Windows live verification.'},null,2));
}finally{
  await evaluate(`(()=>{globalThis.__blurCapture?.stop();if(globalThis.__keyProbe)__keyProbe.button.onclick=__keyProbe.fn;if(globalThis.__titleKey)__titleKey.button.onkeydown=__titleKey.fn;if(globalThis.__enterSave)${plugin}.updateChapterContextProperty=__enterSave.fn;if(globalThis.__failureProbe)app.fileManager.processFrontMatter=__failureProbe.fn;const q=globalThis.__blurProbe;if(q){q.button.onclick=q.original;${plugin}.updateChapterContextProperty=q.fn;app.fileManager.processFrontMatter=q.host;}document.querySelector('.modal-close-button')?.click()})()`).catch(()=>{});
  socket.close();
}
