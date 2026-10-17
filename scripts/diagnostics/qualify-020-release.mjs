// Linux native release smoke: only newly allocated synthetic vaults/profiles.
// node scripts/diagnostics/qualify-020-release.mjs PUBLISHED_MWC_019 PUBLISHED_REPORTS_010 OUTPUT_JSON
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,copyFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const [old, reports, output] = process.argv.slice(2);
if (!output) throw Error('Expected published MWC directory, published Reports directory and output JSON');
const candidate=process.cwd(), id='murmuration-writing-companion', rid='murmuration-reports';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const digest=b=>createHash('sha256').update(b).digest('hex');
const evidence={method:'Linux native Obsidian via CDP DOM/application commands and Chromium input; no physical hardware/assistive technology claim',published019:{},publishedReports010:{},candidate:{},scenarios:[]};
for(const [key,dir] of [['published019',old],['publishedReports010',reports],['candidate',candidate]]) for(const name of ['main.js','manifest.json','styles.css']) evidence[key][name]=digest(await readFile(path.join(dir,name)));
let child,ws,seq=0;const pending=new Map();
async function send(method,params){const n=++seq,done=new Promise(r=>pending.set(n,r));ws.send(JSON.stringify({id:n,method,params}));const r=await done;if(r.error)throw Error(JSON.stringify(r.error));return r.result;}
let vault;
async function run(code){const r=await send('Runtime.evaluate',{expression:`(async()=>{if(globalThis.app&&app.vault.adapter.basePath!==${JSON.stringify(vault)})throw Error('wrong vault');${code}})()`,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function install(dir,plugin=id){const target=path.join(vault,'.obsidian/plugins',plugin);await mkdir(target,{recursive:true});for(const name of ['main.js','manifest.json','styles.css'])await copyFile(path.join(dir,name),path.join(target,name));}
async function launch(profile){child=spawn('/opt/Obsidian/obsidian',[`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--ozone-platform=x11','--disable-background-timer-throttling','--disable-renderer-backgrounding','--remote-debugging-port=19379'],{stdio:'ignore'});let page;for(let n=0;n<150&&!page;n++){await pause(200);try{page=(await(await fetch('http://127.0.0.1:19379/json/list')).json()).find(p=>p.type==='page'&&p.url.startsWith('app://obsidian.md'));}catch{}}assert.ok(page,'native page');ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);ws.onmessage=e=>{const m=JSON.parse(e.data);pending.get(m.id)?.(m);pending.delete(m.id);if(m.method==='Runtime.exceptionThrown'||m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')console.log('native error',JSON.stringify(m.params));};await send('Runtime.enable',{});let ready=false;for(let n=0;n<200;n++){ready=await run(`if(!globalThis.app)return false;const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Trust author'));if(b)b.click();return app.workspace?.layoutReady&&!!app.plugins.plugins['${id}']?.manuscriptPreparationCommands;`);if(ready)break;await pause(200);}assert.ok(ready,'plugin loaded');await pause(2200);await run(`if(activeWindow!==window)activeWindow.close();window.focus();`);const mainTitle=await run('return document.title;');
 execFileSync('python3',['-c',`import ctypes,os,re,subprocess,sys
pid=sys.argv[1]
windows=[]
for xid in re.findall(r'0x[0-9a-f]+',subprocess.check_output(['xprop','-root','_NET_CLIENT_LIST'],text=True)):
 if re.search(r'=\\s*'+pid+r'\\b',subprocess.check_output(['xprop','-id',xid,'_NET_WM_PID'],text=True)) and ' - Obsidian' in subprocess.check_output(['xprop','-id',xid,'_NET_WM_NAME'],text=True): windows.append(int(xid,16))
titles=[(w,subprocess.check_output(['xprop','-id',hex(w),'_NET_WM_NAME'],text=True)) for w in windows]
print(titles)
windows=[w for w,title in titles if sys.argv[2] in title]
assert len(windows)==1,titles
x=ctypes.CDLL('libX11.so.6');x.XOpenDisplay.argtypes=[ctypes.c_char_p];x.XOpenDisplay.restype=ctypes.c_void_p;d=x.XOpenDisplay(os.environ['DISPLAY'].encode())
x.XRaiseWindow.argtypes=[ctypes.c_void_p,ctypes.c_ulong];x.XSetInputFocus.argtypes=[ctypes.c_void_p,ctypes.c_ulong,ctypes.c_int,ctypes.c_ulong];x.XSync.argtypes=[ctypes.c_void_p,ctypes.c_int]
x.XRaiseWindow(d,windows[0]);x.XSetInputFocus(d,windows[0],1,0);x.XSync(d,0)
`,String(child.pid),mainTitle]);
 await pause(2200);await run(`window.focus();window.p=app.plugins.plugins['${id}'];window.md=app.workspace.getLeavesOfType('markdown')[0]?.view;window.scene=app.vault.getAbstractFileByPath('Direct.md');window.wait=ms=>new Promise(r=>setTimeout(r,ms));`);evidence.launches??=[];evidence.launches.push(await run(`return {vault:app.vault.adapter.basePath,version:p.manifest.version,userAgent:navigator.userAgent};`));}
async function stop(){ws?.close();ws=null;if(child&&child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),pause(5000)]);}await pause(300);}
async function snapshot(){const files={};async function visit(dir){for(const e of await readdir(path.join(vault,dir),{withFileTypes:true})){if(e.name==='.obsidian')continue;const relative=path.join(dir,e.name);if(e.isDirectory())await visit(relative);else files[relative]=await readFile(path.join(vault,relative),'utf8');}}await visit('');return files;}
try{
for(const mode of (process.env.MWC_RELEASE_SCENARIOS?.split(',')??['clean','upgrade'])){
 const root=await mkdtemp('/tmp/mwc020-'+mode+'-');vault=path.join(root,'vault');const profile=path.join(root,'profile');await mkdir(vault);await mkdir(profile);
 const notes={
 'Book.md':'---\ntype: book\ntitle: Synthetic Book\n---\n',
 'Other Book.md':'---\ntype: book\ntitle: Other Book\n---\n',
 'Part.md':'---\ntype: part\ntitle: Middle Part\nparent: "[[Book]]"\nmanuscript_order_key: "0000000002"\n---\n',
 'Direct.md':'---\ntype: scene\ntitle: Direct\nparent: "[[Book]]"\nmanuscript_order_key: "0000000001"\nfixture_property: retained\n---\n\nRepeated passage.\n\nA **bold** word.\n\nRepeated passage.\n',
 'Child.md':'---\ntype: scene\ntitle: Child\nparent: "[[Part]]"\nmanuscript_order_key: "0000000001"\n---\n\nPart passage.\n',
 'Other.md':'---\ntype: scene\ntitle: Other\nparent: "[[Other Book]]"\nmanuscript_order_key: "0000000001"\n---\n\nOther passage.\n',
 'Saved.svg':'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="20"><text x="0" y="15">Synthetic saved chart</text></svg>\n',
 'Saved table.md':'| State | Count |\n| --- | --- |\n| synthetic | 1 |\n',
 'Definition.md':'---\nworld_entity: derived-artefact\nreport_type: chart\n---\n\nSynthetic preserved definition.\n',
 'Embeds.md':'![[Saved.svg]]\n\n![[Saved table.md]]\n'};
 for(const [name,text] of Object.entries(notes))await writeFile(path.join(vault,name),text);
 await install(mode==='upgrade'?old:candidate);
 const hotkeys=JSON.stringify({[id+':generate-derived-artefact']:[{modifiers:['Mod'],key:'G'}],[id+':generate-all-derived-artefacts']:[{modifiers:['Mod','Shift'],key:'G'}]});
 await writeFile(path.join(vault,'.obsidian/hotkeys.json'),hotkeys);
 await writeFile(path.join(vault,'.obsidian/community-plugins.json'),JSON.stringify([id]));
 const leaf=(leafId,type,state={})=>({id:leafId,type:'leaf',state:{type,state}});
 await writeFile(path.join(vault,'.obsidian/workspace.json'),JSON.stringify({main:{id:'root',type:'split',children:[{id:'tabs',type:'tabs',children:[leaf('editor','markdown',{file:'Direct.md',mode:'preview'})]}],direction:'vertical'},right:{id:'right',type:'split',children:[{id:'righttabs',type:'tabs',children:[leaf('companion','murmuration-writing-companion-view')]}],direction:'horizontal',width:330,collapsed:false},active:'editor'}));
 await writeFile(path.join(profile,'obsidian.json'),JSON.stringify({vaults:{2000000000000020:{path:vault,ts:1,open:true}}}));
 const checks=[];evidence.scenarios.push({mode,fixture:root,checks});const check=(condition,name,detail)=>{assert.ok(condition,name);checks.push({name,passed:true,...detail});};
 await launch(profile);evidence.environment=await run(`return {userAgent:navigator.userAgent,electron:process.versions.electron,platform:process.platform};`);
 if(mode==='upgrade'){
  check(await run(`return p.manifest.version==='0.19.0'&&!!app.commands.commands['${id}:generate-derived-artefact']&&!!app.commands.commands['${id}:generate-all-derived-artefacts'];`),'actual published 0.19.0 loaded with both aliases');
  await run(`for(const [file,name] of [['Direct.md','legacy'],['Child.md','part'],['Other.md','other']])await p.storeService.addAnnotation(app.vault.getAbstractFileByPath(file),{text:file==='Direct.md'?'Repeated passage.':file==='Child.md'?'Part passage.':'Other passage.',line:2},'Existing 0.19 editorial body '+name,'Editorial',name);`);
  await run(`p.storeService.updateChapterNote(scene,'Existing chapter note from 0.19');await p.storeService.flushChapterNote(scene);await p.storeService.setEditorialPassCompleted(scene,'draft',true);const resolved=await p.storeService.addAnnotation(scene,{text:'A **bold** word.',line:11},'Existing resolved annotation','Style');await p.storeService.updateAnnotation(scene,p.storeService.getPage(scene).annotations.find(a=>a.id===resolved),{status:'resolved'});`);
  const before=await snapshot();await stop();await install(candidate);await launch(profile);
  const after=await snapshot();check(JSON.stringify(before)===JSON.stringify(after),'upgrade startup preserves all manuscript, generated and existing portable store bytes');
  check(await run(`return p.storeService.getPage(scene).annotations.some(a=>a.body==='Existing 0.19 editorial body legacy');`),'existing editorial record loads intact');
  check(await run(`const page=p.storeService.getPage(scene);return page.chapterNote.body==='Existing chapter note from 0.19'&&page.editorialPassHistory.some(e=>e.pass==='draft'&&e.action==='completed')&&page.annotations.some(a=>a.body==='Existing resolved annotation'&&a.status==='resolved');`),'existing Chapter Notes, pass history and resolved annotation preserved');
 }
 check(await run(`return p.manifest.version==='0.20.0'&&!app.commands.commands['${id}:generate-derived-artefact']&&!app.commands.commands['${id}:generate-all-derived-artefacts']&&!app.plugins.plugins['${rid}'];`),'0.20 independent without Reports; old aliases absent');
 if(mode==='clean')await run(`for(const [file,name] of [['Child.md','part'],['Other.md','other']])await p.storeService.addAnnotation(app.vault.getAbstractFileByPath(file),{text:file==='Child.md'?'Part passage.':'Other passage.',line:2},'Synthetic body '+name,'Editorial',name);`);
 // A real Reading selection, followed by the registered command and Chromium typing.
 await run(`await md.leaf.openFile(scene,{state:{mode:'preview'}});app.workspace.setActiveLeaf(md.leaf,{focus:true});await wait(700);const ps=md.contentEl.querySelectorAll('.el-p p');const el=ps[2];if(!el)throw Error('missing second occurrence');const range=document.createRange();range.selectNodeContents(el);document.getSelection().removeAllRanges();document.getSelection().addRange(range);document.dispatchEvent(new Event('selectionchange'));await wait(100);`);
 await pause(500);console.log('selection',mode,await run(`return {capture:!!p.readingSelection?.selection,mode:md.getMode(),focus:document.hasFocus(),selection:document.getSelection()?.toString()};`));
 await run(`app.commands.executeCommandById('${id}:annotate');await wait(800);`);
 console.log('editor',await run(`return {focus:document.activeElement?.className,mode:md.getMode(),modals:[...document.querySelectorAll('.modal')].map(e=>e.innerText),notices:[...document.querySelectorAll('.notice')].map(e=>e.innerText)};`));
 check(await run(`return document.activeElement?.matches('.modal textarea')&&md.getMode()==='preview'&&document.querySelectorAll('.modal').length===1;`),'Reading command opens one focused annotation editor');
 await send('Input.insertText',{text:'Release candidate annotation body'});
 await run(`document.querySelector('.modal .mod-cta').click();await wait(900);window.created=p.storeService.getPage(scene).annotations.find(a=>a.body==='Release candidate annotation body');if(!created)throw Error('annotation not saved');`);
 const anchor=await run(`return {anchor:created.anchor,mode:md.getMode()};`);check(anchor.mode==='preview'&&!!anchor.anchor.range,'Reading creation preserves exact anchor and mode',{anchor:anchor.anchor});
 await run(`await p.annotationBoard.open('Book.md');await wait(900);window.board=app.workspace.getLeavesOfType('mwc-annotation-board')[0].view;window.card=()=>[...board.contentEl.querySelectorAll('.mwc-board-card')].find(e=>JSON.parse(e.dataset.annotationKey)[1]===created.id);`);
 check(await run(`return !board.contentEl.innerText.includes('Synthetic body other')&&!board.contentEl.innerText.includes('Existing 0.19 editorial body other')&&!!card();`),'Board Book isolation');
 await run(`const el=board.contentEl.querySelector('[aria-label="Filter by part"]');el.value='Part.md';el.dispatchEvent(new Event('change',{bubbles:true}));await wait(400);`);
 check(await run(`return !card()&&board.contentEl.querySelectorAll('.mwc-board-card').length===1;`),'Board Part filter');
 await run(`const el=board.contentEl.querySelector('[aria-label="Filter by part"]');el.value='';el.dispatchEvent(new Event('change',{bubbles:true}));await wait(400);const select=card().querySelector('select');select.value='Canon';select.dispatchEvent(new Event('change',{bubbles:true}));await wait(700);`);
 check(await run(`return created.category==='Canon';`),'Board accessible category save');
 await run(`[...card().querySelectorAll('button')].find(b=>b.textContent==='Edit annotation').click();await wait(500);`);
 check(await run(`return document.activeElement?.matches('.modal textarea');`),'existing editor body focus');
 await run(`document.querySelector('.modal textarea').value='Edited release body';document.querySelector('.modal .mod-cta').click();await wait(700);`);
 check(await run(`return created.body==='Edited release body';`),'Board edit persisted');
 await run(`card().querySelector('.mwc-annotation-resolve').click();await wait(700);`);check(await run(`return !card()&&created.status==='resolved';`),'resolve disappears immediately');
 await run(`const el=board.contentEl.querySelector('input[type=checkbox]');el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));await wait(300);card().querySelector('.mwc-annotation-reopen').click();await wait(700);`);check(await run(`return created.status==='open';`),'show resolved and reopen');
 await run(`card().querySelector('.mwc-annotation-extract').click();for(let n=0;n<25&&document.getSelection()?.toString()!=='Repeated passage.';n++)await wait(200);`);
 const navigation=await run(`return {mode:md.getMode(),file:md.file?.path,selection:document.getSelection()?.toString(),boards:app.workspace.getLeavesOfType('mwc-annotation-board').length,occurrence:[...md.contentEl.querySelectorAll('.el-p p')].filter(e=>e.textContent==='Repeated passage.').indexOf(document.getSelection()?.anchorNode?.parentElement?.closest('p'))};`);console.log('navigation',navigation);check(navigation.mode==='preview'&&navigation.selection==='Repeated passage.'&&navigation.boards===1&&navigation.occurrence===1,'exact Reading navigation retains Board',{navigation});
 check(JSON.stringify(await run('return created.anchor;'))===JSON.stringify(anchor.anchor),'lifecycle retains exact export-anchor evidence');
 const reportsBefore=await snapshot();
 await install(reports,rid);await run(`await app.plugins.loadManifests();await app.plugins.enablePluginAndSave('${rid}');await wait(800);`);
 const replacements=await run(`return ['generate-derived-artefact','generate-all-derived-artefacts'].map(id=>({id:'${rid}:'+id,name:app.commands.commands['${rid}:'+id]?.name}));`);
 check(replacements.every(c=>!!c.name),'Reports replacement commands available when enabled',{commands:replacements});
 await run(`await app.plugins.disablePluginAndSave('${rid}');await wait(500);p.filenameTitlePreference.set(false);`);
 check(JSON.stringify(await snapshot())===JSON.stringify(reportsBefore),'enabling/disabling Reports performs no manuscript/store/generated writes');
 check(await readFile(path.join(vault,'.obsidian/hotkeys.json'),'utf8')===hotkeys,'hotkey file untouched');
 const preRestart=await snapshot();const persisted=await run(`return JSON.stringify(p.storeService.store);`);await stop();await launch(profile);
 check(await run(`return p.filenameTitlePreference.get()===false;`),'notification preference survives application restart');
 check(await run(`return JSON.stringify(p.storeService.store)===${JSON.stringify(persisted)};`),'editorial records survive application restart intact');
 check(JSON.stringify(await snapshot())===JSON.stringify(preRestart),'restart has no automatic manuscript/store/generated migration');
 const final=await snapshot();const strip=s=>s.replace(/^mwc_open_annotations:.*\n/gm,'');
 for(const [name,source] of Object.entries(notes))check(strip(final[name])===strip(source),'file integrity: '+name,{beforeSha256:digest(source),afterSha256:digest(final[name]),normalizedSha256:digest(strip(final[name]))});
 check(!Object.keys(final).some(n=>!(n in notes)&&!n.startsWith('.murmuration/writing-companion/editorial-data.json')),'only established portable-store/recovery files created');
 await stop();await writeFile(output,JSON.stringify(evidence,null,2)+'\n');
}
}finally{await stop();await writeFile(output,JSON.stringify(evidence,null,2)+'\n');}
console.log(JSON.stringify({output,scenarios:evidence.scenarios.map(s=>({mode:s.mode,checks:s.checks.length}))}));
