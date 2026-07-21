import { cloneEventTimeValue, eventTimeValuesEqual, SupportedEventTime, serialiseEventTime } from "./EventTimeEditing";

export interface EventTimeDocumentState { readonly revision: string; readonly text: string; readonly frontmatter: Record<string, unknown>; }
export interface EventTimeWriteHost {
  readCurrent(): Promise<EventTimeDocumentState>;
  readAuthoritative(): Promise<EventTimeDocumentState>;
  processFrontmatter(change: (frontmatter: Record<string, unknown>) => void): Promise<void>;
  restore(text: string): Promise<void>;
}
export type EventTimeMutation = { readonly kind: "set"; readonly value: SupportedEventTime } | { readonly kind: "clear" };

export class StaleEventTimeWriteError extends Error {
  constructor() { super("The event note changed after time editing began. Review the newer Markdown and try again."); this.name = "StaleEventTimeWriteError"; }
}
export class EventTimeVerificationError extends Error {
  constructor() { super("The saved event time could not be verified. This operation was rolled back when it was safe to do so."); this.name = "EventTimeVerificationError"; }
}

export function eventTimeProperty(frontmatter: Record<string, unknown>): string {
  return Object.keys(frontmatter).find((key) => key.toLowerCase() === "world_time") ?? "world_time";
}
function withoutTime(frontmatter: Record<string, unknown>): Record<string, unknown> {
  const copy = cloneEventTimeValue(frontmatter);
  delete copy[eventTimeProperty(copy)];
  return copy;
}
function nextFrontmatter(current: Record<string, unknown>, mutation: EventTimeMutation): Record<string, unknown> {
  const next = cloneEventTimeValue(current);
  const key = eventTimeProperty(next);
  if (mutation.kind === "clear") delete next[key];
  else next[key] = serialiseEventTime(mutation.value);
  return next;
}
function replaceRecord(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(target)) if (key !== "position") delete target[key];
  for (const [key, value] of Object.entries(source)) target[key] = cloneEventTimeValue(value);
}

export async function writeEventTimeMutation(host: EventTimeWriteHost, expected: EventTimeDocumentState, mutation: EventTimeMutation): Promise<EventTimeDocumentState> {
  const current = await host.readCurrent();
  if (current.revision !== expected.revision || !eventTimeValuesEqual(current.frontmatter, expected.frontmatter)) throw new StaleEventTimeWriteError();
  if (typeof current.frontmatter.world_entity !== "string" || current.frontmatter.world_entity.trim().toLowerCase() !== "event") throw new Error("The note is no longer an authoritative Story World event.");
  const next = nextFrontmatter(current.frontmatter, mutation);
  await host.processFrontmatter((frontmatter) => {
    if (!eventTimeValuesEqual(frontmatter, current.frontmatter)) throw new StaleEventTimeWriteError();
    replaceRecord(frontmatter, next);
  });
  const written = await host.readAuthoritative();
  if (eventTimeValuesEqual(written.frontmatter, next)) return written;
  const latest = await host.readAuthoritative();
  if (eventTimeValuesEqual(withoutTime(written.frontmatter), withoutTime(current.frontmatter)) && latest.revision === written.revision) await host.restore(current.text);
  throw new EventTimeVerificationError();
}
