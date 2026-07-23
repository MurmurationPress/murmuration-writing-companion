export interface ContinuityReviewActionPresentation {
  readonly label: string;
  readonly disabled: boolean;
  readonly tooltip: string;
}

export interface ContinuityReviewEntryPointHost {
  activateContinuityReviewForBook(bookPath: string, contextPath: string): Promise<void>;
}

export function openContinuityReviewFromEntryPoint(
  host: ContinuityReviewEntryPointHost,
  bookPath: string,
  contextPath: string
): Promise<void> {
  return host.activateContinuityReviewForBook(bookPath, contextPath);
}

export function continuityReviewActionPresentation(
  safeBookSelected: boolean,
  activeCount: number | null,
  prefix = "Continuity Review"
): ContinuityReviewActionPresentation {
  if (!safeBookSelected) {
    return {
      label: prefix,
      disabled: true,
      tooltip: "Continuity Review requires a selected book with safe authoritative manuscript order."
    };
  }
  const count = activeCount !== null && activeCount > 0 ? ` · ${activeCount}` : "";
  return {
    label: `${prefix}${count}`,
    disabled: false,
    tooltip: activeCount === null
      ? "Open Continuity Review for the selected manuscript book"
      : `Open Continuity Review for the selected manuscript book${activeCount > 0 ? ` with ${activeCount} active findings` : ""}`
  };
}
