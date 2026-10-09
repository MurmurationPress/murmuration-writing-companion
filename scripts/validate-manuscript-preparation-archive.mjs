import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { inflateRawSync } from "node:zlib";
import { createRequire } from "node:module";
import { buildSync } from "esbuild";

// Offline integration only: production command and supplied compiler bundle,
// using mock Obsidian APIs. This is not live Obsidian or a publication export.
const require = createRequire(import.meta.url);
const archive = process.argv[2];
if (!archive) throw new Error("Usage: node scripts/validate-manuscript-preparation-archive.mjs /path/to/archive.zip");
const base = fs.mkdtempSync(path.join(os.tmpdir(), "mwc-preparation-261-"));
// Read standard stored/deflated ZIP entries without requiring a subprocess.
const zip = fs.readFileSync(archive);
const end = zip.lastIndexOf(Buffer.from("PK\x05\x06"));
if (end < 0) throw new Error("ZIP end record missing.");
let entryOffset = zip.readUInt32LE(end + 16);
for (let index = 0; index < zip.readUInt16LE(end + 10); index++) {
  if (zip.readUInt32LE(entryOffset) !== 0x02014b50) throw new Error("Invalid ZIP directory.");
  const size = zip.readUInt32LE(entryOffset + 20);
  const nameLength = zip.readUInt16LE(entryOffset + 28);
  const name = zip.subarray(entryOffset + 46, entryOffset + 46 + nameLength).toString("utf8");
  const target = path.resolve(base, name);
  if (!target.startsWith(base + path.sep)) throw new Error("ZIP entry outside disposable directory.");
  if (zip.readUInt16LE(entryOffset + 8) & 1) throw new Error("Encrypted ZIP not supported.");
  if (name.endsWith("/")) fs.mkdirSync(target, { recursive: true });
  else {
    const local = zip.readUInt32LE(entryOffset + 42);
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const bytes = zip.subarray(start, start + size);
    const method = zip.readUInt16LE(entryOffset + 10);
    if (method !== 0 && method !== 8) throw new Error("Unsupported ZIP compression.");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, method === 8 ? inflateRawSync(bytes) : bytes);
  }
  entryOffset += 46 + nameLength + zip.readUInt16LE(entryOffset + 30) + zip.readUInt16LE(entryOffset + 32);
}
const vaultName = fs.readdirSync(base).find(name => fs.existsSync(path.join(base, name, ".obsidian/plugins/codex-press/main.js")));
if (!vaultName) throw new Error("The supplied archive must include a vault and its Codex Press bundle.");
const archiveVault = path.join(base, vaultName);
console.log(JSON.stringify({mode: "Offline command and compiler integration with mock Obsidian APIs", disposableDirectory: base}));
const pressSource=fs.readFileSync(archiveVault+'/.obsidian/plugins/codex-press/main.js','utf8');
const obsidian=new Proxy({}, {get:(_target,name)=>name==='Platform'?{isDesktopApp:true}:class {}});
const press=new Function('require','module','exports',pressSource+'\nreturn { discoverProjects, assembleBook, buildManuscriptOrderPlan, parseSourceFrontmatter, ObsidianProjectGateway };')(name=>name==='obsidian'?obsidian:require(name),{exports:{}},{});
buildSync({entryPoints:['tests/helpers/ManuscriptPreparationHarness.ts'],bundle:true,platform:'node',format:'cjs',outfile:base+'/harness.cjs'});
const {preparationHarness}=require(base+'/harness.cjs');
(async()=>{
 for(const typed of [true,false]){
 const h=preparationHarness(typed);
 for(const [p,f] of h.loaded){if(f.extension!=='md')continue;let content=fs.readFileSync(path.join(archiveVault,p),'utf8');
  if(!typed)content=content.replace(/^type: (?:book|part|scene)\r?\n/m,'');
  h.contents.set(p,content);h.cache.set(p,{frontmatter:press.parseSourceFrontmatter(content)});f.stat.size=content.length;
 }
 h.contents.delete('The-Structure-of-Aikido/Assets/figure.png');
 function addAssets(dir){for(const name of fs.readdirSync(dir)){const full=path.join(dir,name);if(fs.statSync(full).isDirectory())addAssets(full);else h.contents.set(path.relative(archiveVault,full),fs.readFileSync(full));}}
 addAssets(path.join(archiveVault,'The-Structure-of-Aikido/Assets'));
 const original=new Map(h.contents);
 h.app.fileManager.processFrontMatter=async(file,change)=>{
  const content=h.contents.get(file.path),fm=press.parseSourceFrontmatter(content);change(fm);
  const yaml=Object.entries(fm).map(([key,value])=>`${key}: ${JSON.stringify(value)}`).join('\n');
  const body=content.replace(/^---\s*\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/,'');
  await h.app.vault.modify(file,`---\n${yaml}\n---\n${body}`);
 };
 const root=h.loaded.get(h.fixture.root),selection=h.api.initialManuscriptPreparationSelection(h.app,root),book=h.api.buildSelectedManuscript(h.app,selection);
 const plan=await h.api.validateManuscriptPreparationPreview(h.app,book,h.api.planObsidianManuscriptPreparation(h.app,book));
 if(!plan.canApply)throw new Error(JSON.stringify(plan.diagnostics));
 // Exercise the actual installed command through root selection and both review stages.
 const operation=h.invoke();await h.choose();await h.click('Review structural changes');await h.click('Prepare manuscript');await operation;
 if(h.notices.some(s=>/Could not|changed before|Cannot/.test(s)))throw new Error(h.notices.join('\n'));
 const gateway={
  listMarkdownSources:async()=>[...h.loaded.values()].filter(f=>f.extension==='md').map(f=>({path:f.path,name:f.basename+'.md',basename:f.basename})),
  readSource:async p=>h.contents.get(p),readMarkdown:async p=>h.contents.get(p),
  resolveLink:async(source,link)=>h.app.metadataCache.getFirstLinkpathDest(link)?.path||null,
  resolveFolderForFolderNote:async source=>{const f=h.loaded.get(source.path),folder=h.api.associatedManuscriptFolderPath(h.app,f);return folder?{path:folder,name:folder.split('/').pop()}:null;},
  listMarkdownPaths:async()=>[...h.loaded.values()].filter(f=>f.extension==='md').map(f=>f.path),
  listBasePaths:async()=>[],
 };
 function tree(p){const folder=h.loaded.get(p);return {kind:'folder',path:p,name:folder.name,children:[...h.loaded.values()].filter(f=>f.parent===folder).map(f=>f.extension==='md'?{kind:'file',path:f.path,name:f.basename+'.md',basename:f.basename,extension:'md'}:tree(f.path))};}
 const preparedBook=h.api.buildObsidianManuscriptLibrary(h.app).books[0];
 const orderPlan=await press.buildManuscriptOrderPlan(gateway,{bookContent:h.contents.get(h.fixture.root),bookSourcePath:h.fixture.root,bookFolderPath:'The-Structure-of-Aikido',candidates:preparedBook.result.entries.map(entry=>({path:entry.path,basename:entry.basename,title:entry.title,kind:entry.kind,fallbackParentPath:entry.parentPath,parentReference:h.cache.get(entry.path).frontmatter.parent}))});
 console.log(JSON.stringify({typed,orderValidation:{source:orderPlan.source,entries:orderPlan.entries.length,errors:orderPlan.diagnostics.filter(d=>d.severity==='error')}},null,2));
 const projects=await press.discoverProjects(gateway,['book']);
 const assembled=await press.assembleBook(gateway,projects[0],tree('The-Structure-of-Aikido'));
 const diagnostics=assembled.diagnostics.filter(d=>d.severity==='error');
 console.log(JSON.stringify({typed,preparedNotes:h.writes(),projects:projects.length,manuscriptOrderSource:assembled.manuscriptOrderSource,parts:assembled.sections.filter(s=>s.role==='part').length,documents:assembled.rootDocuments.length+assembled.sections.reduce((n,s)=>n+s.documents.length,0),errors:diagnostics},null,2));
 const output=path.join(base,typed?'prepared-typed-vault':'prepared-untyped-vault');
 for(const [p,content] of h.contents){const target=path.join(output,p);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);}
 for(const [p,bytes] of original){if(Buffer.isBuffer(bytes) && !bytes.equals(h.contents.get(p)))throw new Error('Asset changed: '+p);}
 await h.invoke('undo-manuscript-preparation');await h.tick();console.log(JSON.stringify({notices:h.notices}));
 for(const [p,bytes] of original){const current=h.contents.get(p);if(Buffer.isBuffer(bytes)?!bytes.equals(current):bytes!==current)throw new Error('Undo mismatch: '+p);}
 console.log(JSON.stringify({typed,exactUndo:true,assetCount:[...original.values()].filter(Buffer.isBuffer).length}));
 if(diagnostics.length)process.exitCode=1;
 }
})().catch(error => { console.error(error); process.exitCode = 1; });
