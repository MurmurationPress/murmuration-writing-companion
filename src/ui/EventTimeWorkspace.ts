import { Notice, TFile } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import { EventTimeEndpoint, EventTimePrecision, parseEventTime, projectEventTime, SupportedEventTime } from "../story-world/EventTimeEditing";
import { eventTimeProperty } from "../story-world/EventTimeWriting";
import { readEventTimeDocument, writeObsidianEventTime } from "../story-world/ObsidianEventTimeWriting";

function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function blankEndpoint(): EventTimeEndpoint { return { date: "", time: "", offset: "" }; }

interface EndpointControls { readonly row: HTMLElement; readonly date: HTMLInputElement; readonly time: HTMLInputElement; readonly offset: HTMLInputElement; }
function endpointControls(container: Element, label: string): EndpointControls {
  const row = container.createDiv("mwc-event-time-endpoint");
  row.createEl("strong", { text: label });
  const date = row.createEl("input");
  const time = row.createEl("input", { type: "time" }); time.step = "60";
  const offset = row.createEl("input", { type: "text", attr: { placeholder: "Offset, e.g. +01:00 or Z" } });
  return { row, date, time, offset };
}
function populate(control: EndpointControls, value: EventTimeEndpoint): void { control.date.value = value.date; control.time.value = value.time; control.offset.value = value.offset; }

function renderForm(host: Element, plugin: MurmurationWritingCompanionPlugin, file: TFile, snapshot: Awaited<ReturnType<typeof readEventTimeDocument>>, initial: SupportedEventTime | null): void {
  host.empty();
  const form = host.createDiv("mwc-event-time-form");
  form.createEl("h4", { text: "Edit event time" });
  const controls = form.createDiv("mwc-event-time-controls");
  const modeLabel = controls.createEl("label"); modeLabel.createSpan({ text: "Shape" });
  const mode = modeLabel.createEl("select"); mode.createEl("option", { value: "point", text: "Point" }); mode.createEl("option", { value: "range", text: "Range" });
  const precisionLabel = controls.createEl("label"); precisionLabel.createSpan({ text: "Precision" });
  const precision = precisionLabel.createEl("select");
  for (const value of ["year", "month", "day", "hour", "minute"] as const) precision.createEl("option", { value, text: value[0].toUpperCase() + value.slice(1) });
  const from = endpointControls(controls, "Date");
  const to = endpointControls(controls, "End");
  mode.value = initial?.mode ?? "point"; precision.value = initial?.precision ?? "day";
  populate(from, initial?.from ?? blankEndpoint()); populate(to, initial?.to ?? blankEndpoint());
  const validation = form.createEl("p", { cls: "mwc-event-time-error" });
  const preview = form.createEl("p", { cls: "mwc-event-time-preview" });
  const save = form.createEl("button", { cls: "mod-cta", text: "Confirm event time", attr: { type: "button" } });
  const clear = form.createEl("button", { text: "Set as undated", attr: { type: "button" } });
  const cancel = form.createEl("button", { text: "Cancel", attr: { type: "button" } });

  const readEndpoint = (control: EndpointControls): EventTimeEndpoint => ({ date: control.date.value, time: control.time.value, offset: control.offset.value.trim() });
  const draft = (): SupportedEventTime | null => {
    const selected = precision.value as EventTimePrecision;
    const first = readEndpoint(from); const last = readEndpoint(to);
    const datePattern = selected === "year" ? /^\d{4}$/ : selected === "month" ? /^\d{4}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/;
    const timed = selected === "hour" || selected === "minute";
    const endpointValid = (value: EventTimeEndpoint) => datePattern.test(value.date) && (!timed || (/^\d{2}:\d{2}$/.test(value.time) && /^(?:Z|[+-]\d{2}:\d{2})?$/.test(value.offset)));
    if (!endpointValid(first) || (mode.value === "range" && !endpointValid(last))) return null;
    return { mode: mode.value as "point" | "range", precision: selected, from: first, to: mode.value === "range" ? last : null };
  };
  const update = () => {
    const selected = precision.value as EventTimePrecision;
    const type = selected === "year" ? "number" : selected === "month" ? "month" : "date";
    const timed = selected === "hour" || selected === "minute";
    for (const endpoint of [from, to]) { endpoint.date.type = type; endpoint.date.placeholder = selected === "year" ? "YYYY" : ""; endpoint.time.hidden = !timed; endpoint.offset.hidden = !timed; endpoint.time.step = selected === "hour" ? "3600" : "60"; }
    to.row.hidden = mode.value !== "range";
    from.row.querySelector("strong")!.textContent = mode.value === "range" ? "Start" : "Date";
    const value = draft(); save.disabled = !value;
    validation.setText(value ? "" : "Enter every required date and time exactly; offsets are optional and are never inferred."); validation.hidden = !!value;
    preview.setText(value ? `${value.mode === "range" ? "Start and end: " : "Time: "}${projectEventTime(value)} · Precision: ${value.precision}` : "Complete the time to preview it before writing.");
  };
  for (const input of [mode, precision, from.date, from.time, from.offset, to.date, to.time, to.offset]) { input.addEventListener("input", update); input.addEventListener("change", update); }
  cancel.onclick = () => host.empty();
  clear.onclick = () => {
    if (!confirm("Remove world_time and mark this event as explicitly undated?")) return;
    clear.disabled = true;
    void writeObsidianEventTime(plugin.app, file, snapshot, { kind: "clear" }).then(() => { plugin.storyWorldIndex.rebuild(); plugin.refreshView(); new Notice("Event is now undated."); }).catch((error) => { new Notice(`Could not clear event time: ${message(error)}`); clear.disabled = false; });
  };
  save.onclick = () => {
    const value = draft(); if (!value) return; save.disabled = true;
    void writeObsidianEventTime(plugin.app, file, snapshot, { kind: "set", value }).then(() => { plugin.storyWorldIndex.rebuild(); plugin.refreshView(); new Notice("Event time updated."); }).catch((error) => { new Notice(`Could not save event time: ${message(error)}`); save.disabled = false; });
  };
  update();
}

export async function beginEventTimeEditing(host: Element, plugin: MurmurationWritingCompanionPlugin, file: TFile, replacing = false): Promise<void> {
  try {
    const snapshot = await readEventTimeDocument(plugin.app, file);
    const state = parseEventTime(snapshot.frontmatter[eventTimeProperty(snapshot.frontmatter)]);
    if (state.kind === "unsupported" && !replacing) {
      host.empty(); const warning = host.createDiv("mwc-event-time-preserved");
      warning.createEl("p", { text: `${state.summary}. It will remain unchanged.` });
      warning.createEl("button", { text: "Replace with supported exact time" }).onclick = () => renderForm(host, plugin, file, snapshot, null);
      const clear = warning.createEl("button", { text: "Set as undated" });
      clear.onclick = () => {
        if (!confirm("Remove the preserved world_time and mark this event as explicitly undated?")) return;
        clear.disabled = true;
        void writeObsidianEventTime(plugin.app, file, snapshot, { kind: "clear" }).then(() => { plugin.storyWorldIndex.rebuild(); plugin.refreshView(); new Notice("Event is now undated."); }).catch((error) => { new Notice(`Could not clear event time: ${message(error)}`); clear.disabled = false; });
      };
      warning.createEl("button", { text: "Cancel" }).onclick = () => host.empty();
      return;
    }
    renderForm(host, plugin, file, snapshot, state.kind === "supported" ? state.value : null);
  } catch (error) { new Notice(`Could not begin event-time editing: ${message(error)}`); }
}

export function renderEventTimeWorkspace(container: Element, plugin: MurmurationWritingCompanionPlugin, file: TFile, value: unknown): void {
  const state = parseEventTime(value);
  const section = container.createDiv("mwc-section mwc-event-time");
  const heading = section.createDiv("mwc-event-time-heading"); heading.createEl("h3", { text: "World time" });
  heading.createEl("button", { text: "Edit event time" }).onclick = () => void beginEventTimeEditing(editor, plugin, file, false);
  if (state.kind === "supported") section.createEl("p", { text: projectEventTime(state.value) });
  else if (state.kind === "undated") section.createEl("p", { cls: "mwc-event-time-muted", text: "Undated" });
  else section.createEl("p", { cls: "mwc-event-time-muted", text: state.summary });
  if (state.kind === "supported") section.createEl("p", { cls: "mwc-event-time-precision", text: `Precision: ${state.value.precision}${state.value.mode === "range" ? " · Range" : " · Point"}` });
  const editor = section.createDiv("mwc-event-time-editor");
}
