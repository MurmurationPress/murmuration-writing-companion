export type NoteStatus = "open" | "resolved";

export interface EditorialNote {
  id: string;
  body: string;
  category: string;
  status: NoteStatus;
  created: string;
  updated: string;
}

export interface AnchoredEditorialNote extends EditorialNote {
  anchorText: string;
  line?: number;
}

export interface PageEditorialNotes {
  documentNotes: EditorialNote[];
  anchoredNotes: AnchoredEditorialNote[];
}

export interface EditorialStore {
  pages: Record<string, PageEditorialNotes>;
}
