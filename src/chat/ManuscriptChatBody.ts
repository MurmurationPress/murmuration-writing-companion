const IMAGE_EXTENSIONS = new Set(["avif", "bmp", "gif", "jpeg", "jpg", "png", "svg", "webp"]);

function visibleCode(source: string): string {
  const fence = source.includes("`") ? "``" : "`";
  return `${fence}${source}${fence}`;
}

function imageLinkpath(inner: string): string | null {
  const target = inner.split("|", 1)[0].split("#", 1)[0].trim();
  const extension = target.split(".").pop()?.toLowerCase() ?? "";
  return target && IMAGE_EXTENSIONS.has(extension) ? target : null;
}

function neutraliseFencedBlocks(markdown: string): string {
  const lines = markdown.split("\n");
  let fence: { character: string; length: number } | null = null;
  return lines.map((line) => {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (!fence && marker) {
      fence = { character: marker[1][0], length: marker[1].length };
      return `    ${line}`;
    }
    if (!fence) return line;
    const visible = `    ${line}`;
    if (marker && marker[1][0] === fence.character && marker[1].length >= fence.length) fence = null;
    return visible;
  }).join("\n");
}

/** Restricts body rendering to the #167 contract without changing authored source. */
export function manuscriptChatBodyMarkdown(
  body: string,
  imageExists: (linkpath: string) => boolean = () => true
): string {
  const safeEmbeds = body
    .replace(/!\[\[([^\]\n]+)\]\]/g, (source, inner: string) => {
      const linkpath = imageLinkpath(inner);
      return linkpath && imageExists(linkpath) ? source : visibleCode(source);
    })
    .replace(/!\[([^\]\n]*)\]\(([^)\n]*)\)/g, (source) => visibleCode(source))
    .replace(/<\/?(?:img|audio|video|iframe|object|embed)\b[^>]*>/gi, (source) => visibleCode(source));
  return neutraliseFencedBlocks(safeEmbeds);
}
