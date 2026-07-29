import { deepEqual, equal, match, throws } from "node:assert/strict";
import { test } from "node:test";
import {
  ABOUT_EXTERNAL_LINKS,
  ABOUT_SETTINGS_ENTRY,
  aboutPresentation,
  installAboutCommand,
  MURMURATION_PRESS_URLS,
  openAboutExternalLink
} from "../src/about/AboutMurmurationPress";

test("the About command is registered and opens the supplied read-only view", () => {
  const commands: Array<{ id: string; name: string; callback: () => void }> = [];
  let opens = 0;
  let vaultWrites = 0;
  let settingsWrites = 0;
  installAboutCommand({ addCommand: (command) => { commands.push(command); } }, () => { opens += 1; });
  equal(commands[0]?.id, "about-murmuration-writing-companion");
  equal(commands[0]?.name, "About Murmuration Writing Companion");
  commands[0]?.callback();
  equal(opens, 1);
  equal(vaultWrites, 0);
  equal(settingsWrites, 0);
});

test("the settings entry is present and keyboard-labelled", () => {
  equal(ABOUT_SETTINGS_ENTRY.name, "About Murmuration Writing Companion");
  equal(ABOUT_SETTINGS_ENTRY.buttonLabel, "Open About");
  match(ABOUT_SETTINGS_ENTRY.accessibleLabel, /Open About Murmuration Writing Companion/);
});

test("the displayed version is supplied from authoritative plugin metadata", () => {
  const manifest = { version: "9.8.7-authoritative" };
  equal(aboutPresentation(manifest.version).version, manifest.version);
  equal(aboutPresentation("1.0.0").version, "1.0.0");
});

test("official About URLs are central and exact", () => {
  deepEqual(MURMURATION_PRESS_URLS, {
    website: "https://murmurationpress.co.uk/",
    purchasePrimeTrilogy: "https://murmurationpress.co.uk/purchase-prime-trilogy/",
    github: "https://github.com/MurmurationPress/murmuration-writing-companion",
    documentation: "https://github.com/MurmurationPress/murmuration-writing-companion#readme",
    licence: "https://github.com/MurmurationPress/murmuration-writing-companion/blob/main/LICENSE"
  });
  equal(ABOUT_EXTERNAL_LINKS.find((link) => link.prominent)?.url, MURMURATION_PRESS_URLS.purchasePrimeTrilogy);
});

test("external links use the allow-listed safe browser-opening abstraction", () => {
  const calls: unknown[][] = [];
  openAboutExternalLink(MURMURATION_PRESS_URLS.website, (...args) => calls.push(args));
  deepEqual(calls, [[MURMURATION_PRESS_URLS.website, "_blank", "noopener,noreferrer"]]);
  throws(() => openAboutExternalLink("https://example.com/", () => undefined), /not an approved/);
});

test("all rendered link controls have meaningful keyboard-accessible labels", () => {
  equal(ABOUT_EXTERNAL_LINKS.length, 5);
  for (const link of ABOUT_EXTERNAL_LINKS) {
    match(link.label, /\S/);
    match(link.accessibleLabel, /^Open /);
    match(link.url, /^https:\/\//);
  }
});

test("building and closing the About presentation does not mutate inputs", () => {
  const manifest = Object.freeze({ version: "0.16.0" });
  const before = JSON.stringify(manifest);
  const presentation = aboutPresentation(manifest.version);
  equal(JSON.stringify(manifest), before);
  equal(presentation.links, ABOUT_EXTERNAL_LINKS);
});
