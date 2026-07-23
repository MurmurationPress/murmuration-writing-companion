export interface BookReviewContinuityPresentation {
  readonly count: number;
  readonly reviewedCount: number;
  readonly indicator: string;
  readonly bookReviewExpanded: boolean;
  readonly continuityExpanded: boolean;
}

interface BookDisclosureState {
  findingsSeen: boolean;
  bookReviewExpanded: boolean;
  continuityExpanded: boolean;
}

export function bookReviewContinuityIndicator(count: number, reviewedCount = 0): string {
  if (count > 0) return `Continuity ${count}`;
  return reviewedCount > 0 ? `Reviewed ${reviewedCount}` : "";
}

export function bookReviewToggleAriaLabel(
  expanded: boolean,
  indicator: string
): string {
  return `${expanded ? "Collapse" : "Expand"} Book Review${indicator ? ` · ${indicator}` : ""}`;
}

/** Session-local disclosure state. It stores UI choice, never observation state. */
export class BookReviewContinuityDisclosure {
  private readonly byBook = new Map<string, BookDisclosureState>();

  present(
    bookPath: string,
    count: number,
    reviewedCount = 0
  ): BookReviewContinuityPresentation {
    const state = this.state(bookPath);
    if (count > 0 && !state.findingsSeen) {
      state.findingsSeen = true;
      state.bookReviewExpanded = true;
      state.continuityExpanded = true;
    }
    return {
      count,
      reviewedCount,
      indicator: bookReviewContinuityIndicator(count, reviewedCount),
      bookReviewExpanded: state.bookReviewExpanded,
      continuityExpanded: state.continuityExpanded
    };
  }

  setBookReviewExpanded(bookPath: string, expanded: boolean) {
    this.state(bookPath).bookReviewExpanded = expanded;
  }

  setContinuityExpanded(bookPath: string, expanded: boolean) {
    this.state(bookPath).continuityExpanded = expanded;
  }

  private state(bookPath: string): BookDisclosureState {
    let state = this.byBook.get(bookPath);
    if (!state) {
      state = {
        findingsSeen: false,
        bookReviewExpanded: false,
        continuityExpanded: false
      };
      this.byBook.set(bookPath, state);
    }
    return state;
  }
}
