export type NoteStatus = "open" | "resolved";

export interface EditorialNote {
  id: string;
  body: string;
  category: string;
  status: NoteStatus;
  created: string;
  updated: string;
}

export interface ChapterNote extends EditorialNote {}

export interface AnnotationAnchor {
  text: string;
  line?: number;
}

export interface Annotation extends EditorialNote {
  anchor: AnnotationAnchor;
}

export interface PageEditorialNotes {
  documentNotes: ChapterNote[];
  annotations: Annotation[];
}

export interface EditorialStore {
  pages: Record<string, PageEditorialNotes>;
}
