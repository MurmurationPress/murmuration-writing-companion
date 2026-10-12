import {test} from 'node:test';
import {deepEqual,equal} from 'node:assert/strict';
import {installReportsCommandBridge} from '../src/reports/ReportsCommandBridge';
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
test('bridge preserves old IDs, resolves either loading order and captures path before await',async()=>{
 const commands=new Map<string,()=>void>();const calls:string[]=[];const notices:string[]=[];let active={path:'Definitions/A.md',extension:'md'};
 const capability={version:1 as const,generateDefinition:async(path:string)=>{await tick();calls.push(path);return{definitionPath:path,status:'created',message:'ok'};},generateAll:async()=>[],showResults:(results:readonly unknown[])=>calls.push('results:'+results.length)};
 const app:{workspace:{getActiveFile:()=>typeof active};murmurationReports?:typeof capability}={workspace:{getActiveFile:()=>active}};
 installReportsCommandBridge({app,addCommand:c=>commands.set(c.id,c.callback)},m=>notices.push(m));
 deepEqual([...commands.keys()],['generate-derived-artefact','generate-all-derived-artefacts']);commands.get('generate-derived-artefact')!();await tick();equal(notices.length,1);
 app.murmurationReports=capability;commands.get('generate-derived-artefact')!();active={path:'Definitions/B.md',extension:'md'};await tick();await tick();deepEqual(calls,['Definitions/A.md','results:1']);
 delete app.murmurationReports;commands.get('generate-all-derived-artefacts')!();await tick();equal(notices.length,2);app.murmurationReports=capability;commands.get('generate-all-derived-artefacts')!();await tick();equal(calls[calls.length-1],'results:0');
 const first=new Map<string,()=>void>();installReportsCommandBridge({app,addCommand:c=>first.set(c.id,c.callback)},m=>notices.push(m));first.get('generate-all-derived-artefacts')!();await tick();equal(calls[calls.length-1],'results:0');
});
test('bridge has no fallback writer and handles unavailable version, bad active file and rejection',async()=>{
 const commands=new Map<string,()=>void>();const notices:string[]=[];const app={workspace:{getActiveFile:()=>({path:'Image.svg',extension:'svg'})},murmurationReports:{version:1 as const,generateDefinition:async()=>{throw Error('unexpected');},generateAll:async()=>{throw Error('disabled during request');},showResults:()=>{throw Error('unexpected');}}};
 installReportsCommandBridge({app,addCommand:c=>commands.set(c.id,c.callback)},m=>notices.push(m));commands.get('generate-derived-artefact')!();commands.get('generate-all-derived-artefacts')!();await tick();equal(notices[0],'Open a report definition note first.');equal(notices[1],'Could not generate reports: disabled during request');
 (app.murmurationReports as {version:number}).version=2;commands.get('generate-all-derived-artefacts')!();await tick();equal(notices[2].startsWith('Enable Murmuration Reports'),true);
});
