export type NoteStatus = "open" | "resolved";

export interface EditorialNote {
  id: string;
  body: string;
  category: string;
  status: NoteStatus;
  created: string;
  updated: string;
  [key: string]: unknown;
}

export interface ChapterNote {
  body: string;
  created: string;
  updated: string;
  [key: string]: unknown;
}

export interface AnnotationAnchor {
  text: string;
  line?: number;
  [key: string]: unknown;
}

export interface Annotation extends EditorialNote {
  anchor: AnnotationAnchor;
}

export interface PageEditorialNotes {
  chapterNote: ChapterNote;
  annotations: Annotation[];
  editorialPassHistory?: unknown[];
  editorialPassFrontier?: unknown;
  bookReviewMode?: unknown;
  deletedAt?: string;
  documentNotes?: EditorialNote[];
  [key: string]: unknown;
}

export interface OrphanedEditorialPage {
  originalPath: string;
  deletedAt: string;
  page: PageEditorialNotes;
  [key: string]: unknown;
}

export interface EditorialStore {
  pages: Record<string, PageEditorialNotes>;
  orphanedPages?: Record<string, OrphanedEditorialPage>;
  [key: string]: unknown;
}
