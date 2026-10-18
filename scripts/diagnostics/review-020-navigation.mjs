// Extra native review cases. Called only inside qualify-020-release's new synthetic vault.
export async function review020Navigation(run, check) {
  const result = await run(`
    const original = await app.vault.read(scene);
    const store = JSON.stringify(p.storeService.store);
    const bodyStart = original.match(/^---\\r?\\n[\\s\\S]*?\\r?\\n---(?:\\r?\\n|$)/)[0].length;
    const changedHeader = original.slice(0,bodyStart).replace(/\\r?\\n/g,'\\r\\n') + original.slice(bodyStart);
    const occurrence = () => [...md.contentEl.querySelectorAll('.el-p p')]
      .filter(e=>e.textContent==='Repeated passage.')
      .indexOf(document.getSelection()?.anchorNode?.parentElement?.closest('p'));
    const out = {};
    try {
      await app.vault.modify(scene,changedHeader);await wait(900);
      await app.workspace.revealLeaf(board.leaf);document.getSelection().removeAllRanges();
      card().querySelector('.mwc-annotation-extract').click();
      for(let n=0;n<25&&occurrence()!==1;n++)await wait(200);
      out.crlfHeader = {mode:md.getMode(),occurrence:occurrence(),selection:document.getSelection()?.toString()};
      document.getSelection().removeAllRanges();
      const from=changedHeader.lastIndexOf('Repeated passage.');
      out.staleBodyRejected = p.readingAnnotationCapture.reveal(md.contentEl,scene.path,changedHeader+'Changed prose.',from,from+17)===false;
      out.bodyLineEndingsRejected = p.readingAnnotationCapture.reveal(md.contentEl,scene.path,changedHeader.replace(/\\r?\\n/g,'\\r\\n'),from,from+17)===false;
      out.noWrongHighlight = document.getSelection()?.toString()==='';
    } finally { await app.vault.modify(scene,original);await wait(900); }
    await md.leaf.setViewState({type:'markdown',state:{file:scene.path,mode:'source',source:true}});await wait(500);
    await app.workspace.revealLeaf(board.leaf);card().querySelector('.mwc-annotation-extract').click();await wait(700);
    out.edit = {mode:md.getMode(),selection:md.editor.getSelection(),offset:md.editor.posToOffset(md.editor.getCursor('from')),expected:original.lastIndexOf('Repeated passage.')};
    await md.leaf.setViewState({type:'markdown',state:{file:scene.path,mode:'preview'}});await wait(700);
    out.storeUnchanged = store===JSON.stringify(p.storeService.store);
    out.manuscriptRestored = original===await app.vault.read(scene);
    return out;
  `);
  check(result.crlfHeader.mode==='preview' && result.crlfHeader.occurrence===1 && result.crlfHeader.selection==='Repeated passage.', 'review: CRLF-only frontmatter navigation reveals second duplicate', {result:result.crlfHeader});
  check(result.staleBodyRejected && result.bodyLineEndingsRejected && result.noWrongHighlight, 'review: stale/line-ending-changed bodies produce no new highlight');
  check(result.edit.mode==='source' && result.edit.selection==='Repeated passage.' && result.edit.offset===result.edit.expected, 'review: edit-mode navigation retains exact occurrence', {result:result.edit});
  check(result.storeUnchanged && result.manuscriptRestored, 'review: navigation leaves store and restored manuscript byte-identical');
}

export async function reviewPublishedReports(run, check) {
  const result = await run(`
    const leaf=app.workspace.getLeaf('tab');await leaf.openFile(app.vault.getAbstractFileByPath('Definition.md'));await wait(500);
    const results=[];
    try {
      for(const id of ['generate-derived-artefact','generate-all-derived-artefacts']) {
        app.commands.executeCommandById('murmuration-reports:'+id);
        for(let n=0;n<30&&!document.querySelector('.modal');n++)await wait(100);
        const modal=document.querySelector('.modal');results.push({id,text:modal?.innerText??''});
        modal?.querySelector('button')?.click();await wait(200);
      }
    } finally { leaf.detach(); }
    return results;
  `);
  check(result.length===2 && result.every(r=>r.text.includes('Report generation results') && r.text.includes('Definition.md')), 'review: both published Reports replacement commands execute and report unsupported fixture safely', {results:result});
}
