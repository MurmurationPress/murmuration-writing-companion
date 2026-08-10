import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  HELP_SETTINGS_ENTRY,
  installHelpCommand,
  invokeHelpSettingsAction,
  MWC_HELP_URL,
  openHelp
} from "../src/help/Help";

test("canonical Help URL targets the maintained main-branch landing page", () => {
  equal(
    MWC_HELP_URL,
    "https://github.com/MurmurationPress/murmuration-writing-companion/blob/main/Help/README.md"
  );
});

test("Open Help command invokes the supplied shared action", () => {
  const commands: Array<{ id: string; name: string; callback: () => void }> = [];
  let opens = 0;
  installHelpCommand(
    { addCommand: (command) => { commands.push(command); } },
    () => { opens += 1; }
  );

  equal(commands[0]?.id, "open-help");
  equal(commands[0]?.name, "Open Help");
  commands[0]?.callback();
  equal(opens, 1);
});

test("shared Help action opens only the canonical external target", () => {
  const calls: unknown[][] = [];
  let failures = 0;
  const opened = openHelp((...args) => {
    calls.push(args);
    return {};
  }, () => { failures += 1; });

  equal(opened, true);
  deepEqual(calls, [[MWC_HELP_URL, "_blank", "noopener,noreferrer"]]);
  equal(failures, 0);
});

test("blocked Help opening fails quietly through the adapter boundary", () => {
  let failures = 0;
  equal(openHelp(() => null, () => { failures += 1; }), false);
  equal(openHelp(() => { throw new Error("unavailable"); }, () => { failures += 1; }), false);
  equal(failures, 2);
});

test("Settings Help action uses the same action without persistence", () => {
  let opens = 0;
  invokeHelpSettingsAction(() => { opens += 1; });
  equal(opens, 1);
  deepEqual(HELP_SETTINGS_ENTRY, {
    name: "Help",
    description: "Open the Murmuration Writing Companion author guide.",
    buttonLabel: "Open Help",
    accessibleLabel: "Open Murmuration Writing Companion Help"
  });
  equal("key" in HELP_SETTINGS_ENTRY, false);
  equal("defaultValue" in HELP_SETTINGS_ENTRY, false);
});
