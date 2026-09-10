import { readFile } from "node:fs/promises";
import ts from "typescript";
import { transform } from "esbuild";

/** Opt-in CSS whitespace minification; authored TypeScript/CSS remains readable. */
export async function minifyEmbeddedCss(source, filename) {
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const literals = [];
  function visit(node) {
    if ((ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node))
      && /\/\*\s*css\s*\*\/\s*$/.test(source.slice(node.getFullStart(), node.getStart(ast)))) {
      if (!ts.isNoSubstitutionTemplateLiteral(node)) throw new Error(`${filename}: embedded CSS must not contain interpolation`);
      literals.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  // Reverse edits retain AST offsets. Only whitespace is minified, not CSS syntax or identifiers.
  for (const literal of literals.reverse()) {
    const result = await transform(literal.text, { loader: "css", minifyWhitespace: true });
    if (result.warnings.length) throw new Error(`${filename}: ${result.warnings.map(warning => warning.text).join("; ")}`);
    source = source.slice(0, literal.getStart(ast)) + JSON.stringify(result.code.trimEnd()) + source.slice(literal.end);
  }
  return source;
}

export function embeddedCssPlugin() {
  return { name: "embedded-css-whitespace", setup(builder) {
    builder.onLoad({ filter: /Styles\.ts$/ }, async args => ({
      contents: await minifyEmbeddedCss(await readFile(args.path, "utf8"), args.path), loader: "ts"
    }));
  } };
}
