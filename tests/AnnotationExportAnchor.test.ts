import { deepEqual, equal, rejects } from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { createAnnotationExportAnchor } from "../src/editorial/AnnotationExportAnchor";
import { normalizeEditorialStore, serializePortableEditorialStore, parsePortableEditorialStore } from "../src/editorial/PortableEditorialStorage";

test("retains the second same-line occurrence with UTF-16 offsets, whitespace trimming and Unicode hash", async () => {
  const source = "Header\n日本語 🐦 same same  ";
  const from = source.lastIndexOf("same");
  const anchor = await createAnnotationExportAnchor(source, from - 1, source.length);
  deepEqual(anchor, { text: "same", line: 2, range: { from, to: from + 4, sourceSha256: createHash("sha256").update(source).digest("hex"), basis: "markdown-body-v1" } });
  const store = normalizeEditorialStore({ pages: { "Chapter.md": { annotations: [{ id: "a", body: "note", status: "open", anchor }] } } }).value;
  deepEqual(parsePortableEditorialStore(serializePortableEditorialStore(store)).store.pages["Chapter.md"].annotations[0].anchor, anchor);
  equal(source, "Header\n日本語 🐦 same same  ");
});
test("rejects invalid and empty selections", async () => {
  await rejects(createAnnotationExportAnchor("text", -1, 2));
  await rejects(createAnnotationExportAnchor(" ", 0, 1));
});

test("derived annotation-count frontmatter edits do not invalidate the body snapshot", async () => {
  const original = "---\ntitle: Test\n---\nsame same";
  const first = await createAnnotationExportAnchor(original, original.lastIndexOf("same"), original.length);
  const changed = "---\ntitle: Test\nmwc_open_annotations: 1\n---\nsame same";
  const second = await createAnnotationExportAnchor(changed, changed.lastIndexOf("same"), changed.length);
  deepEqual(first.range, second.range);
});

test("keeps metadata selections usable as legacy MWC annotations", async () => {
  deepEqual(await createAnnotationExportAnchor("---\ntitle: Test\n---\nBody", 4, 9), { text: "title", line: 2 });
});
