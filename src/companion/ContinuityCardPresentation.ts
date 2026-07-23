import {
  ContinuityObservation,
  ObservationNoteReference,
  observationSourceNotes
} from "../observations/ContinuityObservation";

export interface ManuscriptChronologyCardPresentation {
  readonly navigationNotes: readonly ObservationNoteReference[];
  readonly partContext: readonly string[];
}

export function readableSceneLabel(
  frontmatter: Readonly<Record<string, unknown>> | undefined,
  basename: string
): string {
  const title = frontmatter?.title;
  return typeof title === "string" && title.trim()
    ? title.trim()
    : basename;
}

function noteKey(note: ObservationNoteReference): string {
  return `${note.role}\u0000${note.path}`;
}

function noteLabel(note: ObservationNoteReference): string {
  return note.label?.trim() || note.path.replace(/\.md$/i, "").split("/").pop() || "Note";
}

/** Focused local targets; the complete contract navigation remains unchanged. */
export function chapterContextCardNavigationNotes(
  observation: ContinuityObservation
): ObservationNoteReference[] {
  return observationSourceNotes(observation)
    .filter((note) => note.role === "story_world");
}

/**
 * Book Review presents only scene notes whose dates participate directly in
 * the finding. Book and part evidence remains available to #132 through the
 * unchanged observation contract.
 */
export function manuscriptChronologyCardPresentation(
  observation: ContinuityObservation
): ManuscriptChronologyCardPresentation {
  const scenes = new Map<string, ObservationNoteReference>();
  const partPaths = new Set(
    observation.evidence
      .filter((item) => item.role === "part_parent")
      .map((item) => item.source.note.path)
  );
  const partByScene = new Map<string, ObservationNoteReference>();

  for (const evidence of observation.evidence) {
    if (evidence.role.includes("story_date")) {
      scenes.set(noteKey(evidence.source.note), evidence.source.note);
    }
    if (
      evidence.role === "scene_parent"
      && evidence.value.kind === "resolved_note"
      && partPaths.has(evidence.value.note.path)
    ) {
      partByScene.set(noteKey(evidence.source.note), evidence.value.note);
    }
  }

  const navigationNotes = [...scenes.values()];
  const labels = new Map<string, number>();
  for (const note of navigationNotes) {
    const label = noteLabel(note);
    labels.set(label, (labels.get(label) ?? 0) + 1);
  }
  const crossPart = new Set(
    navigationNotes
      .map((note) => partByScene.get(noteKey(note))?.path)
      .filter((path): path is string => Boolean(path))
  ).size > 1;

  const partContext = navigationNotes.flatMap((note) => {
    const part = partByScene.get(noteKey(note));
    if (!part) return [];
    const duplicateTitle = (labels.get(noteLabel(note)) ?? 0) > 1;
    return duplicateTitle || crossPart
      ? [`${noteLabel(note)} · ${noteLabel(part)}`]
      : [];
  });

  return { navigationNotes, partContext };
}
