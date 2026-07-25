export class ContinuityReviewReportDestinationExistsError extends Error {
  constructor(readonly path: string) {
    super(`A note already exists at ${path}. Choose another filename.`);
    this.name = "ContinuityReviewReportDestinationExistsError";
  }
}

export interface ContinuityReviewReportVault {
  exists(path: string): boolean;
  create(path: string, markdown: string): Promise<unknown>;
}

export interface ContinuityReviewReportClipboard {
  writeText(markdown: string): Promise<void>;
}

export async function copyContinuityReviewReport(
  clipboard: ContinuityReviewReportClipboard,
  markdown: string
): Promise<void> {
  await clipboard.writeText(markdown);
}

/** Creates one new snapshot note. Existing destinations are never overwritten. */
export async function saveContinuityReviewReport(
  vault: ContinuityReviewReportVault,
  path: string,
  markdown: string
): Promise<unknown> {
  if (vault.exists(path)) throw new ContinuityReviewReportDestinationExistsError(path);
  return vault.create(path, markdown);
}
