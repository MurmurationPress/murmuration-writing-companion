export type NoteStatus = "open" | "resolved";

export interface EditorialNote {
  id: string;
  body: string;
  category: string;
  status: NoteStatus;
  created: string;
  updated: string;
}

export interface ChapterNote {
  body: string;
  created: string;
  updated: string;
}

export interface AnnotationAnchor {
  text: string;
  line?: number;
}

export interface Annotation extends EditorialNote {
  anchor: AnnotationAnchor;
}

export interface PageEditorialNotes {
  chapterNote: ChapterNote;
  annotations: Annotation[];

  /** Retained only so early development data is not discarded during migration. */
  documentNotes?: EditorialNote[];
}

export interface EditorialStore {
  pages: Record<string, PageEditorialNotes>;
}
