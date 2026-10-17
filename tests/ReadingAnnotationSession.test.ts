import { equal, deepEqual } from "node:assert/strict";
import { test } from "node:test";
import { ReadingAnnotationSession } from "../src/companion/ReadingAnnotationSession";
import type { ReadingAnnotationCapture } from "../src/companion/ReadingAnnotationCapture";

function documentFixture(path: string) {
  const listeners = new Map<string, Set<(event: any) => void>>();
  const root = { isConnected: true, contains: (node: unknown) => node === root };
  const selection = { isCollapsed: false, rangeCount: 1, toString: () => selection.isCollapsed ? "" : "prose",
    getRangeAt: () => ({ commonAncestorContainer: root }) };
  const document = { body: {}, activeElement: {} as unknown,
    getSelection: () => selection,
    addEventListener: (name: string, callback: any) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name)!.add(callback); },
    removeEventListener: (name: string, callback: any) => { listeners.get(name)?.delete(callback); }
  };
  document.activeElement = document.body;
  return { document: document as unknown as Document, focus: document, root: root as unknown as HTMLElement,
    selection, file: { path }, listenerCount: () => [...listeners.values()].reduce((n, set) => n + set.size, 0),
    emit: (name: string, target: unknown = root) => listeners.get(name)?.forEach(callback => callback({ target })) };
}

function sessionFixture() {
  const main = documentFixture("Main.md"), popout = documentFixture("Popout.md");
  const menus: string[] = [];
  const capture = { capture: (_: unknown, path: string) => ({ path, source: "prose", from: 0, to: 5 }) } as unknown as ReadingAnnotationCapture;
  const session = new ReadingAnnotationSession(capture, document => [main, popout].filter(f => f.document === document).map(({ file, root }) => ({ file, root })),
    (_, captured) => { menus.push(captured.file.path); });
  session.observe(main.document); session.observe(popout.document);
  return { main, popout, session, menus };
}

test("two retained window selections use the originating event and never scan the other document", () => {
  const { main, popout, session, menus } = sessionFixture();
  main.emit("selectionchange"); equal(session.get()?.file, main.file);
  popout.emit("selectionchange"); equal(session.get()?.file, popout.file);
  popout.emit("contextmenu");
  deepEqual(menus, ["Popout.md"]); equal(session.get()?.file, popout.file);
  session.dispose();
});

test("explicit manuscript deselection clears cached text; palette/Companion focus preserves original note", () => {
  const { main, session } = sessionFixture();
  main.emit("selectionchange");
  main.focus.activeElement = {}; main.selection.isCollapsed = true;
  main.emit("selectionchange"); equal(session.get()?.file, main.file);
  main.emit("pointerup"); equal(session.get(), null);
  main.selection.isCollapsed = false; main.emit("selectionchange");
  main.focus.activeElement = main.focus.body; main.selection.isCollapsed = true;
  main.emit("selectionchange"); equal(session.get(), null);
  session.dispose();
});

test("window close and plugin unload remove each listener once and discard captured selections", () => {
  const { main, popout, session } = sessionFixture();
  session.observe(main.document); equal(main.listenerCount(), 5);
  main.emit("selectionchange"); session.forget(main.document);
  equal(main.listenerCount(), 0); equal(session.get(), null);
  main.emit("selectionchange"); equal(session.get(), null);
  popout.emit("selectionchange"); equal(session.get()?.file, popout.file);
  session.dispose(); equal(popout.listenerCount(), 0); equal(session.get(), null);
});

test("a detached originating surface cannot leave a reusable cached selection", () => {
  const { main, session } = sessionFixture();
  main.emit("selectionchange"); equal(session.get()?.file, main.file);
  (main.root as any).isConnected = false;
  equal(session.get(), null);
  session.dispose();
});
