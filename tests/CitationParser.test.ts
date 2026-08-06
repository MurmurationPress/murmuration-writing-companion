import { deepEqual, equal, throws } from "node:assert/strict";
import { test } from "node:test";
import { applyReferenceImport, normalizeDoi, parseCitation, referenceImportConflicts } from "../src/references/CitationParser";
import { EMPTY_REFERENCE_METADATA } from "../src/references/ReferenceMetadata";

test("parses the Banks citation into canonical Reference fields", () => {
  const result = parseCitation("Banks, J. (2024). Deletion, departure, death: Experiences of AI companion loss. Journal of Social and Personal Relationships. https://doi.org/10.1177/02654075241269688");
  deepEqual(result.metadata.authors, ["Banks, J."]);
  equal(result.metadata.date, "2024");
  equal(result.metadata.title, "Deletion, departure, death: Experiences of AI companion loss");
  equal(result.metadata.publication, "Journal of Social and Personal Relationships");
  equal(result.metadata.doi, "10.1177/02654075241269688");
  equal(result.metadata.link, "https://doi.org/10.1177/02654075241269688");
  deepEqual(result.unparsed, []);
});

test("parses conservative single and multiple-author formatted citations", () => {
  deepEqual(parseCitation("Vale, A. (2020). A title. A Journal.").metadata.authors, ["Vale, A."]);
  deepEqual(parseCitation("Vale, A.; Fenwick, P.; Saye, I. (2021). A title. A Journal, 7(2), 10–19.").metadata.authors,
    ["Vale, A.", "Fenwick, P.", "Saye, I."]);
  deepEqual(parseCitation("Vale, A. & Fenwick, P. (2021). A title. A Journal.").metadata.authors,
    ["Vale, A.", "Fenwick, P."]);
});

test("preserves title punctuation and extracts journal, volume, issue and pages", () => {
  const metadata = parseCitation("Vale, A. (2020). Signals: loss, return, and repair? Journal of Tides, 12(3), pp. 41-59.").metadata;
  equal(metadata.title, "Signals: loss, return, and repair?");
  equal(metadata.publication, "Journal of Tides");
  equal(metadata.volume, "12");
  equal(metadata.issue, "3");
  equal(metadata.pages, "41-59");
});

test("retains incomplete and ambiguous citation components instead of fabricating fields", () => {
  const incomplete = parseCitation("Vale, A. A title without enough structure");
  equal(incomplete.metadata.title, null);
  deepEqual(incomplete.unparsed, ["Vale, A. A title without enough structure"]);
  equal(incomplete.warnings.length > 0, true);

  const noYear = parseCitation("Vale, A. A title. Journal of Tides.");
  deepEqual(noYear.metadata.authors, ["Vale, A"]);
  equal(noYear.metadata.title, "A title");
  equal(noYear.metadata.publication, "Journal of Tides");
  equal(noYear.metadata.date, null);
  equal(noYear.warnings.some((warning) => warning.includes("No publication year")), true);
});

test("normalises DOI-only, prefixed and URL input without accepting malformed values", () => {
  for (const input of ["10.1177/ABC.Def", "doi:10.1177/ABC.Def.", "https://doi.org/10.1177/ABC.Def", "http://dx.doi.org/10.1177/ABC.Def"]) {
    deepEqual(normalizeDoi(input), { doi: "10.1177/abc.def", link: "https://doi.org/10.1177/abc.def" });
    equal(parseCitation(input).metadata.doi, "10.1177/abc.def");
  }
  equal(normalizeDoi("https://example.com/not-a-doi"), null);
  equal(normalizeDoi("https://example.com/10.1177/abc.def"), null);
  equal(normalizeDoi("doi:10.12/no"), null);
  equal(normalizeDoi("https://doi.org/not-a-doi"), null);
});

test("repairs the malformed DOI separator emitted by the SAGE citation widget", () => {
  const input = "Banks, J. (2024). Deletion, departure, death: Experiences of AI companion loss. Journal of Social and Personal Relationships. https://doi.org/10.1177_02654075241269688";
  const result = parseCitation(input);
  equal(result.metadata.doi, "10.1177/02654075241269688");
  equal(result.metadata.link, "https://doi.org/10.1177/02654075241269688");
  equal(result.warnings.some((warning) => warning.includes("underscore") && warning.includes("repaired")), true);
  deepEqual(result.unparsed, []);
  deepEqual(normalizeDoi("10.1177_02654075241269688"), {
    doi: "10.1177/02654075241269688",
    link: "https://doi.org/10.1177/02654075241269688"
  });
});

test("does not replace a non-DOI canonical link", () => {
  const existing = { ...EMPTY_REFERENCE_METADATA, link: "https://example.org/source" };
  const parsed = parseCitation("10.1177/ABC.Def").metadata;
  equal(referenceImportConflicts(existing, parsed).some((conflict) => conflict.field === "link"), true);
  equal(applyReferenceImport(existing, parsed, { link: "keep" }).link, "https://example.org/source");
});

test("requires an explicit choice for populated-field conflicts and preserves cancellation inputs", () => {
  const existing = { ...EMPTY_REFERENCE_METADATA, title: "Existing title", authors: ["Existing, A."] };
  const parsed = parseCitation("Parsed, P. (2024). Parsed title. Parsed Journal.").metadata;
  const snapshot = JSON.stringify(existing);
  deepEqual(referenceImportConflicts(existing, parsed).map((conflict) => conflict.field), ["authors", "title"]);
  throws(() => applyReferenceImport(existing, parsed), /Choose how to resolve/);
  const applied = applyReferenceImport(existing, parsed, { authors: "keep", title: "manual" }, { title: "Corrected title" });
  deepEqual(applied.authors, ["Existing, A."]);
  equal(applied.title, "Corrected title");
  equal(applied.publication, "Parsed Journal");
  equal(JSON.stringify(existing), snapshot);
});
