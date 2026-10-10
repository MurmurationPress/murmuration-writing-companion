// Counts actual library scans through the production Companion chronology call site.
// Synthetic notes only; isolated bundle output is removed on completion.
import {build} from 'esbuild';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const source=path.resolve(process.argv[2]??'.');
const temporary=await mkdtemp(path.join(tmpdir(),'mwc-chronology-'));
try {
  // Detect the archived caller's contract, not a guessed before-work count.
  const caller=await readFile(path.join(source,'src/main.ts'),'utf8');
  const settled=caller.includes('buildObsidianManuscriptChronology(this.app, chapter, this.manuscriptProjection.get())');
  await build({stdin:{resolveDir:process.cwd(),loader:'ts',contents:`
    import {numberingHarness} from './tests/helpers/ManuscriptNumberingHarness';
    import {equal} from 'node:assert/strict';
    import {buildObsidianManuscriptChronology as collect} from ${JSON.stringify(path.join(source,'src/manuscript/ObsidianManuscriptChronology.ts'))};
    const output=[];
    for(const size of [30,300,1000]) {
      const h=numberingHarness();
      for(let b=0;b<3;b++) {
        h.add('SyntheticBook'+b+'.md',{type:'book'});
        for(let i=0;i<size;i++)h.add('Synthetic'+b+'Scene'+i+'.md',{type:'scene',parent:'[[SyntheticBook'+b+']]',manuscript_order_key:String(i+1).padStart(10,'0')});
      }
      h.settle();const file=h.loaded.get('Synthetic0Scene0.md');const library=h.library();
      let scans=0;const enumerate=h.app.vault.getMarkdownFiles;h.app.vault.getMarkdownFiles=()=>{scans++;return enumerate()};
      const samples=[];
      for(let i=0;i<6;i++){scans=0;const start=performance.now();for(let j=0;j<10;j++){const result=collect(h.app,file,...(${settled}?[library]:[]));equal(result.book?.path,'SyntheticBook0.md');equal(result.dependencies.size,size+1);}if(i)samples.push({scans,ms:performance.now()-start});}
      output.push({scenesPerBook:size,books:3,samples});
    }
    console.log(JSON.stringify({settled:${settled},note:'One warmup and five samples; ten synchronous chronology consumers; synthetic cached frontmatter, no DOM or disk.',output},null,2));
  `},bundle:true,platform:'node',format:'esm',outfile:path.join(temporary,'run.mjs'),logLevel:'silent',plugins:[{name:'synthetic-obsidian',setup(b){b.onResolve({filter:/^obsidian$/},()=>({path:'obsidian',namespace:'synthetic'}));b.onLoad({filter:/.*/,namespace:'synthetic'},()=>({contents:'export class TFile {} export class TFolder {}'}));}}]});
  await import(pathToFileURL(path.join(temporary,'run.mjs')).href);
}finally{await rm(temporary,{recursive:true,force:true});}
