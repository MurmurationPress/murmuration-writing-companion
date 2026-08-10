export const MWC_HELP_URL = "https://github.com/MurmurationPress/murmuration-writing-companion/blob/main/Help/README.md";

export type HelpExternalOpener = (
  url: string,
  target: "_blank",
  features: "noopener,noreferrer"
) => unknown;

export function openHelp(
  opener: HelpExternalOpener,
  onFailure: () => void = () => undefined
): boolean {
  try {
    const opened = opener(MWC_HELP_URL, "_blank", "noopener,noreferrer");
    if (opened === null || opened === false) {
      onFailure();
      return false;
    }
    return true;
  } catch {
    onFailure();
    return false;
  }
}

export interface HelpCommandHost {
  addCommand(command: {
    readonly id: string;
    readonly name: string;
    readonly callback: () => void;
  }): unknown;
}

export function installHelpCommand(host: HelpCommandHost, open: () => void): void {
  host.addCommand({
    id: "open-help",
    name: "Open Help",
    callback: open
  });
}

export const HELP_SETTINGS_ENTRY = {
  name: "Help",
  description: "Open the Murmuration Writing Companion author guide.",
  buttonLabel: "Open Help",
  accessibleLabel: "Open Murmuration Writing Companion Help"
} as const;

export function invokeHelpSettingsAction(open: () => void): void {
  open();
}
