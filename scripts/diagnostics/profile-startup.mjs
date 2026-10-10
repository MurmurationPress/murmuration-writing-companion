// Fresh Obsidian process/profile per trial; host disk caches are NOT flushed.
// Requires Linux /opt/Obsidian/obsidian and uses only new /tmp synthetic vaults.
import {spawn,execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,copyFile,mkdtemp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]??'.'),output=process.argv[3];
const sizes=(process.env.MWC_PROFILE_SIZES??'100,1000,10000').split(',').map(Number),repeats=Number(process.env.MWC_PROFILE_REPEATS??3);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const results=[];const main=await readFile(path.join(root,'main.js'));const probe=await readFile('scripts/diagnostics/startup-probe.js');
const persist=async()=>{if(output)await writeFile(output,JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),bundleSha256:createHash('sha256').update(main).digest('hex'),coldLimitMs:Number(process.env.MWC_COLD_LIMIT_MS??60000),note:'Fresh process and empty host profile/database for each trial. OS file cache not flushed. Instrumented plugin onload to settlement; process-launch boundary includes host boot and trust interaction. Polling cadence 200 ms. Two animation frames from pointerdown are a responsiveness proxy, not physical input-to-photon latency. Five prose samples after one warmup; Companion/Navigator open. Timed-out cold trials do not run edit/interaction trials.',results},null,2));};
for(const size of sizes)for(let trial=0;trial<repeats;trial++){
 const parent=await mkdtemp('/tmp/mwc-startup-'),vault=path.join(parent,'vault'),profile=path.join(parent,'profile');
 execFileSync(process.execPath,['scripts/diagnostics/create-performance-fixture.mjs',vault,String(size)]);
 const config=path.join(vault,'.obsidian'),plugin=path.join(config,'plugins/murmuration-writing-companion');await mkdir(plugin,{recursive:true});await mkdir(profile);
 await writeFile(path.join(plugin,'main.js'),Buffer.concat([main,Buffer.from('\n'),probe]));for(const file of ['manifest.json','styles.css'])await copyFile(path.join(root,file),path.join(plugin,file));
 await writeFile(path.join(config,'community-plugins.json'),JSON.stringify(['murmuration-writing-companion']));
 const leaf=(id,type,state={})=>({id,type:'leaf',state:{type,state}}),tabs=(id,children)=>({id,type:'tabs',children});
 await writeFile(path.join(config,'workspace.json'),JSON.stringify({main:{id:'root',type:'split',children:[tabs('editor-tabs',[leaf('editor','markdown',{file:'B0S000.md',mode:'source',source:false})])],direction:'vertical'},left:{id:'left',type:'split',children:[tabs('left-tabs',[leaf('navigator','murmuration-manuscript-navigator-view')])],direction:'horizontal',width:300,collapsed:false},right:{id:'right',type:'split',children:[tabs('right-tabs',[leaf('companion','murmuration-writing-companion-view')])],direction:'horizontal',width:330,collapsed:false},active:'editor',lastOpenFiles:['B0S000.md']}));
 await writeFile(path.join(profile,'obsidian.json'),JSON.stringify({vaults:{2520000000000001:{path:vault,ts:1,open:true}}}));
 const launched=performance.now();const child=spawn('/opt/Obsidian/obsidian',[`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--remote-debugging-port=19347'],{stdio:'ignore'});let ws;
 try {
  let page;for(let i=0;i<900&&!page;i++){await wait(200);try{const pages=await(await fetch('http://127.0.0.1:19347/json/list')).json();page=pages.find(p=>p.type==='page'&&p.url==='app://obsidian.md/index.html');}catch{}}
  assert.ok(page,'Obsidian page unavailable');ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let seq=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
  async function send(method,params){const id=++seq;const p=new Promise(r=>pending.set(id,r));ws.send(JSON.stringify({id,method,params}));const m=await p;if(m.error)throw Error(JSON.stringify(m.error));return m.result;}
  async function ev(code){const r=await send('Runtime.evaluate',{expression:`(async()=>{${code}})()`,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
  let ready=false;for(let i=0;i<1800&&!ready&&performance.now()-launched<Number(process.env.MWC_COLD_LIMIT_MS??60000);i++){await wait(200);ready=await ev(`if(!globalThis.app)return false;if(app.vault.adapter.basePath!==${JSON.stringify(vault)})throw Error('Different vault');if(!globalThis.__trustClicked252){const trust=[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Trust author'));if(trust){globalThis.__trustClicked252=true;trust.click();}}if(globalThis.__startupProbe?.error)throw Error(__startupProbe.error);if(globalThis.__startupProbe&&app.plugins.plugins['murmuration-writing-companion']?.getCurrentChapter()?.path==='B0S000.md'&&document.querySelector('.mwc-container [aria-label=\"Title\"]')&&document.querySelector('.mwc-manuscript-entry'))__startupProbe.firstUsableAt??=performance.now()-__startupProbe.start;return !!globalThis.__startupProbe?.ready && app.workspace.layoutReady && app.metadataCache.inProgressTaskCount===0 && !app.plugins.plugins['murmuration-writing-companion'].manuscriptIntegrityCoordinator.pendingPaths.size;`);}
  if(ready)await wait(1100);
  const cold=await ev(`const p=app.plugins.plugins['murmuration-writing-companion'];return {...__startupProbe.sample(),instance:__startupProbe.instance,firstUsableAtMs:__startupProbe.firstUsableAt??null,pendingAtStart:__startupProbe.pendingAtStart,context:p.getCurrentChapter()?.path??null,active:app.workspace.getActiveFile()?.path??null,companionText:document.querySelector('.mwc-container')?.textContent.slice(0,160),navigatorPresent:!!document.querySelector('.mwc-manuscript-entry'),userAgent:navigator.userAgent};`);
  cold.launchToObservationMs=performance.now()-launched;
  cold.settled=ready;
  assert.equal(cold.instance,1,'Duplicate startup invalidates measurement');
  if(!ready){results.push({fixtureRoot:parent,size,trial,cold,edits:[],interactionPointerDownToTwoFramesMs:[]});console.error(size,trial,'cold limit',cold.pending);await persist();await ev(`setTimeout(()=>window.close(),100);return true;`);continue;}
  // Preserve observed cold context first; establish equal source context for editing trials.
  await ev(`const p=app.plugins.plugins['murmuration-writing-companion'];const md=app.workspace.getLeavesOfType('markdown')[0];await md.openFile(app.vault.getAbstractFileByPath('B0S001.md'));await md.openFile(app.vault.getAbstractFileByPath('B0S000.md'));app.workspace.setActiveLeaf(md,{focus:true});await p.activateView();await p.activateManuscriptNavigator();return true;`);await wait(1100);
  const edits=[];
  for(let i=0;i<6;i++){
   await ev(`__startupProbe.reset();const f=app.vault.getAbstractFileByPath('B0S000.md');await app.vault.modify(f,(await app.vault.read(f))+'\\nOrdinary synthetic prose.');return true;`);await wait(1500);
   const sample=await ev(`return __startupProbe.sample();`);assert.equal(sample.counts['frontmatter.write']?.calls??0,0);if(i)edits.push(sample);
  }
  const interaction=[];
  for(let i=0;i<5;i++){
   const rect=await ev(`const b=document.querySelector('.mwc-collapsible-section--chapterNotes .mwc-section-toggle');if(!b)throw Error('No Chapter Notes control');b.scrollIntoView({block:'center'});return {x:b.getBoundingClientRect().x+20,y:b.getBoundingClientRect().y+10};`);await wait(100);
   await ev(`globalThis.click252=null;document.addEventListener('pointerdown',()=>{const start=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>{click252=performance.now()-start;}));},{once:true,capture:true});return true;`);
   await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...rect});await wait(35);await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...rect});await wait(100);interaction.push(await ev(`return click252;`));
  }
  results.push({fixtureRoot:parent,size,trial,cold,edits,interactionPointerDownToTwoFramesMs:interaction});console.error(size,trial,cold.context,cold.launchToObservationMs);
  await persist();
  await ev(`setTimeout(()=>window.close(),100);return true;`);
 } finally {ws?.close();child.kill('SIGTERM');await wait(600);}
}
