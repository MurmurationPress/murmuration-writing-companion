import type { Annotation } from "./EditorialNote";

/** An immutable check of what the author saw, including additive anchor evidence. */
export function annotationRevision(annotation: Annotation): string { return JSON.stringify(annotation); }

export class AnnotationCountError extends Error {
  constructor() { super("Annotation saved, but its chapter count could not be updated. Retry the count update."); }
}
