import { preparationHarness, File } from "./ManuscriptPreparationHarness";

export function numberingHarness() {
  const h = preparationHarness();
  h.loaded.clear(); h.contents.clear(); h.cache.clear();
  const add = (path: string, type: string, parent?: string, key?: string) => h.add(path, {
    type, ...(parent ? { parent: `[[${parent}]]` } : {}), ...(key ? { manuscript_order_key: key } : {}),
    custom: { retained: true }, manuscript_series_number: "authored alias"
  }, "\nUnchanged synthetic prose.\n");
  add("Alpha.md", "book"); add("Beta.md", "book");
  add("Prologue.md", "scene", "Alpha", "A000000000");
  add("Part.md", "part", "Alpha", "B000000000");
  add("First.md", "scene", "Part", "A000000000");
  add("Last.md", "scene", "Alpha", "C000000000");
  add("Other.md", "scene", "Beta", "A000000000");
  add(".trash/Discard.md", "scene", "Alpha", "D000000000");
  let library = h.api.buildObsidianManuscriptLibrary(h.app);
  const settle = () => { library = h.api.buildObsidianManuscriptLibrary(h.app); };
  const book = (path = "Alpha.md") => library.books.find((b: any) => b.file.path === path);
  const service = new h.api.ManuscriptSequencePropertyService(h.app);
  const options = (path = "Alpha.md") => ({ currentBook: () => book(path), whenSettled: async () => {} });
  const renumber = (path = "Alpha.md", extra = {}) => service.renumber(path, { ...options(path), ...extra });
  const edit = async (path: string, change: (fm: any) => void) => {
    await h.app.fileManager.processFrontMatter(h.loaded.get(path) as File, change); settle();
  };
  return { ...h, service, book, options, renumber, settle, edit, library: () => library };
}
