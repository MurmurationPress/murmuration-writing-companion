// Reuse an already-indexed disposable startup fixture. Restores its one edited
// source note before exiting. Never use an author vault or a normal profile.
import {spawn} from 'node:child_process';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]),fixture=path.resolve(process.argv[3]),output=process.argv[4];
assert.ok(fixture.startsWith('/tmp/mwc-startup-'));
const vault=path.join(fixture,'vault'),profile=path.join(fixture,'profile');
assert.equal(await readFile(path.join(vault,'.mwc-performance-fixture'),'utf8'),'MWC disposable performance fixture\n');
const plugin=path.join(vault,'.obsidian/plugins/murmuration-writing-companion');
const main=await readFile(path.join(root,'main.js'));const original=await readFile(path.join(vault,'B0S000.md'));
await writeFile(path.join(plugin,'main.js'),Buffer.concat([main,Buffer.from('\n'),await readFile('scripts/diagnostics/startup-probe.js')]));
for(const file of ['styles.css','manifest.json'])await copyFile(path.join(root,file),path.join(plugin,file));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const child=spawn('/opt/Obsidian/obsidian',[`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--remote-debugging-port=19347'],{stdio:'ignore'});
let ws;
try {
 let page;for(let i=0;i<300&&!page;i++){await pause(200);try{page=(await(await fetch('http://127.0.0.1:19347/json/list')).json()).find(p=>p.url==='app://obsidian.md/index.html');}catch{}}
 assert.ok(page);ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 let id=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
 async function send(method,params){const n=++id,p=new Promise(r=>pending.set(n,r));ws.send(JSON.stringify({id:n,method,params}));const m=await p;if(m.error)throw Error(JSON.stringify(m.error));return m.result;}
 async function ev(code){const r=await send('Runtime.evaluate',{expression:`(async()=>{if(!globalThis.app)return null;if(app.vault.adapter.basePath!==${JSON.stringify(vault)})throw Error('Wrong vault');${code}})()`,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
 let ready=false;for(let i=0;i<900&&!ready;i++){await pause(200);ready=await ev(`if(globalThis.__startupProbe?.error)throw Error(__startupProbe.error);return !!globalThis.__startupProbe?.ready&&app.workspace.layoutReady&&app.metadataCache.inProgressTaskCount===0;`);}assert.ok(ready);
 await ev(`globalThis.p252=app.plugins.plugins['murmuration-writing-companion'];globalThis.settle252=async()=>{let previous=-1;for(let i=0;i<200;i++){await new Promise(r=>setTimeout(r,450));await p252.manuscriptIntegrityCoordinator.whenSettled();const count=Object.entries(__startupProbe.counts).filter(([name])=>name!=='cache.read').reduce((n,[,x])=>n+x.calls,0);const busy=['navigatorRefreshTimer','continuityReviewRefreshTimer','manuscriptChronologyRefreshTimer','storyWorldMetadataRefreshTimer'].some(k=>p252[k]!=null)||p252.interactionRefresh.pending.size>0;if(count===previous&&!busy)return;previous=count;}throw Error('Did not settle');};const md=app.workspace.getLeavesOfType('markdown')[0]??app.workspace.getLeaf('tab');await md.openFile(app.vault.getAbstractFileByPath('B0S001.md'));await md.openFile(app.vault.getAbstractFileByPath('B0S000.md'));app.workspace.setActiveLeaf(md,{focus:true});await p252.activateView();await p252.activateManuscriptNavigator();p252.sidebarSectionPreferences.setExpanded('chapterNotes',true);p252.refreshView();await settle252();return true;`);
 const environment=await ev(`return {files:app.vault.getMarkdownFiles().length,userAgent:navigator.userAgent,plugins:Object.keys(app.plugins.plugins),context:p252.getCurrentChapter()?.path,entities:p252.storyWorldIndex.index.size,books:p252.manuscriptProjection.get().books.length};`);assert.deepEqual(environment.plugins,['murmuration-writing-companion']);assert.equal(environment.context,'B0S000.md');assert.equal(environment.entities,environment.files/5);assert.equal(environment.books,3);
 const results=[];
 for(const [stage,action] of [['prose',`const f=app.vault.getAbstractFileByPath('B0S000.md');await app.vault.modify(f,(await app.vault.read(f))+'\\nSynthetic warm prose.');`],['metadata',`await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath('B0S000.md'),fm=>fm.change_summary='Warm synthetic '+Date.now());`]]) {
  const samples=[];for(let i=0;i<6;i++){const sample=await ev(`__startupProbe.reset();const started=performance.now();${action}await settle252();return {...__startupProbe.sample(),settledWallMs:performance.now()-started};`);assert.equal(sample.counts['frontmatter.write']?.calls??0,stage==='prose'?0:1);if(i)samples.push(sample);}results.push({stage,samples});
 }
 const interactions=[];
 for(const scenario of ['clean','blur-save'])for(let i=0;i<5;i++){
  const value=`Warm blur ${i} ${Date.now()}`;
  await ev(`p252.sidebarSectionPreferences.setExpanded('chapterContext',true);p252.refreshView();await settle252();__startupProbe.reset();return true;`);
  if(scenario==='blur-save'){
   await ev(`const input=document.querySelector('[aria-label="Change summary"]');input.scrollIntoView({block:'center'});input.focus();input.select();return true;`);
   await send('Input.insertText',{text:value});
  }
  const target=await ev(`const b=document.querySelector('.mwc-collapsible-section--chapterNotes .mwc-section-toggle');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;if(!b.contains(document.elementFromPoint(x,y)))throw Error('Obscured control');globalThis.click252=null;globalThis.down252=null;globalThis.clickHandler252={button:b,original:b.onclick,calls:0};b.onclick=function(...args){clickHandler252.calls++;return clickHandler252.original.apply(this,args);};document.addEventListener('pointerdown',()=>{down252=performance.now();},{once:true,capture:true});document.addEventListener('click',()=>{const at=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>{click252={downToFramesMs:performance.now()-down252,clickToFramesMs:performance.now()-at,connected:b.isConnected,calls:clickHandler252.calls,after:document.querySelector('.mwc-collapsible-section--chapterNotes .mwc-section-toggle')?.getAttribute('aria-expanded')};}));},{once:true,capture:true});return {x,y,before:b.getAttribute('aria-expanded')};`);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,x:target.x,y:target.y});await pause(35);await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,x:target.x,y:target.y});await pause(150);const sample=await ev('return click252;');assert.ok(sample);assert.equal(sample.calls,1);assert.notEqual(sample.after,target.before);const persistence=await ev(`clickHandler252.button.onclick=clickHandler252.original;await settle252();return {writes:__startupProbe.counts['frontmatter.write']?.calls??0,summary:app.metadataCache.getFileCache(app.vault.getAbstractFileByPath('B0S000.md')).frontmatter.change_summary};`);if(scenario==='blur-save'){assert.equal(persistence.writes,1);assert.equal(persistence.summary,value);}interactions.push({scenario,...sample,writes:persistence.writes});
 }
 await writeFile(output,JSON.stringify({bundleSha256:createHash('sha256').update(main).digest('hex'),environment,note:'Previously indexed synthetic fixture; Companion and Navigator only. One warmup and five measured prose/metadata samples, two quiet 450ms windows. Synchronous method times are nested and must not be added together. Interaction samples assert one successful native toggle; click-to-two-animation-frames is a renderer responsiveness proxy, not physical input-to-photon latency. Pointerdown metric includes requested 35ms hold and CDP round trips.',results,interactions},null,2));
 await ev(`setTimeout(()=>window.close(),100);return true;`);await pause(800);
} finally {ws?.close();child.kill('SIGTERM');await pause(800);await writeFile(path.join(vault,'B0S000.md'),original);}
