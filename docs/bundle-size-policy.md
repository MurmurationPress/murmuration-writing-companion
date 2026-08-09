# Production bundle size policy

Issue #199 established a minified installed `main.js` baseline of 612,890 bytes on 9 August 2026 (the preceding unminified build was 1,068,767 bytes). The release budget is 720,896 bytes (704 KiB), leaving roughly 18% headroom for normal product growth while still failing a substantial accidental dependency or debug-code regression.

The budget applies to the actual installed file, not gzip size: Obsidian loads `main.js` directly. `npm run bundle:analyze` reports both installed and informational gzip sizes plus esbuild's deterministic source-contribution analysis. Metadata stays in memory and is not written into release assets.

Raise the budget only as an intentional, reviewed change accompanied by a new measured baseline and explanation.
