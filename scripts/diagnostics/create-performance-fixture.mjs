// Creates a NEW disposable vault only. Never accepts an existing directory.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(process.argv[2] ?? '');
const size = Number(process.argv[3]);
if (!process.argv[2] || ![100, 1000, 10000].includes(size)) throw new Error('Usage: node scripts/diagnostics/create-performance-fixture.mjs NEW_DIRECTORY 100|1000|10000');
await mkdir(root); // EEXIST is intentional protection.
await writeFile(path.join(root, '.mwc-performance-fixture'), 'MWC disposable performance fixture\n');
const note = (name, fm) => writeFile(path.join(root, name + '.md'), '---\n' + Object.entries(fm).map(([k,v])=>k+': '+JSON.stringify(v)).join('\n') + '\n---\n\nSynthetic public performance fixture prose.\n');
await mkdir(path.join(root,'Control')); await note('Control/Note',{title:'Control'});
await note('README',{title:'Disposable synthetic fixture'});
for (let b=0;b<3;b++) { await note(`Book${b}`,{type:'book',title:`Book${b}`}); await note(`Part${b}`,{type:'part',title:`Part${b}`,parent:`[[Book${b}]]`,manuscript_order_key:'5000000000'}); }
const entities=Math.floor(size/5), scenes=size-entities-8;
for(let i=0;i<scenes;i++) {const b=i%3,n=Math.floor(i/3),name=`B${b}S${String(n).padStart(3,'0')}`; await note(name,{type:'scene',title:name,parent:n%2?`[[Part${b}]]`:`[[Book${b}]]`,manuscript_order_key:String((n+1)*10000).padStart(10,'0'),pov:'[[Entity00000]]',location:'[[Entity00001]]',status:'draft',story_date:n===0?'2026-01-02':'2026-01-01',manuscript_series_number:'authored alias'});}
for(let i=0;i<entities;i++) {const name=`Entity${String(i).padStart(5,'0')}`;await note(name,{world_entity:['character','location','event'][i%3],world_name:name,aliases:[`Alias ${i}`],...(i%3===2?{world_time:i%2?{at:'2026-01-01',precision:'day'}:{from:'2026-01-01',until:'2026-01-02',precision:'day'}}:{}),...(i?{world_relationships:[{predicate:'knows',target:`[[Entity${String(i-1).padStart(5,'0')}]]`}]}:{})});}
console.log(JSON.stringify({root,markdownFiles:size,books:3,parts:3,scenes,entities}));
