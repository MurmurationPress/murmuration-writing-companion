// Extra adversarial cases, sharing the disposable-vault CDP harness of the main replay.
import assert from 'node:assert/strict';

export async function reviewReadingAnnotations({ evaluate, send, click, pause, pluginId }) {
  const result = {};
  await evaluate(`globalThis.reviewSelect=(view,element,from=0,to=element.textContent.length)=>{
    const doc=element.ownerDocument,walker=doc.createTreeWalker(element,NodeFilter.SHOW_TEXT),nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    const locate=offset=>{for(const node of nodes){if(offset<=node.length)return {node,offset};offset-=node.length;}throw Error('Invalid fixture offset');};
    const a=locate(from),b=locate(to),range=doc.createRange();range.setStart(a.node,a.offset);range.setEnd(b.node,b.offset);
    doc.getSelection().removeAllRanges();doc.getSelection().addRange(range);
    doc.dispatchEvent(new doc.defaultView.Event('selectionchange'));
    const selected=p.readingSelection;return selected?.selection?{path:selected.file.path,from:selected.selection.from,to:selected.selection.to,text:selected.selection.source.slice(selected.selection.from,selected.selection.to)}:null;
  };`);
  // Ordinary prose must work in complex notes and beside literal punctuation or inline code.
  const complexSource = 'Ordinary paragraph.\n\nThe price is $5 and a < b | c.\n\nOrdinary opening with `inline code` and ordinary closing.\n\n> [!note] Synthetic callout\n> Repeated callout paragraph.\n>\n> Repeated callout paragraph.\n\nText around [[Other|alias]] here.\n\n```\nSynthetic code block.\n```\n\nOrdinary final paragraph.\n';
  await evaluate(`globalThis.complexFile=await app.vault.create('Complex.md',${JSON.stringify(complexSource)});await md.leaf.openFile(complexFile,{state:{mode:'preview'}});app.workspace.setActiveLeaf(md.leaf,{focus:true});await settle();`);
  const mapped = await evaluate(`return [...md.contentEl.querySelectorAll('.el-p p,.callout-content > p')].map(element=>({rendered:element.textContent,capture:reviewSelect(md,element)}));`);
  assert.equal(mapped.length, 7); assert.ok(mapped.every(entry => entry.capture));
  const repeated = mapped.filter(entry => entry.rendered === 'Repeated callout paragraph.');
  assert.equal(repeated[1].capture.from, complexSource.lastIndexOf('Repeated callout paragraph.'));
  result.complexProse = mapped;
  const invalid = await evaluate(`return reviewSelect(md,md.contentEl.querySelector('pre code'));`);
  assert.equal(invalid, null);
  await evaluate(`app.commands.executeCommandById('${pluginId}:annotate');await settle();`);
  const rejected = await evaluate(`return {modal:!!document.querySelector('.modal'),notices:[...document.querySelectorAll('.notice')].map(e=>e.textContent)};`);
  assert.equal(rejected.modal, false); assert.ok(rejected.notices.some(text => text.includes('cannot be mapped reliably'))); result.unsupported = rejected;
  // Explicit deselection must not offer to save an old passage.
  await evaluate(`reviewSelect(md,md.contentEl.querySelector('.el-p p'));document.getSelection().collapseToStart();document.dispatchEvent(new Event('selectionchange'));app.commands.executeCommandById('${pluginId}:annotate');await settle();`);
  const deselected = await evaluate(`return {cached:!!p.readingSelection,modal:!!document.querySelector('.modal'),notices:[...document.querySelectorAll('.notice')].map(e=>e.textContent)};`);
  assert.equal(deselected.cached, false); assert.equal(deselected.modal, false); assert.ok(deselected.notices.includes('Select text first.')); result.deselection = deselected;
  // Moving focus to the Companion preserves the last deliberate manuscript selection.
  await evaluate(`reviewSelect(md,md.contentEl.querySelector('.el-p p'));const companion=app.workspace.getLeavesOfType('murmuration-writing-companion-view')[0];app.workspace.setActiveLeaf(companion,{focus:true});companion.view.containerEl.querySelector('input')?.focus();document.getSelection().removeAllRanges();document.dispatchEvent(new Event('selectionchange'));app.commands.executeCommandById('${pluginId}:annotate');await settle();`);
  assert.equal(await evaluate(`return document.querySelector('.modal blockquote')?.textContent;`), 'Ordinary paragraph.');
  await click('.modal button', 'Cancel');
  // Escape cannot cancel in-flight validation and then allow a duplicate activation.
  await evaluate(`app.workspace.setActiveLeaf(md.leaf,{focus:true});reviewSelect(md,md.contentEl.querySelector('.el-p p'));app.commands.executeCommandById('${pluginId}:annotate');await settle();globalThis.reviewRead=app.vault.read;globalThis.reviewGate=null;globalThis.reviewHeld=false;app.vault.read=async function(file){if(file===complexFile&&!reviewHeld){reviewHeld=true;await new Promise(resolve=>reviewGate=resolve);}return reviewRead.call(this,file);};document.querySelector('.modal textarea').value='One busy save.';[...document.querySelectorAll('.modal button')].find(e=>e.textContent==='Save annotation').click();`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  assert.equal(await evaluate(`return document.querySelectorAll('.modal').length;`), 1);
  await evaluate(`app.vault.read=reviewRead;reviewGate();await settle();`);
  assert.equal(await evaluate(`return p.storeService.getPage(complexFile).annotations.length;`), 1); result.busySave = { singleRecord: true };
  // Failed persistence must not leave a cancelled record or duplicate a retried draft.
  await evaluate(`app.workspace.setActiveLeaf(md.leaf,{focus:true});reviewSelect(md,md.contentEl.querySelector('.el-p p'));app.commands.executeCommandById('${pluginId}:annotate');await settle();document.querySelector('.modal textarea').value='Retry after synthetic disk failure.';globalThis.reviewSave=p.storeService.save;p.storeService.save=async()=>{throw Error('Synthetic persistence failure');};[...document.querySelectorAll('.modal button')].find(e=>e.textContent==='Save annotation').click();await settle();`);
  const failedSave = await evaluate(`return {records:p.storeService.getPage(complexFile).annotations.length,modal:!!document.querySelector('.modal')};`);
  assert.deepEqual(failedSave, { records: 1, modal: true });
  await evaluate(`p.storeService.save=reviewSave;`); await click('.modal button', 'Save annotation');
  assert.equal(await evaluate(`return p.storeService.getPage(complexFile).annotations.length;`), 2);
  result.saveRetry = { failedSave, afterRetry: 2 };
  // A changed snapshot with same-line duplicates gets an honest line fallback.
  await evaluate(`globalThis.sameFile=await app.vault.create('Same.md','same same\\n\\nTail.\\n');await md.leaf.openFile(sameFile,{state:{mode:'preview'}});app.workspace.setActiveLeaf(md.leaf,{focus:true});await settle();reviewSelect(md,md.contentEl.querySelector('.el-p p'),5,9);app.commands.executeCommandById('${pluginId}:annotate');await settle();document.querySelector('.modal textarea').value='Second same-line occurrence.';`);
  await click('.modal button', 'Save annotation');
  await evaluate(`await app.vault.modify(sameFile,(await app.vault.read(sameFile))+'\\nEdited elsewhere.\\n');await settle();await p.navigateToAnnotation(sameFile,p.storeService.getPage(sameFile).annotations[0]);await settle();`);
  const ambiguity = await evaluate(`return {selection:document.getSelection()?.toString(),notices:[...document.querySelectorAll('.notice')].map(e=>e.textContent),mode:md.getMode()};`);
  assert.ok(ambiguity.notices.includes('The passage has changed; moved to its original line.')); assert.equal(ambiguity.mode, 'preview'); result.changedDuplicate = ambiguity;
  // Unload cancels the transient editor and removes the old document listeners.
  await evaluate(`reviewSelect(md,md.contentEl.querySelector('.el-p p'));app.commands.executeCommandById('${pluginId}:annotate');await settle();globalThis.oldReviewSession=p.readingSession;await app.plugins.disablePlugin('${pluginId}');await settle();`);
  const unloaded = await evaluate(`return {modal:!!document.querySelector('.modal'),listeners:oldReviewSession.documents.size,cached:!!oldReviewSession.get()};`);
  assert.deepEqual(unloaded, { modal: false, listeners: 0, cached: false }); result.unload = unloaded;
  await evaluate(`await app.plugins.enablePlugin('${pluginId}');p=app.plugins.plugins['${pluginId}'];await settle();`);
  // Popout keeps its own selected passage even while the main document retains another.
  await evaluate(`globalThis.popReview=app.workspace.openPopoutLeaf({width:900,height:700});await popReview.openFile(complexFile,{state:{mode:'preview'}});app.workspace.setActiveLeaf(popReview,{focus:true});await settle();`);
  const popCapture = await evaluate(`reviewSelect(md,md.contentEl.querySelector('.el-p p'),5,9);const view=popReview.view;const element=[...view.contentEl.querySelectorAll('.el-p p')].find(e=>e.textContent==='Ordinary final paragraph.');app.workspace.setActiveLeaf(popReview,{focus:true});view.contentEl.ownerDocument.defaultView.focus();return reviewSelect(view,element);`);
  assert.equal(popCapture.path, 'Complex.md'); assert.equal(popCapture.text, 'Ordinary final paragraph.');
  await evaluate(`const view=popReview.view,doc=view.contentEl.ownerDocument,element=[...view.contentEl.querySelectorAll('.el-p p')].find(e=>e.textContent==='Ordinary final paragraph.'),r=element.getBoundingClientRect();element.dispatchEvent(new doc.defaultView.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.x+20,clientY:r.y+10}));await settle();`);
  const popMenu = await evaluate(`const doc=popReview.view.contentEl.ownerDocument;const items=[...doc.querySelectorAll('.menu-item-title')].filter(e=>e.textContent==='Annotate');const count=items.length;items[0]?.click();await settle();return {count,extract:doc.querySelector('.modal blockquote')?.textContent,focus:doc.activeElement?.className};`);
  assert.deepEqual(popMenu, { count: 1, extract: 'Ordinary final paragraph.', focus: 'mwc-annotation-body' });
  await evaluate(`const doc=popReview.view.contentEl.ownerDocument;doc.querySelector('.modal textarea').value='Popout original note.';[...doc.querySelectorAll('.modal button')].find(e=>e.textContent==='Save annotation').click();await settle();`);
  assert.equal(await evaluate(`return p.storeService.getPage(complexFile).annotations.length;`), 3);
  // Command path, source association, and navigation all stay in the popout's Reading view.
  await evaluate(`const view=popReview.view;app.workspace.setActiveLeaf(popReview,{focus:true});reviewSelect(view,[...view.contentEl.querySelectorAll('.el-p p')].find(e=>e.textContent==='Ordinary final paragraph.'));app.commands.executeCommandById('${pluginId}:annotate');await settle();`);
  assert.equal(await evaluate(`return popReview.view.contentEl.ownerDocument.querySelector('.modal blockquote')?.textContent;`), 'Ordinary final paragraph.');
  await evaluate(`const doc=popReview.view.contentEl.ownerDocument;[...doc.querySelectorAll('.modal button')].find(e=>e.textContent==='Cancel').click();app.workspace.setActiveLeaf(popReview,{focus:true});await p.navigateToAnnotation(complexFile,p.storeService.getPage(complexFile).annotations.at(-1));await settle();`);
  const popNavigation = await evaluate(`return {mode:popReview.view.getMode(),file:popReview.view.file.path,selection:popReview.view.contentEl.ownerDocument.getSelection()?.toString()};`);
  assert.deepEqual(popNavigation, { mode: 'preview', file: 'Complex.md', selection: 'Ordinary final paragraph.' });
  result.popout = { capture: popCapture, menu: popMenu, navigation: popNavigation };
  const integrity = await evaluate(`return {complex:(await app.vault.read(complexFile)).replace(/^mwc_open_annotations:.*\\n/m,''),same:(await app.vault.read(sameFile)).replace(/^mwc_open_annotations:.*\\n/m,'')};`);
  // Obsidian adds frontmatter only for the established derived count projection.
  const withoutEmptyFrontmatter = text => text.replace(/^---\n---\n/, '');
  assert.equal(withoutEmptyFrontmatter(integrity.complex), complexSource);
  assert.equal(withoutEmptyFrontmatter(integrity.same), 'same same\n\nTail.\n\nEdited elsewhere.\n');
  result.integrity = { exactExceptDerivedCount: true };
  const cleanup = await evaluate(`const doc=popReview.view.contentEl.ownerDocument;doc.defaultView.close();await new Promise(r=>setTimeout(r,400));return {retained:p.readingSession.documents.has(doc),cachedClosedDocument:p.readingSession.get()?.document===doc};`);
  assert.equal(cleanup.retained, false); assert.equal(cleanup.cachedClosedDocument, false); result.popoutCleanup = cleanup;
  await pause(100);
  return result;
}
