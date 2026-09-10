# Production bundle size policy

Issue #199 established a minified installed `main.js` baseline of 612,890 bytes on 9 August 2026 (the preceding unminified build was 1,068,767 bytes). The release budget is 720,896 bytes (704 KiB), leaving roughly 18% headroom for normal product growth while still failing a substantial accidental dependency or debug-code regression.

The budget applies to the actual installed file, not gzip size: Obsidian loads `main.js` directly. `npm run bundle:analyze` reports both installed and informational gzip sizes plus esbuild's deterministic source-contribution analysis. Metadata stays in memory and is not written into release assets.

Raise the budget only as an intentional, reviewed change accompanied by a new measured baseline and explanation.


## Early warning and measurement

Production build and `release:check` now report raw bytes, informational gzip bytes, the 669,696-byte warning threshold, the unchanged 720,896-byte hard ceiling, and remaining headroom. Above 669,696 bytes warns that less than 50 KiB remains; above 720,896 bytes fails. Warnings do not fail the build, including while the maintenance target remains outstanding.

`npm run bundle:report` prints a reproducible JSON composition report without writing build assets. `npm run benchmark:performance` prints deterministic synthetic operation counts plus informational timings; CI tests counts, never machine-dependent duration thresholds. See [the #252 measurements and remaining work](performance-252.md).

Embedded CSS literals explicitly marked `/* css */` are whitespace-minified with esbuild's CSS parser during production builds. CSS syntax/identifiers and runtime injection order are preserved; development source/builds remain readable. Required styles stay inside main.js and count against the installed-byte budget.
