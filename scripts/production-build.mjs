import { embeddedCssPlugin } from "./minify-embedded-css.mjs";

/** Shared by production builds, composition reports and build regression tests. */
export function productionBuildOptions() {
  return {
    entryPoints: ["src/entry.ts"], bundle: true, external: ["obsidian", "node:*"],
    format: "cjs", target: "es2018", outfile: "main.js", minify: true,
    plugins: [embeddedCssPlugin()]
  };
}
