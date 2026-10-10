// Optional integration check against a separate, unmodified Codex Press checkout.
// All manuscript content is synthetic and in memory; no vault is opened or written.
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
if (!process.argv[2]) throw new Error('Usage: node scripts/validate-manual-numbering-compiler.mjs /path/to/codex-press');
const compiler = resolve(process.argv[2], 'src/compiler/compile-session.ts');
const temporary = await mkdtemp(resolve(tmpdir(), 'mwc-260-compiler-'));
try {
  const outfile = resolve(temporary, 'check.mjs');
  await build({ stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
    import { deepEqual, equal } from 'node:assert/strict';
    import { numberingHarness } from './tests/helpers/ManuscriptNumberingHarness';
    import { createAssembledCompileSession } from ${JSON.stringify(compiler)};
    const h = numberingHarness();
    await h.app.vault.rename(h.loaded.get('First.md'),'Part/First.md'); h.settle();
    const file = path => ({kind:'file',path,name:path,basename:path.replace(/\\.md$/, ''),extension:'md'});
    const root = {kind:'folder',path:'',name:'Synthetic',children:[...['Prologue.md','Part.md','Last.md'].map(file),{kind:'folder',path:'Part',name:'Part',children:[file('Part/First.md')]}]};
    const descriptor = {kind:'book',label:'Alpha',folder:{path:'',name:'Synthetic'},source:file('Alpha.md'),metadata:{type:'book',title:'Alpha',author:'Fixture'}};
    const gateway = {readMarkdown:async path=>'---\\n'+Object.entries(h.cache.get(path).frontmatter).map(([key,value])=>key+': '+JSON.stringify(value)).join('\\n')+'\\n---\\n'+h.contents.get(path).split('---\\n').pop(),resolveLink:async (_,link)=>h.app.metadataCache.getFirstLinkpathDest(link)?.path ?? null,readOptionalFolderTree:async()=>null};
    const compile = async () => {
      const result = await createAssembledCompileSession(gateway,descriptor,root);
      equal(result.preflight.canContinue,true,JSON.stringify(result.preflight.messages));
      const book = result.assembledBook;
      equal(book.manuscriptOrderSource,"explicit");
      return book.content.flatMap(element=>element.kind === "document" ? [element.document] : element.section.documents).map(doc=>[doc.sourcePath,doc.markdown]);
    };
    for (const path of ['Prologue.md','Part/First.md','Last.md']) await h.edit(path,fm=>{fm.book_scene_number=999;fm.manuscript_sequence='99.99.999';fm.series_scene_number=9000});
    const stale = await compile();
    deepEqual(stale.map(([path])=>path),["Prologue.md","Part/First.md","Last.md"]);
    equal(stale.every(([,markdown])=>typeof markdown === "string" && markdown.includes("Unchanged synthetic prose")),true);
    await h.renumber();
    deepEqual(await compile(),stale);
    equal(await h.renumber(),0);
    await h.edit('Last.md',fm=>{fm.type='scene-draft';delete fm.parent;delete fm.manuscript_order_key});
    const detached = await compile();
    equal(detached.some(([path])=>path==='Last.md'),false);
    equal(h.cache.get('Last.md').frontmatter.book_scene_number,3);
    console.log('Codex Press: identical assembly with stale and refreshed reports; detached stale snapshots excluded.');
  ` }, outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  await import(pathToFileURL(outfile).href);
} finally { await rm(temporary, { recursive: true, force: true }); }
