# Production bundle size policy

The enforced raw `main.js` ceiling is **720,896 bytes**. The early warning and maintenance target is **669,696 bytes**, leaving at least 51,200 bytes (50 KiB). Production build and `release:check` fail above the ceiling and warn above the target. Gzip remains informational: Obsidian loads the installed files directly.

## Reconciled history

- #199/#201 established a 612,890-byte minified `main.js` baseline (formerly 1,068,767 unminified).
- #252/#253 used 720,896 as the hard limit and 669,696 as the warning threshold.
- #261 raised the ceiling by 16 KiB to 737,280, with a 686,080 warning, to accommodate preparation and restoration safeguards.
- #263 actually measured **734,545 raw / 205,236 gzip**, leaving 2,735 bytes under **737,280**, not 720,896. The later #252 comment inferred 718,161 from the wrong ceiling. That inferred size is not a measured baseline.
- #264 restored the explicitly requested **720,896 / 669,696** policy, measuring 685,795 bytes (**16,099 above target**).
- The subsequent render/startup follow-up measures **682,657 bytes** after the review convergence fix, leaving **38,239 headroom** and a **12,961-byte gap**. The target is not lowered and #252 stays open. See [reviewed measurements](performance-265-review.md).

See [measurements and remaining work](performance-252-follow-up.md) for configuration, composition, individual changes and runtime evidence. Changes to the budget require an explicit decision, not suppression of the warning.

## Packaging and development

Static styles live in readable files under `src/styles/`; `src/styles/plugin.css` declares their order: the former base stylesheet, then the former onload installation order. `npm run build` and `npm run dev` generate Obsidian's native `styles.css` as well as `main.js`. Install/release **main.js, styles.css and manifest.json together**. `release:check` rejects an out-of-date stylesheet. Generated files are not committed.

`npm run bundle:report` reports each installed asset and combined raw/gzip bytes as well as the main.js budget and source composition. No JavaScript is deferred, split, fetched or excluded from that report. Moving CSS out of JavaScript reduces JS parsing and startup style installation; it is not equivalent removal of total shipped content. Native styles follow Obsidian's plugin stylesheet lifecycle, including popout windows and user snippet overrides. Feature selectors and their internal order are preserved. Arbitrary third-party theme/snippet combinations remain a live acceptance concern.

The JavaScript target remains ES2018, CommonJS, with `obsidian` and `node:*` external. Native CSS uses whitespace-only minification; syntax and identifiers are not minified. The earlier embedded-CSS helper remains a build-only facility for reproducing historical source reports; current runtime code contains no style literals. Metadata and instrumentation are never release assets.
