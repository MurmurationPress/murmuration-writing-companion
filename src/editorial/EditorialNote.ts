export type NoteStatus = "open" | "resolved";

export interface EditorialNote {
  id: string;
  body: string;
  category: string;
  status: NoteStatus;
  created: string;
  updated: string;
}

export interface Annotation extends EditorialNote {
  anchorText: string;
  line?: number;
}

export interface PageEditorialNotes {
    documentNotes: EditorialNote[];
    annotations: Annotation[];
}

export interface EditorialStore {
  pages: Record<string, PageEditorialNotes>;
}
