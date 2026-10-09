import { gzipSync } from "node:zlib";

export const BUNDLE_HARD_LIMIT = 720_896;
export const BUNDLE_WARNING_THRESHOLD = 669_696;

export function bundleReport(bundle) {
  const bytes = Buffer.from(bundle);
  return {
    rawBytes: bytes.length,
    gzipBytes: gzipSync(bytes).length,
    warningThreshold: BUNDLE_WARNING_THRESHOLD,
    hardLimit: BUNDLE_HARD_LIMIT,
    remainingHeadroom: BUNDLE_HARD_LIMIT - bytes.length,
    status: bytes.length > BUNDLE_HARD_LIMIT ? "fail" : bytes.length > BUNDLE_WARNING_THRESHOLD ? "warning" : "ok"
  };
}

export function printBundleReport(report) {
  console.log(`Production bundle: ${report.rawBytes} raw bytes; ${report.gzipBytes} gzip bytes; warning above ${report.warningThreshold}; hard ceiling ${report.hardLimit}; remaining headroom ${report.remainingHeadroom} bytes.`);
  if (report.status === "warning") console.warn("Bundle headroom warning: less than 50 KiB remains below the hard ceiling.");
}

export function enforceBundleBudget(report) {
  if (report.status === "fail") throw new Error(`main.js exceeds the ${report.hardLimit}-byte production bundle budget (${report.rawBytes} bytes)`);
}
