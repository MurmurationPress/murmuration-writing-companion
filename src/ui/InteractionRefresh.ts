/** Keep native input targets alive until their gesture completes. Saves are never
 * queued here: only disposable view rendering is coalesced. No events are replayed.
 */
export class InteractionRefresh {
  private readonly pending = new Map<object | string, () => void>();
  private readonly documents = new Map<Document, () => void>();
  private readonly presses = new Set<string>();
  private frame: { win: Window; id: number } | null = null;
  private disposed = false;
  private nextDocument = 0;

  constructor(private readonly reportError: (error: unknown) => void = error => console.error("MWC view refresh failed", error)) {}

  observe(doc: Document): void {
    if (this.disposed || this.documents.has(doc)) return;
    const win = doc.defaultView;
    if (!win) return;
    const prefix = `${this.nextDocument++}:`;
    const removers: (() => void)[] = [];
    const listen = (target: EventTarget, name: string, callback: (event: any) => void) => {
      target.addEventListener(name, callback, true);
      removers.push(() => target.removeEventListener(name, callback, true));
    };
    // Observe at capture, before the browser blurs the editor on pointer-down.
    listen(doc, "pointerdown", (e: PointerEvent) => this.presses.add(`${prefix}p${e.pointerId}`));
    const release = (e: PointerEvent) => {
      this.presses.delete(`${prefix}p${e.pointerId}`);
      // The frame runs after native pointer-up/click dispatch, including when
      // no click is generated (drag, cancellation or release outside a button).
      this.schedule(win);
    };
    listen(doc, "pointerup", release);
    listen(doc, "pointercancel", release);
    listen(doc, "keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") this.presses.add(`${prefix}k${e.key}`);
    });
    listen(doc, "keyup", (e: KeyboardEvent) => {
      this.presses.delete(`${prefix}k${e.key}`);
      this.schedule(win);
    });
    listen(doc, "compositionstart", () => this.presses.add(`${prefix}composition`));
    listen(doc, "compositionend", () => { this.presses.delete(`${prefix}composition`); this.schedule(win); });
    listen(doc, "focusout", () => this.schedule(win));
    const cancel = () => {
      for (const press of this.presses) if (press.startsWith(prefix)) this.presses.delete(press);
      this.schedule(win);
    };
    listen(win, "blur", (event: Event) => { if (event.target === win) cancel(); });
    listen(win, "pagehide", () => {
      if (this.frame?.win === win) { win.cancelAnimationFrame(this.frame.id); this.frame = null; }
      for (const press of this.presses) if (press.startsWith(prefix)) this.presses.delete(press);
      this.documents.get(doc)?.();
      this.documents.delete(doc);
      const remaining = this.documents.keys().next().value?.defaultView;
      if (remaining) this.schedule(remaining);
    });
    this.documents.set(doc, () => removers.forEach(remove => remove()));
  }

  request(key: object | string, render: () => void): void {
    if (this.disposed) return;
    if (this.blocked() || this.frame) { this.pending.set(key, render); return; }
    this.pending.delete(key);
    this.render(render);
  }

  private blocked(): boolean {
    if (this.presses.size) return true;
    // Do not dismantle a dirty Chapter Context editor (or its IME session).
    // Blur commits it immediately, then the pending view reads fresh authority.
    for (const doc of this.documents.keys()) {
      const editor = doc.activeElement as HTMLInputElement | null;
      if (!editor?.matches("input.mwc-context-input, textarea.mwc-context-input")) continue;
      if (editor.matches(".mwc-pov-input, .mwc-location-input")
        ? editor.getAttribute("data-mwc-editing") !== "false"
        : editor.value !== editor.defaultValue) return true;
    }
    return false;
  }

  private schedule(win: Window): void {
    if (this.disposed || this.frame) return;
    this.frame = { win, id: win.requestAnimationFrame(() => {
      this.frame = null;
      if (this.blocked()) return;
      const renders = [...this.pending.values()];
      this.pending.clear();
      for (const render of renders) {
        try { this.render(render); }
        catch (error) { this.reportError(error); }
      }
    }) };
  }

  private render(render: () => void): void {
    const focused = [...this.documents.keys()].map(doc => {
      const element = doc.activeElement as HTMLElement | null;
      const key = element?.getAttribute("data-mwc-focus-key");
      const root = element?.closest("[data-mwc-context]");
      return { doc, element, key, root, context: root?.getAttribute("data-mwc-context") };
    });
    render();
    for (const { doc, element, key, root, context } of focused) {
      if (!key || !root?.isConnected || element?.isConnected || doc.activeElement !== doc.body ||
        root.getAttribute("data-mwc-context") !== context) continue;
      // Explicit identity, scoped to the same scene/book and pane. Never focus
      // a similarly labelled control in another scene or steal deliberate focus.
      const target = Array.from(root.querySelectorAll<HTMLElement>("[data-mwc-focus-key]"))
        .find(candidate => candidate.getAttribute("data-mwc-focus-key") === key);
      target?.focus({ preventScroll: true });
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.frame) this.frame.win.cancelAnimationFrame(this.frame.id);
    this.frame = null;
    for (const remove of this.documents.values()) remove();
    this.documents.clear(); this.presses.clear(); this.pending.clear();
  }
}
